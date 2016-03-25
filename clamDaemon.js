var net = require('net');
var Api = require('./api');

var api = new Api();

module.exports = function(filesPath, port) {

    var client;
    var queueLimit = 100;
    var itemsInQueue = 0;
    init(port);

    this.scanDir = function(file) {
        if(queueLimit - itemsInQueue <= 0)
            return console.log('ClamDaemon: queue is full');
        itemsInQueue += 1;
        var pathToScan = filesPath + file.sharename + '/' + file.fileid;
        var scanCMD = 'zSCAN ' + pathToScan + '\0';
        client.write(scanCMD);
    };

    function onData(out) {
        var parsedResponses = parseResponse(out, filesPath);
        itemsInQueue -= parsedResponses.length;
        if(parsedResponses.length) {
            var updatePromises = [];
            parsedResponses.forEach(function(parsedResponse) {
                updatePromises.push(updateFile(parsedResponse));
            });
            Promise.all(updatePromises)
                .then(function(files) {
                    var cleanPromises = [];
                    files.forEach(function(file) {
                        cleanPromises.push(api.cleanChecked(filesPath, file));
                    });
                    Promise.all(cleanPromises)
                        .then(function(removed) {
                            //console.log(removed);
                        })
                        .catch(function(err) {
                            console.error('ClamDaemon remove error: ', err);
                        });
                })
                .catch(function(err) {
                    console.error('ClamDaemon update error: ', err);
                });
        }
    }

    function parseResponse(response, checkerFolder) {
        var parsedResponses = [];
        function singleParse(response) {
            if((response.indexOf('COMMAND READ TIMED OUT') > -1 || response.indexOf('ERROR') > -1) && response.indexOf('OK') == -1 && response.indexOf('FOUND') == -1)
                return {};
            var sharename = {};
            sharename.startPos = response.indexOf(checkerFolder) + checkerFolder.length;
            sharename.endPos = response.indexOf('/', sharename.startPos);
            sharename.name = response.substring(sharename.startPos, sharename.endPos);

            var fileid = {};
            fileid.startPos = sharename.endPos + 1;
            var slashPos = response.indexOf('/', fileid.startPos) > -1 ? response.indexOf('/', fileid.startPos) : Infinity;
            var colonPos = response.indexOf(':', fileid.startPos) > -1 ? response.indexOf(':', fileid.startPos) : Infinity;
            if(slashPos < colonPos)
                fileid.endPos = response.indexOf('/', slashPos);
            if(colonPos < slashPos)
                fileid.endPos = response.indexOf(':', colonPos);
            fileid.id = response.substring(fileid.startPos, fileid.endPos);

            var resultFile = {
                sharename: sharename.name,
                fileid: fileid.id
            };
            var okPos = response.indexOf('OK', fileid.endPos) > -1 ? response.indexOf('OK', fileid.endPos) : Infinity;
            var foundPos = response.indexOf('FOUND', fileid.endPos) > -1 ? response.indexOf('FOUND', fileid.endPos) : Infinity;
            if(okPos < foundPos)
                resultFile.state = 'checked';
            if(foundPos < okPos)
                resultFile.state = 'malware';
            parsedResponses.push(resultFile);
            if(response.indexOf(checkerFolder, fileid.endPos) > -1) {
                var newResp = response.substring(response.indexOf(checkerFolder, fileid.endPos));
                singleParse(newResp);
            }
        }
        singleParse(response);
        return parsedResponses;
    }

    function updateFile(file) {
        return new Promise(function(resolve, reject) {
            api.setFileState(file, file.state)
                .then(function(file) {
                    if(file.state == 'malware')
                        return api.reportMalware(file)
                            .then(function(file) {
                                resolve(file);
                            })
                            .catch(function(err) {
                                reject(err);
                            });
                    resolve(file);
                })
                .catch(function(err) {
                    reject(err);
                });
        });
    }

    function pull() {
        var count = queueLimit - itemsInQueue;
        api.pullFilesToCheck(count).then(function(files) {
            itemsInQueue += files.length;
        });
    }

    // connection
    function init(port) {
        if(client)
            return;
        client = net.createConnection({port: port});

        client.on('connect', function() { // scan files only after connect
            console.log('Connected to ClamDaemon');
            client.setEncoding('utf8');
            client.write('zIDSESSION\0');
        });

        client.on('end', function() {});

        client.on('close', function() {
            client = null;
            reconnect(port);
        });

        client.on('error', function(error) {
            console.error('ClamDaemon error: ', error);
        });

        client.on('data', onData);
    }

    function reconnect(port) {
        console.log('Reconnecting to ClamDaemon');
        init(port);
    }

};
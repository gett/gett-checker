var net = require('net');
var Api = require('./api');

var api = new Api();

module.exports = function(filesPath, port) {
    var client;
    var queueLimit = 100; // MaxThreads * MaxRecursion + MaxQueue - MaxThreads + 6 < RLIMIT_NOFILE (ulimit -n); server value: 12 * 10 + 100 - 12 + 6 = 214 < 1024
    var itemsInQueue = 0;
    var self = this;
    init(port);
    setInterval(pull, 60 * 1000);

    this.scanDir = function(file) {
        if(queueLimit - itemsInQueue <= 0)
            return console.log('ClamDaemon: queue is full');
        api.setFileState(file, 'checking')
            .then(function(file) {
                itemsInQueue += 1;
                var pathToScan = filesPath + file.sharename + '/' + file.fileid;
                var scanCMD = 'zSCAN ' + pathToScan + '\0';
                client.write(scanCMD);
            })
            .catch(function(err) {
                console.log('ClamDaemon error in scanDir: ', err);
            });
    };

    function onData(out) {
        var parsedResponses = parseResponse(out, filesPath);
        itemsInQueue -= parsedResponses.length;
        if(parsedResponses.length) {
            var updatePromises = [];
            parsedResponses.forEach(function(parsedResponse) {
                updatePromises.push(updateFileState(parsedResponse));
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
            if((response.indexOf('COMMAND READ TIMED OUT') > -1 || response.indexOf('ERROR') > -1) && response.indexOf('lstat() failed: No such file or directory. ERROR') == -1 && response.indexOf('OK') == -1 && response.indexOf('FOUND') == -1)
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
            if(!resultFile.state)
                resultFile.state = 'clamd_error';
            parsedResponses.push(resultFile);
            if(response.indexOf(checkerFolder, fileid.endPos) > -1) {
                var newResp = response.substring(response.indexOf(checkerFolder, fileid.endPos));
                singleParse(newResp);
            }
        }
        singleParse(response);
        return parsedResponses;
    }

    function updateFileState(file) {
        return new Promise(function(resolve, reject) {
            api.setFileState(file, file.state)
                .then(function(file) {
                    if(file.state == 'malware')
                        api.reportMalwareFile(file)
                            .then(function(file) {
                                console.log('clamDaemon says NO to ' + (file && file.sharename) + '/' + (file && file.fileid));
                                resolve(file);
                            })
                            .catch(function(err) {
                                reject(err);
                            });
                    else
                        resolve(file);
                })
                .catch(function(err) {
                    reject(err);
                });
        });
    }

    function pull() {
        if(!client)
            return;
        var count = queueLimit - itemsInQueue;
        api.pullFilesToCheck(count)
            .then(function(files) {
                files.forEach(function(file) {
                    self.scanDir(file);
                });
            })
            .catch(function(err) {
                console.log('clamDaemon pull error: ', err);
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
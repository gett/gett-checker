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
        itemsInQueue -= 1;
        var parsedResponse = parseResponse(out);
        if(parsedResponse)
            updateFile(parsedResponse);
        console.log(out, parsedResponse);
    }

    function parseResponse(response) {
        var checkerFolder = filesPath;
        if(response.indexOf('COMMAND READ TIMED OUT') > -1 || response.indexOf('ERROR') > -1)
            return {};
        var sharename = {};
        sharename.startPos = response.indexOf(checkerFolder) + checkerFolder.length;
        sharename.endPos = response.indexOf('/', sharename.startPos);
        sharename.name = response.substring(sharename.startPos, sharename.endPos);

        var fileid = {};
        fileid.startPos = sharename.endPos + 1;
        if(response.indexOf('/', fileid.startPos) != -1)
            fileid.endPos = response.indexOf('/', fileid.startPos);
        else
            fileid.endPos = response.indexOf(':', fileid.startPos);
        fileid.id = response.substring(fileid.startPos, fileid.endPos);

        var resultFile = {
            sharename: sharename.name,
            fileid: fileid.id
        };
        if(response.indexOf('OK') > -1)
            resultFile.state = 'checked';
        if(response.indexOf('FOUND') > -1)
            resultFile.state = 'malware';
        return resultFile;
    }

    function updateFile(file) {
        if(file.state == 'checked')
            api.setFileState(file, file.state);
        else {
            api.setFileState(file, file.state);
            api.reportMalware(file);
        }
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
            console.error('error: ', error);
        });

        client.on('data', onData);
    }

    function reconnect(port){
        console.log('Reconnecting to ClamDaemon');
        init(port);
    }

};
var net = require('net');
var Api = require('./api');
var api = new Api();
var AVG_PORT = 54322; // Default.tcpd.avg.ports, to set new port: avgcfgctl -w Default.tcpd.avg.ports="|12345|"

module.exports = function(filePath) {

    this.scanDir = function(file) {
        return new Promise(function(resolve, reject) {
            api.setFileState(file, 'checking')
                .then(function(file) {
                    return scanDir(filePath, file);
                })
                .then(function(file) {
                    return api.setFileState(file, file.state);
                })
                .then(function(file) {
                    if(file.state == 'malware') {
                        api.cleanChecked(filePath, file); // remove only if malware, if not - clamDaemon/metascan will use these files
                        api.reportMalwareFile(file);
                        console.log('AVGScan says NO to ' + (file && file.sharename) + '/' + (file && file.fileid));
                    }
                    resolve(file);
                })
                .catch(function(err) {
                    console.error('AVGScan error: ', err);
                    api.setFileState(file, 'avg_error')
                        .then(function(file) {
                            resolve(file); // next steps will be clamDaemon and/or metascan
                        })
                        .catch(function(err) {
                            resolve(file); // next steps will be clamDaemon and/or metascan
                        });
                });
        });
    };

    function scanDir(filePath, file) {
        return new Promise(function(resolve, reject) {
            var stdout;
            var client = net.createConnection({port: AVG_PORT});
            client.on('connect', function() {
                client.setEncoding('utf8');
                var pathToScan = filePath + file.sharename + '/' + file.fileid;
                client.write('SCAN "' + pathToScan + '"'); // put path in ""
            });
            client.on('close', function(had_error) {
                if(stdout && stdout.indexOf('200 ok') > -1)
                    file.state = 'checked';
                else
                    file.state = 'malware';
                resolve(file);
            });
            client.on('error', function(error) {
                console.error('AVGScan error in scanDir: ', error);
                reject(error);
            });
            client.on('data', function(data) {
                stdout += data;
            });
        })
    }


};
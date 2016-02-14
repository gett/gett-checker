/**
 * Created by rparaschak on 2/13/16.
 */
var spawn = require('child_process').spawn;
var Api = require('./api');

var api = new Api();

function Checker(folder) {

    var _scan_folder = folder;



    this.run = function () {
        var scanPromise = scan();
        var filesPromise = api.getFilesToCheck();

        return Promise.all([scanPromise, filesPromise])
            .then(function(promise){
                var scan = promise[0];
                var files = promise[1];
                console.log(scan, files);
            })
            .catch(function (e) {
                console.log(e.stack);
            });
    };

    var scan = function() {
        return new Promise(function (resolve, reject) {
            var clam = spawn('clamscan', [_scan_folder, '-r', '--no-summary', '--infected']);
            var data = '';
            var err = '';

            clam.stdout.on('data', function (out) {
                data += out;
            });

            clam.stderr.on('data', function (out) {
                err += out;
            });

            clam.on('close', function (code) {
                if (err)
                    return reject(err);
                resolve(data);
            });
        });
    }
}

module.exports = Checker;

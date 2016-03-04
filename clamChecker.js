/**
 * Created by rparaschak on 2/13/16.
 */
var spawn = require('child_process').spawn;
var Api = require('./api');
var fs = require('fs');
var exec = require('child_process').exec;

var api = new Api();

function Checker(folder) {

    var checking = false;

    var _scan_folder = folder;

    this.run = function (filesPromise) {
        var scanPromise = scan();

        return scanPromise
            .then(function(scanReport){
                var malware = [];
                return filesPromise.then(function(files){
                    files.forEach(function(file){
                        if(scanReport.indexOf(file.sharename + '/' + file.fileid) > -1)
                            malware.push(file);
                    });
                    return {
                        malware: malware,
                        checked: files
                    };
                });
            })
            .catch(function (e) {
                throw e;
            });
    };

    this.cleanChecked = function(files){
        if(!files.length)
            return new Promise(function(){});
            var promises = [];
            files.forEach(function(file){
                promises.push(removeDir(_scan_folder + file.sharename));
            });
        return Promise.all(promises);
    };

    var removeDir = function(dir){
        return new Promise(function(resolve, reject){
            exec( 'rm -rf ' + dir, function ( err, stdout, stderr ){
                stdout && resolve(stdout);
                err && reject(stderr);
            });
        });
    };

    var scan = function() {
        return new Promise(function (resolve, reject) {
            if(checking)
                return reject('Already in progress.');

            var clam = spawn('clamscan', [_scan_folder, '-r', '--no-summary', '--infected']);
            var data = '';
            var err = '';

            checking = true;

            clam.stdout.on('data', function (out) {
                data += out;
            });

            clam.stderr.on('data', function (out) {
                err += out;
            });

            clam.on('close', function (code) {
                console.log(err, data);
                checking = false;
                if (err)
                    return reject(err);
                resolve(data);
            });
        });
    }
}

module.exports = Checker;

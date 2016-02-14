/**
 * Created by rparaschak on 2/13/16.
 */

var Api = require('./api');

var api = new Api();

function Checker() {

    this.run = function () {
        return api.getFilesToCheck()
            .then(function (files) {
                console.log(files);
            })
            .catch(function(e){
                console.log(e.stack);
            });
    }

    function scanFile(filename) {
        return new Promise(function (resolve, reject) {
            exec('clamscan ' + filename, function (error, stdout, stderr) {
                if (error !== null)
                    return reject(error);
                parseCalmavScanReport(stdout);
            });
        });
    }

}

module.exports = Checker;


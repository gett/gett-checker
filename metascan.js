/**
 * Created by rparaschak on 2/16/16.
 */

var md5File = require('md5-file');
var request = require('request');

function Metascan(folder) {

    var self = this;

    var api_url = 'https://hashlookup.metascan-online.com/v2';
    var api_hash_lookup_url = '/hash/:hash';
    var api_key = '82eaf63d8307419bae0fe236d3c17fff';

    var scan_folder = folder;

    /*this.run = function(filesPromise){ //TODO:
        var promises = [];

        filesPromise
            .then(function(files){
                files.forEach(function(file){
                    var promise = self.scanFile(file.sharename + '/' + file.fileid + '/' + encodeURIComponent(file.filename));
                    promises.push(promise);
                });
                return Promise.all(promises).then(function(scan_results){
                    files.forEach(function(file, index){});
                });
            });

    };*/

    this.scanFile = function (file) {
        return file_md5(scan_folder + file)
            .then(function (md5) {
                return lookup_request(md5);
            })
            .then(function(results){
                return results.scan_results && results.scan_results['scan_all_result_a'] == 'Infected'
            });
    };

    var file_md5 = function (path) {
        return new Promise(function (resolve, reject) {
            md5File(path, function (err, sum) {
                err && reject(err);
                sum && resolve(sum);
            });
        });
    };

    var lookup_request = function (hash) {
        return new Promise(function (resolve, reject) {
            var url = api_url + api_hash_lookup_url;
            url = url.replace(':hash', hash);

            var options = {
                url: url,
                headers: {
                    apikey: api_key,
                    file_metadata: 0
                }
            };
            request(options, function (err, res, body) {
                if (res && res.status > 400)
                    return reject(body);
                try {
                    var result = JSON.parse(body);
                }
                catch (err) {
                    console.error('Metascan: response parse error. Response: ', body);
                    result = body;
                }
                finally {
                    resolve(result);
                }
            });
        });
    }
}

module.exports = Metascan;
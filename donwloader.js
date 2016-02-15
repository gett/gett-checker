/**
 * Created by rparaschak on 2/14/16.
 */

var exec = require('child_process').exec;
var fs = require('fs');

var known_archives = [
    'tar',
    'tar.gz',
    'zip',
    //'7z',
    //'rar'
]

function Downloader(folder){

    var download_folder = folder;

    this.downloadFile = function(file){
        return new Promise(function(resolve, reject){
            var args = " -L -o :path:filename :fileurl";
            var filepath = download_folder + file.sharename + '/' + file.fileid;

            !fs.existsSync(download_folder + file.sharename) && fs.mkdirSync(download_folder + file.sharename);
            !fs.existsSync(filepath) && fs.mkdirSync(filepath);

            args = args
                .replace(':path', filepath)
                .replace(':filename', '/' + file.filename)
                .replace(':fileurl', file.downloadurl);

            exec('curl ' + args, function (error, stdout, stderr) {
                if (error !== null){
                    console.log(error, stderr);
                    return reject(error, stderr);
                }

                file.path = download_folder + file.filename;

                if(!isArchive(file))
                    return resolve(file);
                //Unpacking archive
                //Skip archives with password
                resolve(file);

                //Unpacking archives


            });
        });
    };

    var unpack = function(file){

    }

    var isArchive = function(file){
        var isArchive = false;
        known_archives.every(function(type){
            isArchive = file.filename.indexOf(type, this.length - type.length) !== -1;
            return !isArchive;
        });
        return isArchive;
    }

}

module.exports = Downloader;
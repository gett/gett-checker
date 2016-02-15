/**
 * Created by rparaschak on 2/14/16.
 */

var exec = require('child_process').exec;
var fs = require('fs');

var known_archives = [
    'tar',
    'tar.gz',
    'zip',
    '7z', // p7zip-full
    'rar',
    'cpgz',
    'tgz'
];

function Downloader(folder){

    var download_folder = folder;
    var archiveType = undefined;
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
        var filepath = download_folder + file.sharename + '/' + file.fileid;
        var dest_dir = file.filename;
        dest_dir = dest_dir.split('.');
        dest_dir.pop();
        dest_dir = dest_dir.join('');
        dest_dir = filepath + '/' + dest_dir;
        !fs.existsSync(dest_dir) && fs.mkdirSync(dest_dir);
        var execQuery = '';
        switch(archiveType) {
            case 'tar':
            case 'tar.gz':
            case 'tgz':
                execQuery = 'tar -xf ' + filepath + '/' + file.filename + ' -C ' + dest_dir; // tar -xf *.tar.gz -C temp/sharename/fileid/archName
                break;
            case 'zip':
                execQuery = 'unzip -o ' + filepath + '/' + file.filename + ' -d ' + dest_dir; // unzip -o zip.zip -d temp/zip.zip
                break;
            case '7z':
                execQuery = '7z x ' + filepath + '/' + file.filename + ' -y -o' + dest_dir; // 7z x 7z.7z -y -otemp/7z.7z
                break;
            case 'rar':
                execQuery = 'unrar x ' + filepath + '/' + file.filename + ' ' + dest_dir; // unrar x rar.rar temp/rar.rar
                break;
        }
        exec(execQuery, function(err, stdout, stderr) {
            console.log(err, stdout, stderr);
        });
    };

    var isArchive = function(file){
        var isArchive = false;
        known_archives.every(function(type){
            isArchive = file.filename.indexOf(type, this.length - type.length) !== -1;
            if(isArchive)
                archiveType = type;
            return !isArchive;
        });
        return isArchive;
    };

}

module.exports = Downloader;
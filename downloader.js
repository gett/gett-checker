/**
 * Created by rparaschak on 2/14/16.
 */

var exec = require('child_process').exec;
var fs = require('fs');
var FRONTEND_HOST = 'http://ge.tt';

var known_archives = [
    '.tar.gz', // should be before tar
    '.tar',
    '.zip',
    '.7z', // p7zip-full
    '.rar',
    //'cpgz',
    '.tgz'
];

function Downloader(folder) {

    var self = this;
    var download_folder = folder;
    this.downloadFile = function (file) {
        return new Promise(function (resolve, reject) {
            var args = " -L -o ':path:filename' :fileurl";
            var filepath = download_folder + file.sharename + '/' + file.fileid;

            !fs.existsSync(download_folder + file.sharename) && fs.mkdirSync(download_folder + file.sharename);
            !fs.existsSync(filepath) && fs.mkdirSync(filepath);

            args = args
                .replace(':path', filepath)
                .replace(':filename', '/' + encodeURIComponent(file.filename))
                .replace(':fileurl', file.downloadurl);

            args += ' --referer ' + FRONTEND_HOST; // without this header we will get redirect to share page

            exec('curl ' + args, function (error, stderr, stdout) {
                if (error !== null) {
                    return reject({error: error, stderr: stderr, file: file});
                }
                console.log('File ' + file.sharename + '/' + file.filename + ' has been downloaded.');
                file.path = download_folder + file.filename;
                console.log('Archive: ' + self.isArchive(file));
                if (self.isArchive(file))
                    unpack(file, self.isArchive(file))
                        .then(function (){});
                resolve(file);
                //Unpacking archives


            });
        });
    };

    var unpack = function (file, archiveType) {
        return new Promise(function (resolve, reject) {
            var filepath = download_folder + file.sharename + '/' + file.fileid;
            var dest_dir = file.filename;
            dest_dir = dest_dir.split('.');
            dest_dir.pop();
            dest_dir = dest_dir.join('');
            dest_dir = filepath + '/' + dest_dir;
            !fs.existsSync(dest_dir) && fs.mkdirSync(dest_dir);
            var execQuery = '';
            switch (archiveType) {
                case '.tar.gz':
                    var unpackedTar = file.filename.split('.');
                    unpackedTar.pop();
                    unpackedTar = unpackedTar.join('.');
                    execQuery = 'gzip -kd ' + filepath + '/' + file.filename + ' && tar -xf ' + filepath + '/' + unpackedTar + ' -C ' + dest_dir;
                    // query example: gzip -kd ./temp/8/0/targz.tar.gz && tar -xf ./temp/8/0/targz.tar -C ./temp/8/0/targztar
                    break;
                case '.tar':
                case '.tgz':
                    execQuery = 'tar -xf ' + filepath + '/' + file.filename + ' -C ' + dest_dir;
                    // query example: tar -xf ./temp/9/0/tgz.tgz -C ./temp/9/0/tgz
                    break;
                case '.zip':
                    execQuery = 'unzip -o ' + filepath + '/' + file.filename + ' -d ' + dest_dir;
                    // query example: unzip -o ./temp/10/0/zip.zip -d ./temp/10/0/zip
                    break;
                case '.7z':
                    execQuery = '7z x ' + filepath + '/' + file.filename + ' -y -o' + dest_dir;
                    // query example: 7z x ./temp/11/0/7z.7z -y -o./temp/11/0/7z
                    break;
                case '.rar':
                    execQuery = 'unrar x ' + filepath + '/' + file.filename + ' ' + dest_dir;
                    // query example: unrar x ./temp/12/0/rar.rar ./temp/12/0/rar
                    break;
            }
            exec(execQuery, function (err, stdout, stderr) {
                if (err)
                    console.log(err, stderr);
                return resolve(file);
            });
        });
    };

    this.isArchive = function (file) {
        var isArchive = false;
        var archiveType;
        known_archives.every(function (type) {
            isArchive = file.filename.indexOf(type, this.length - type.length) !== -1;
            if (isArchive)
                archiveType = type;
            return !isArchive;
        });
        return archiveType || false;
    };

}

module.exports = Downloader;
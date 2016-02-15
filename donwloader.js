/**
 * Created by rparaschak on 2/14/16.
 */

var exec = require('child_process').exec;
var fs = require('fs');

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

    var download_folder = folder;
    var archiveType;
    this.downloadFile = function (file) {
        return new Promise(function (resolve, reject) {
            var args = " -L -o :path:filename :fileurl";
            var filepath = download_folder + file.sharename + '/' + file.fileid;

            !fs.existsSync(download_folder + file.sharename) && fs.mkdirSync(download_folder + file.sharename);
            !fs.existsSync(filepath) && fs.mkdirSync(filepath);

            args = args
                .replace(':path', filepath)
                .replace(':filename', '/' + encodeURIComponent(file.filename))
                .replace(':fileurl', file.downloadurl);

            exec('curl ' + args, function (error, stdout, stderr) {
                if (error !== null) {
                    return reject(error, stderr);
                }
                console.log(error, stderr);

                file.path = download_folder + file.filename;
                if (!isArchive(file))
                    return resolve(file);
                console.log('Archive!!!');
                console.log(isArchive(file));
                unpack(file).then(function (file) {
                    resolve(file);
                }).catch(function (stderr) {
                    return reject(stderr);
                });
                //Unpacking archive
                //Skip archives with password

                //Unpacking archives


            });
        });
    };

    var unpack = function (file) {
        return new Promise(function (resolve, reject) {
            var filepath = download_folder + file.sharename + '/' + file.fileid;
            var dest_dir = encodeURIComponent(file.filename);
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
                    execQuery = 'gzip -d ' + filepath + '/' + file.filename + ' && tar -xf ' + filepath + '/' + unpackedTar + ' -C ' + dest_dir;
                    // query example: gzip -d ./temp/8/0/targz.tar.gz && tar -xf ./temp/8/0/targz.tar -C ./temp/8/0/targztar
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
                if (err !== null)
                    return reject(stderr);
                return resolve(file);
            });
        });
    };

    var isArchive = function (file) {
        var isArchive = false;
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
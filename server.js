/**
 * Created by rparaschak on 2/14/16.
 */
var express = require('express');
var bodyParser = require('body-parser');
var Api = require('./api');
var Downloader = require('./downloader');
var MetaScan = require('./metascan');
var Checker = require('./clamChecker');
var ClamDaemon = require('./clamDaemon');
var _ = require('underscore');

var temp_files;
if (process.env.NODE_ENV == 'production')
    temp_files = '/tmp/gett-checker/';
else
    temp_files = __dirname + '/temp/'; // clamDaemon requires full path

var app = express();
var api = new Api();
var checker = new Checker(temp_files);
var downloader = new Downloader(temp_files);
var metascan = new MetaScan(temp_files);
var clamDaemon = new ClamDaemon(temp_files, 12000);

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({extended: true}));


app.post('/file/register', function (req, res) {
    if (!req.body.downloadurl || !req.body.sharename || !req.body.fileid || !req.body.filename)
        return res.status(400).json({error: 'if(!req.body.downloadurl || !req.body.sharename || !req.body.fileid, !req.body.filename)'});
    req.body.filename = req.body.filename.split('.');
    var fileExtension = req.body.filename.pop();
    if(!req.body.filename.length)
        req.body.filename = fileExtension;
    else
        req.body.filename = req.body.filename.join('').replace(/[^a-zA-Z0-9.]/g, '') + '.' + fileExtension;
    api.registerFile(req.body)
        .then(function (file) {
            res.status(201).send();
            return downloader.downloadFile(req.body);
        })
        .then(function (file) {
            console.log('Download has been finished.');
            return api.setFileState(file, 'ready')
        })
        .then(function (file) {//Meta scan
            if (!downloader.isArchive(file) && file.filename.indexOf('.exe') == -1 && file.filename.indexOf('.cmd') == -1)
                return clamDaemon.scanDir(file);
            metascan.scanFile(file.sharename + '/' + file.fileid + '/' + encodeURIComponent(file.filename))
                .then(function (infected) {
                    if (!infected){
                        console.log('Metachecker says YES to ' + file.sharename);
                        return clamDaemon.scanDir(file);
                    }
                    console.log('Metachecker says NO to ' + file.sharename);
                    var markPromise = api.setFileState(file, 'malware');
                    var deletePromise = api.cleanChecked(temp_files, file);
                    var reportPromise = api.reportMalwareFile(file);
                    return Promise.all([markPromise, reportPromise, deletePromise])
                        .then(function (promises) {
                            //console.log(promises);
                        })
                        .catch(function (e) {
                            console.log('server.js: mark, report or delete error: ', e.stack);
                            throw e;
                        });

                })
                .catch(function (e) {
                    console.log(e.stack);
                    throw e;
                });
        })
        .catch(function (e) {
            console.log(e, e.stack);
            res.status(200).send();
        });
});

app.get('/check', function (req, res) {
    var files = api.getFilesToCheck();

    checker.run(files)
        .then(function (results) {
            var markPromise = api.markAsChecked(results.checked);
            var reportPromise = api.reportMalwareFiles(results.malware);
            var deletePromise = checker.cleanChecked(results.checked);
            return Promise.all([markPromise, reportPromise, deletePromise]);
        })
        .then(function (promises) {
            console.log(promises);
        })
        .catch(function (e) {
            console.log(e.stack);
        });
});

app.listen(8080, function () {

});

//Run checker every X minutes
/*setInterval(function () {
    var files = api.getFilesToCheck();

    checker.run(files)
        .then(function (results) {
            var markPromise = api.markAsChecked(results.checked);
            var reportPromise = api.reportMalwareFiles(results.malware);
            var deletePromise = checker.cleanChecked(results.checked);
            return Promise.all([markPromise, reportPromise, deletePromise]);
        })
        .then(function (promises) {
            console.log(promises);
        })
        .catch(function (e) {
            console.log(e, e.stack);
        });
}, 60 * 1000);*/

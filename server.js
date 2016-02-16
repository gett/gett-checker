/**
 * Created by rparaschak on 2/14/16.
 */
var express = require('express');
var bodyParser = require('body-parser');
var Api = require('./api');
var Downloader = require('./donwloader');
var MetaScan = require('./metascan');
var Checker = require('./clamChecker');
var _ = require('underscore');

var temp_files;
if (process.env.NODE_ENV == 'production')
    temp_files = '/tmp/gett-checker/';
else
    temp_files = './temp/';

var app = express();
var api = new Api();
var checker = new Checker(temp_files);
var donwloader = new Downloader(temp_files);
var metascan = new MetaScan(temp_files);

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({extended: true}));


app.post('/file/register', function (req, res) {
    if (!req.body.downloadurl || !req.body.sharename || !req.body.fileid || !req.body.filename)
        return res.status(400).json({error: 'if(!req.body.downloadurl || !req.body.sharename || !req.body.fileid, !req.body.filename)'});

    api.registerFile(req.body)
        .then(function (file) {
            res.status(201).send();
            return donwloader.downloadFile(req.body);
        })
        .then(function (file) {
            console.log('Download has been finished.');
            return api.setFileState(file, 'ready')
        })
        .then(function (file) {//Meta scan
            if (!donwloader.isArchive(file) && (file.filename.indexOf('.exe') == -1))
                return;
            console.log('Using Metascan: ');
            metascan.scanFile(file.sharename + '/' + file.fileid + '/' + encodeURIComponent(file.filename))
                .then(function (infected) {
                    if (!infected)
                        return;
                    console.log('Metachecker says no to file ' + file.filename);
                    var markPromise = api.markAsChecked([file]);
                    var reportPromise = api.reportMalware([file]);
                    var deletePromise = checker.cleanChecked([file]);
                    return Promise.all([markPromise, reportPromise, deletePromise])
                        .then(function (promises) {
                            console.log(promises);
                        })
                        .catch(function (e) {
                            console.log(e.stack);
                        });

                })
                .catch(function (e) {
                    console.log(e.stack);
                });
        })
        .catch(function (e) {
            console.log(e.stack);
        });
});

app.get('/check', function (req, res) {
    metascan.scanFile('aba/Virus.DOS.1_COM')
        .then(function (scan_res) {
            console.log(scan_res);
            res.status(200).send(scan_res);
        })
        .catch(function (err) {
            res.status(500).json(JSON.parse(err));
        });

});

app.listen(8080, function () {

});

//Run checker every X minutes
setInterval(function () {
    var filesPromise = api.getFilesToCheck();

    checker.run(filesPromise)
        .then(function (results) {
            var markPromise = api.markAsChecked(results.checked);
            var reportPromise = api.reportMalware(results.malware);
            var deletePromise = checker.cleanChecked(results.checked);
            return Promise.all([markPromise, reportPromise, deletePromise]);
        })
        .then(function (promises) {
            console.log(promises);
        })
        .catch(function (e) {
            console.log(e.stack);
        });
}, 3 * 60 * 1000);
/**
 * Created by rparaschak on 2/14/16.
 */
var express = require('express');
var bodyParser = require('body-parser');
var Api = require('./api');
var Downloader = require('./donwloader');
var Checker = require('./checker');
var _ = require('underscore');

var temp_files;
if(process.env.NODE_ENV == 'production')
    temp_files = '/tmp/';
else
    temp_files = './temp/';

var app = express();
var api = new Api();
var checker = new Checker(temp_files);
var donwloader = new Downloader(temp_files);

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true }));


app.post('/file/register', function (req, res) {
    if(!req.body.downloadurl || !req.body.sharename || !req.body.fileid || !req.body.filename)
        return res.status(400).json({error: 'if(!req.body.downloadurl || !req.body.sharename || !req.body.fileid, !req.body.filename)'});

    api.registerFile(req.body)
        .then(function(file){
            res.status(201).send();
            return donwloader.downloadFile(req.body);
        })
        .then(function(file){
            console.log('Download has been finished.');
            console.log();
            return api.setFileState(file, 'ready')
        })
        .catch(function(e){
            console.log(e.stack);
        });
});

app.post('/check', function(req, res){
    checker.run()
        .then(function(results){
            var markPromise = api.markAsChecked(results.checked);
            var reportPromise = api.reportMalware(results.malware);
            var deletePromise = checker.cleanChecked(results.checked);
            return Promise.all([markPromise, reportPromise, deletePromise]);
        })
        .then(function(promises){
            console.log(promises);
        })
        .catch(function(e){
            console.log(e.stack);
        });
});

app.listen(8080, function () {

});

//Run checker every minute
setInterval(function(){
    checker.run()
        .then(function(results){
            var markPromise = api.markAsChecked(results.checked);
            var reportPromise = api.reportMalware(results.malware);
            var deletePromise = checker.cleanChecked(results.checked);
            return Promise.all([markPromise, reportPromise, deletePromise]);
        })
        .then(function(promises){
            console.log(promises);
        })
        .catch(function(e){
            console.log(e.stack);
        });
}, 60 * 1000);
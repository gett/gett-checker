/**
 * Created by rparaschak on 2/14/16.
 */
var express = require('express');
var bodyParser = require('body-parser');
var Api = require('./api');
var Downloader = require('./donwloader');
var Checker = require('./checker');


var app = express();
var api = new Api();
var checker = new Checker('./temp/');
var donwloader = new Downloader('./temp/');

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
            return api.setFileState(file, 'ready')
        })
        .catch(function(e){
            console.log(e.stack);
        });
});

app.post('/check', function(req, res){
    checker.run()
        .then(function(report){
            console.log(report);
        })
        .catch(function(e){
            console.log(e.stack);
        });
});

app.listen(8080, function () {

});
/**
 * Created by rparaschak on 2/14/16.
 */

var _ = require('underscore');
var request = require('request');
var exec = require('child_process').exec;
var fs = require('fs');
var MongoClient = require('mongodb').MongoClient
    , assert = require('assert');

var gett_api;

if(process.env.NODE_ENV == 'production')
    gett_api = 'http://api.ge.tt';
else
    gett_api = 'http://local.ge.tt:10000';

var url = 'mongodb://localhost:27017/analyzer';
var mongo;
var File;

MongoClient.connect(url, function(err, db) {
    assert.equal(null, err);
    console.log("Connected correctly to server");
    mongo = db;
    File = db.collection('files');
});

function Api(){

    // possible file states: received, ready, checking, checked, malware, clamd_error, rescanning, rescanning_error
    // each file will have scannedAt field in seconds

    this.registerFile = function(file){
        return new Promise(function(resolve, reject){
            file.state = 'received';
            File.find({sharename: file.sharename, fileid: file.fileid}).toArray(function(err, files){
                if(err)
                    return reject(err);
                if(files.length)
                    return reject({message: 'File exists in the system already ' + file.sharename + '/' + file.fileid});
                File.insert(file, function(err, file){
                    err && reject(err);
                    file && resolve(file);
                });
            });
        });
    };

    this.setFileState = function(file, state){
        return new Promise(function(resolve, reject){
            File.updateOne({sharename: file.sharename, fileid: file.fileid}, {$set: { state: state, scannedAt: getTSInSeconds() }}, function(err, res){
                if(err)
                    return reject(err);
                file.state = state;
                resolve(file);
            });
        });

    };

    this.getFilesToCheck = function(){
        return new Promise(function(resolve, reject){
            File.find({state: 'ready'}).toArray(function(err, files){
                if(err)
                    return reject(err);
                return resolve(files);
            });
        });
    };

    this.pullFilesToCheck = function(limit) {
        return new Promise(function(resolve, reject) {
            File.find({state: 'ready'})
                .limit(limit)
                .toArray(function(err, files) {
                    if(err)
                        return reject(err);
                    return resolve(files);
                });
        });
    };
    this.pullFileToRescan = function(olderThan) {
        return new Promise(function(resolve, reject) {
            File.find(
                    {readystate: {$ne: 'malware'},
                    $or: [
                        {scannedAt: {$lte: olderThan}},
                        {state: 'rescanning_error'},
                        {state: 'clamd_error'}
                    ]
                })
                .limit(1)
                .toArray(function(err, files) {
                    if(err)
                        return reject(err);
                    !files[0] && console.log('Rescanning: no more files to rescan.');
                    return resolve(files[0]);
                });
        });
    };

    this.markAsChecked = function(files){
        return new Promise(function(resolve, reject){
            if(!files.length)
                resolve([]);
            var files_id = _.pluck(files, '_id');
            File.update({_id: {$in: files_id}}, {$set: {state: 'checked', scannedAt: getTSInSeconds()}}, {multi: true}, function(err, files){
                err && reject(err);
                files && resolve(files);
            });
        });
    };

    this.reportMalwareFile = function(malware){
        return new Promise(function(resolve, reject){
            request.post({url: gett_api + '/violation/malware/report', formData: {malware: JSON.stringify([malware])}}, function(error, response, body) {
                if(error)
                    return reject(error);
                resolve(malware);
            });
        }).catch(function(e){
            console.log('reportMalwareFile error: ', e.stack);
        });
    };

    this.reportMalwareFiles = function(malware){
        return new Promise(function(resolve, reject){
            if(!malware.length)
                return resolve([]);
            request.post({url: gett_api + '/violation/malware/report', formData: {malware: JSON.stringify(malware)}});
            resolve(malware);
            //api request here
        }).catch(function(e){
            console.log(e.stack);
        });
    };

    function deleteFolderRecursive(path) {
        if(fs.existsSync(path)) {
            fs.readdirSync(path).forEach(function(file) {
                var curPath = path + "/" + file;
                if(fs.lstatSync(curPath).isDirectory())
                    deleteFolderRecursive(curPath);
                else
                    fs.unlinkSync(curPath);
            });
            fs.rmdirSync(path);
        }
    }

    this.cleanChecked = function(scanFolder, file) {
        return new Promise(function(resolve, reject) {
            var dir = scanFolder + file.sharename + '/' + file.fileid;
            try {
                deleteFolderRecursive(dir);
            }
            catch(e) {
                // if 'deleteFolderRecursive' fail - we still must remove folder
                exec('rm -rf ' + dir, function(error, stdout, stderr) {
                    if(error)
                        console.error('API->cleanChecked remove error: ', error, stderr);
                });
            }
            resolve(dir);
        });
    };

    function getTSInSeconds() { // used for scannedAt field
        return Math.floor(new Date().getTime() / 1000);
    }

}

module.exports = Api;
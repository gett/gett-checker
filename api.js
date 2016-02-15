/**
 * Created by rparaschak on 2/14/16.
 */

var _ = require('underscore');
var request = require('request');
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

    this.registerFile = function(file){
        return new Promise(function(resolve, reject){
            file.state = 'received';
            File.insert(file, function(err, file){
                err && reject(err);
                file && resolve(file);
            });
        });
    };

    this.setFileState = function(file, state){
        return new Promise(function(resolve, reject){
            File.updateOne({sharename: file.sharename, fileid: file.fileid}, {$set: { state: state }}, function(err, res){
                if(err)
                    return reject(err);
                file.state = state;
                resolve(file);
            });
        });

    }

    this.getFilesToCheck = function(){
        return new Promise(function(resolve, reject){
            File.find({state: 'ready'}).toArray(function(err, files){
                if(err)
                    return reject(err);
                resolve(files);
            });
        });
    }

    this.markAsChecked = function(files){
        return new Promise(function(resolve, reject){
            if(!files.length)
                resolve([]);
            var files_id = _.pluck(files, '_id');
            File.update({_id: {$in: files_id}}, {$set: {state: 'checked'}}, {multi: true}, function(err, files){
                err && reject(err);
                files && resolve(files);
            });
        });
    };

    this.reportMalware = function(malware){
        return new Promise(function(resolve, reject){
            if(!malware.length)
                return resolve([]);
            request.post({url: gett_api + '/violation/malware/report', formData: {malware: JSON.stringify(malware)}});
            resolve(malware);
            //api request here
        }).catch(function(e){
            console.log(e.stack);
        });
    }
}

module.exports = Api;
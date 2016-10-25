var LOOKUP_LIMIT_PER_HOUR = 5; // how many files we will scan per hour, metascan hash lookup limit per hour = 1500
var SCAN_OLDER_THAN = 15 * 24 * 60 * 60; // 15 days (in seconds)

module.exports = function(filesPath, api, downloader, avgScan, clamDaemon, metascan) {

    var currentLookupCounter = 0;
    var inProgress = false;

    setInterval(resetCounter, 60 * 1000); // check counter each minute

    setInterval(function() {
        if(currentLookupCounter < LOOKUP_LIMIT_PER_HOUR && !inProgress) // try to scan new file
            rescanFile();
    }, 1000);

    function resetCounter() {
        if(new Date().getMinutes() == 0) // reset counter each hour
            currentLookupCounter = 0;
    }

    function getTSInSeconds() {
        return Math.floor(new Date().getTime() / 1000);
    }

    function rescanFile() {
        if(clamDaemon.isWorking())
            return new Promise(function(resolve, reject) {
                inProgress = true;
                // api.pullFileToRescan(getTSInSeconds() - SCAN_OLDER_THAN) // uncomment after all documents will be rescanned
                api.pullFileToRescan()
                    .then(function(pulledFile) { // pulledFile to handle errors while file for processing
                        if(!pulledFile) {
                            inProgress = false;
                            resolve();
                            return;
                        }
                        api.setFileState(pulledFile, 'rescanning')
                            .then(function(file) {
                                return downloader.downloadFile(file);
                            })
                            .then(function(file) {
                                return avgScan.scanDir(file);
                            })
                            .then(function(file) {
                                if(file && file.state == 'malware') {
                                    inProgress = false;
                                    resolve();
                                    return;
                                }
                                if (!downloader.isArchive(file) && file.filename.indexOf('.exe') == -1 && file.filename.indexOf('.cmd') == -1) {
                                    inProgress = false;
                                    clamDaemon.scanDir(file); // we can't get result since clamDaemon can process multiply files
                                    resolve();
                                    return;
                                }
                                metascan.scanFile(file.sharename + '/' + file.fileid + '/' + encodeURIComponent(file.filename))
                                    .then(function (infected) {
                                        currentLookupCounter++; // attempt to scan
                                        inProgress = false;
                                        if (!infected) {
                                            clamDaemon.scanDir(file); // we can't get result since clamDaemon can process multiply files
                                            resolve();
                                            return;
                                        }
                                        api.cleanChecked(filesPath, file);
                                        resolve();
                                    })
                                    .catch(function(err) {
                                        console.error('Rescanning metascan error: ', err);
                                        if(pulledFile) {
                                            api.setFileState(pulledFile, 'rescanning_error');
                                            api.cleanChecked(filesPath, pulledFile);
                                        }
                                        currentLookupCounter++; // this may also mean attempt to scan
                                        inProgress = false;
                                        resolve(); // proceed with scanning, files with error will be rescanned later
                                    });
                            })
                            .catch(function(err) {
                                console.error('Rescanning setFileState error: ', err);
                                if(pulledFile) {
                                    api.setFileState(pulledFile, 'rescanning_error');
                                    api.cleanChecked(filesPath, pulledFile);
                                }
                                inProgress = false;
                                resolve(); // proceed with scanning, files with error will be rescanned later
                            });
                    })
                    .catch(function(err) {
                        console.error('Rescanning error: ', err);
                        if(err.file) {
                            api.setFileState(err.file, 'rescanning_error');
                            api.cleanChecked(filesPath, err.file);
                        }
                        inProgress = false;
                        resolve(); // proceed with scanning, files with error will be rescanned later
                    });
            });
    }

};
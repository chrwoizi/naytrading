var exports = module.exports = {}

var config = require('../config/envconfig');
var request = config.require('request');
var parse5 = config.require('parse5');
var xmlser = config.require('xmlserializer');
var dom = config.require('xmldom').DOMParser;

var requestTimes = {};

function sleep(millis) {
    return new Promise(function (resolve, reject) {
        setTimeout(resolve, millis);
    });
}

async function getLock(sourceType) {
    var interval = 1000 * config.downloader_throttle_seconds;
    if(!(sourceType in requestTimes)) {
        requestTimes[sourceType] = [];
    }

    var now = new Date().getTime();

    var intervalStart = now - interval;
    while (requestTimes[sourceType].length > 0 && requestTimes[sourceType][0] < intervalStart) {
        requestTimes[sourceType] = requestTimes[sourceType].slice(1);
    }

    var count = requestTimes[sourceType].length;

    if (count < config.downloader_throttle_requests) {
        requestTimes[sourceType].push(now);
        if (count > 0) {
            await sleep(interval / config.downloader_throttle_requests);
        }
        return true;
    }
    else {
        return false;
    }
}

exports.download = async function (sourceType, url, isJson, customRequest, form) {

    var start = new Date().getTime();
    while (true) {
        var lock = await getLock(sourceType);
        if (lock)
            break;

        if (new Date().getTime() - start > config.downloader_timeout_milliseconds) {
            throw new Exception("Could not get request timeslot for " + url);
        }

        await sleep(500);
    }

    var options = {
        url: url,
        proxy: config.proxy,
        timeout: config.downloader_timeout_milliseconds
    };

    var doc = await new Promise(function (resolve, reject) {

        var usingRequest = customRequest || request;

        if (form) {
            options.form = form;

            usingRequest.post(options, function (err, resp, body) {
                if (err || resp.statusCode != 200) {
                    console.log(err);
                    reject(err);
                } else {
                    resolve(body);
                }
            });
        }
        else {
            usingRequest.get(options, function (err, resp, body) {
                if (err || resp.statusCode != 200) {
                    console.log(err);
                    reject(err);
                } else {
                    resolve(body);
                }
            });
        }

    });

    if (isJson) {
        doc = JSON.parse(doc);
    }

    return doc;

}

function parseDoc(html) {
    var document = parse5.parse(html);
    var xhtml = xmlser.serializeToString(document);
    var doc = new dom().parseFromString(xhtml);
    return doc;
}

exports.downloadHtml = async function (sourceType, url, isJson, customRequest, form) {
    var body = await exports.download(sourceType, url, isJson, customRequest, form);
    return parseDoc(body);
}
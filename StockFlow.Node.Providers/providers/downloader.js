var exports = module.exports = {}

var config = require('../config/envconfig');
var request = config.require('request');
var parse5 = config.require('parse5');
var xmlser = config.require('xmlserializer');
var dom = config.require('xmldom').DOMParser;

var requestTimes = [];

function sleep(millis) {
    return new Promise(function (resolve, reject) {
        setTimeout(resolve, millis);
    });
}

async function getLock() {
    var interval = 1000 * config.downloader_throttle_seconds;

    var now = new Date().getTime();

    var intervalStart = now - interval;
    while (requestTimes.length > 0 && requestTimes[0] < intervalStart) {
        requestTimes = requestTimes.slice(1);
    }

    var count = requestTimes.length;

    if (count < config.downloader_throttle_requests) {
        requestTimes.push(now);
        if (count > 0) {
            await sleep(interval / config.downloader_throttle_requests);
        }
        return true;
    }
    else {
        return false;
    }
}

exports.download = async function(url, isJson) {

    var start = new Date().getTime();
    while (true) {
        var lock = await getLock();
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

        request.get(options, function (err, resp, body) {
            if (err || resp.statusCode != 200) {
                console.log(err);
                reject(err);
            } else {
                resolve(body);
            }
        });

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

exports.downloadHtml = async function(url, isJson) {
    var body = await exports.download(url, isJson);
    return parseDoc(body);
}
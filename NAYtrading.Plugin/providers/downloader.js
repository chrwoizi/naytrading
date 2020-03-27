const config = require('../config/envconfig');
const request = config.require('request');
const parse5 = config.require('parse5');
const xmlser = config.require('xmlserializer');
const dom = config.require('xmldom').DOMParser;

const requestTimes = {};

function sleep(millis) {
    return new Promise(function (resolve, reject) {
        setTimeout(resolve, millis);
    });
}

async function getLock(sourceType) {
    const interval = 1000 * config.downloader_throttle_seconds;
    if(!(sourceType in requestTimes)) {
        requestTimes[sourceType] = [];
    }

    const now = new Date().getTime();

    const intervalStart = now - interval;
    while (requestTimes[sourceType].length > 0 && requestTimes[sourceType][0] < intervalStart) {
        requestTimes[sourceType] = requestTimes[sourceType].slice(1);
    }

    const count = requestTimes[sourceType].length;

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

    const start = new Date().getTime();
    while (true) {
        const lock = await getLock(sourceType);
        if (lock)
            break;

        if (new Date().getTime() - start > config.downloader_timeout_milliseconds) {
            throw new Error("Could not get request timeslot for " + url);
        }

        await sleep(500);
    }

    const options = {
        url: url,
        proxy: config.proxy,
        timeout: config.downloader_timeout_milliseconds,
        followAllRedirects: true
    };

    let doc = await new Promise(function (resolve, reject) {

        const usingRequest = customRequest || request;

        if (form) {
            options.form = form;

            usingRequest.post(options, function (err, resp, body) {
                if (err || (resp && resp.statusCode != 200)) {
                    console.log((resp ? "HTTP " + resp.statusCode : "Error") + " in downloader: " + err + " - " + url);
                    reject(err || new Error("HTTP " + resp.statusCode + ": " + JSON.stringify(body).substr(0, 500)));
                } else {
                    resolve(body);
                }
            });
        }
        else {
            usingRequest.get(options, function (err, resp, body) {
                if (err || (resp && resp.statusCode != 200)) {
                    console.log((resp ? "HTTP " + resp.statusCode : "Error") + " in downloader: " + err + " - " + url);
                    reject(err || new Error("HTTP " + resp.statusCode + ": " + JSON.stringify(body).substr(0, 500)));
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
    const document = parse5.parse(html);
    const xhtml = xmlser.serializeToString(document);
    const doc = new dom().parseFromString(xhtml);
    return doc;
}

exports.downloadHtml = async function (sourceType, url, isJson, customRequest, form) {
    const body = await exports.download(sourceType, url, isJson, customRequest, form);
    return parseDoc(body);
}
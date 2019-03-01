var exports = module.exports = {}

var request = require('request');
var dateFormat = require('dateformat');
var config = require('../config/envconfig');

async function postForm(url, form) {
    return new Promise((resolve, reject) => {
        var jar = request.jar()
        request.post({ url: url, form: form, json: true, jar: jar, proxy: config.proxy, followAllRedirects: true }, (err, response, body) => {
            if (err) {
                reject(err);
                return;
            }
            if (!response) {
                reject(new Error("unknown error"));
                return;
            }
            if (response.statusCode != 200 && response.statusCode != 302) {
                reject(new Error("HTTP " + response.statusCode));
                return;
            }
            resolve({ jar: jar, body: body, statusCode: response.statusCode });
        });
    });
}

async function get(url, jar) {
    return new Promise((resolve, reject) => {
        request({ url: url, json: true, jar: jar, proxy: config.proxy }, (err, response, body) => {
            if (err) {
                reject(err);
            }
            if (!response) {
                reject(new Error("unknown error"));
            }
            if (response.statusCode != 200) {
                reject(new Error("HTTP " + response.statusCode));
            }
            resolve(body);
        });
    });
}

async function post(url, data, jar) {
    return new Promise((resolve, reject) => {
        request.post({ url: url, json: true, body: data, jar: jar, proxy: config.proxy, followAllRedirects: true }, (err, response, body) => {
            if (err) {
                reject(err);
            }
            else if (!response) {
                reject(new Error("unknown error"));
            }
            else if (response.statusCode != 200) {
                reject(new Error("HTTP " + response.statusCode));
            }
            else resolve(body);
        });
    });
}

exports.login = async function (userName, password) {
    var response = await postForm(config.naytrading_url + "/signin", { email: userName, password: password });
    var sessionCookies = response.jar.getCookies(config.naytrading_url).filter(x => x.key == "session");
    if (sessionCookies.length && sessionCookies[0].value && sessionCookies[0].value.length) {
        var jar = response.jar;
        jar.naytradingUser = userName;
        return jar;
    }
    else {
        throw new Error("Error while signing in: " + response.statusCode);
    }
};

exports.getTrades = async function (time, jar) {
    return get(config.naytrading_url + "/api/export/user/trades/" + dateFormat(time, 'yyyymmdd'), jar);
};

exports.setInstrumentWeight = async function (isinOrWkn, type, weight, jar) {
    console.log("Setting weight " + type + " of instrument " + isinOrWkn + " to " + weight + " at naytrading...");
    try {
        var response = post(config.naytrading_url + "/api/weight/" + isinOrWkn + "/" + type + "/" + weight, true, jar);
        if (response && JSON.stringify(response) == "{}") {
            console.log("Weight is set.");
        }
        else {
            throw new Error(response ? JSON.stringify(response) : "[empty response]");
        }
    }
    catch (error) {
        console.log("Error while setting instrument weight: " + error.message + "\n" + error.stack);
        throw error;
    }
};

exports.getOpenSuggestions = async function (jar) {
    try {
        var response = await get(config.naytrading_url + "/api/trader/suggestions", jar);
        if (response && response.length >= 0) {
            return response;
        }
        else {
            throw new Error(response ? JSON.stringify(response) : "[empty response]");
        }
    }
    catch (error) {
        console.log("Error while loading open suggestions: " + error.message + "\n" + error.stack);
        throw error;
    }
};

exports.hasNewerSuggestion = async function (suggestionId, jar) {
    try {
        var response = await get(config.naytrading_url + "/api/trader/suggestion/" + suggestionId + "/newer", jar);
        if (response && typeof(response.hasNewerSuggestion) !== 'undefined') {
            return response.hasNewerSuggestion;
        }
        else {
            throw new Error(response ? JSON.stringify(response) : "[empty response]");
        }
    }
    catch (error) {
        console.log("Error while checking for newer suggestion: " + error.message + "\n" + error.stack);
        throw error;
    }
};

exports.saveTradeLog = async function (log, jar) {
    try {
        var response = await post(config.naytrading_url + "/api/trader/log", log, jar);
        if (response && response.ID >= 0) {
            return response.ID;
        }
        else {
            throw new Error(response ? JSON.stringify(response) : "[empty response]");
        }
    }
    catch (error) {
        console.log("Error while saving log for suggestion: " + error.message + "\n" + error.stack);
        throw error;
    }
}
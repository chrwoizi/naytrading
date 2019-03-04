var exports = module.exports = {}

var config = require('../config/envconfig');
var broker = require('../clients/broker');
var Cryptr = require('cryptr');
var fs = require('fs');
var crypto = require('crypto');

var tanListsByUser = {};

exports.setTanList = async function (userName, tans) {
    await exports.validateTanList(tans);
    tanListsByUser[userName] = tans;
};

exports.getTan = async function (userName, challenge) {
    var tans = tanListsByUser[userName];
    if (tans) {
        return await broker.getTan(config.broker_name, tans, challenge);
    } else {
        throw new Error("tan list is not unlocked");
    }
};

exports.isTanListSet = function (userName) {
    var tans = tanListsByUser[userName];
    if (tans) {
        return true;
    } else {
        return false;
    }
};

exports.validateTanList = async function (tans) {

    if (!(tans)) {
        throw new Error("tan list is empty");
    }

    await broker.validateTanList(config.broker_name, tans);
};

exports.setPassword = async function (userName, password) {
    var cipher = await exports.getEncryptedTanList(userName);
    if (!cipher) {
        throw new Error("tan list is not set");
    }
    var tan = new Cryptr(password).decrypt(cipher);
    try {
        await exports.validateTanList(tan);
    }
    catch (e) {
        throw new Error("password is invalid");
    }

    await exports.setTanList(userName, tan);
}

exports.getEncryptedTanList = async function (user) {
    var userHash = crypto.createHash('md5').update(user).digest('hex');

    try {
        return fs.readFileSync(__dirname + "/../../tans/" + userHash);
    }
    catch (error) {
        return null;
    }
}

exports.setEncryptedTanList = async function (user, encryptedTanList) {
    var userHash = crypto.createHash('md5').update(user).digest('hex');

    try {
        var dir = __dirname + "/../../tans";
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        fs.writeFileSync(dir + "/" + userHash, encryptedTanList);
    }
    catch (error) {
        throw new Error("tan list could not be set");
    }
}
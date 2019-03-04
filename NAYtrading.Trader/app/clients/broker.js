var exports = module.exports = {}

var config = require('../config/envconfig');

var brokerNames = Object.keys(config.brokers);
var brokers = {};
for (var i = 0; i < brokerNames.length; ++i) {
    var brokerName = brokerNames[i];
    var broker = require(config.brokers[brokerName]);
    if (broker) {
        brokers[brokerName] = broker;
    }
}

exports.brokerNames = brokerNames;
exports.brokers = brokers;

exports.getActionBuy = function (brokerName) {
    return brokers[brokerName].action_buy;
}

exports.getActionSell = function (brokerName) {
    return brokers[brokerName].action_sell;
}

exports.login = async function (brokerName, driver, user, password) {
    return await brokers[brokerName].login(driver, user, password);
};

exports.getAvailableFunds = async function (brokerName, driver) {
    return await brokers[brokerName].getAvailableFunds(driver);
};

exports.getOwnedQuantity = async function (brokerName, driver, isin, wkn) {
    return await brokers[brokerName].getOwnedQuantity(driver, isin, wkn);
}

exports.getPrice = async function (brokerName, driver, isinOrWkn, action) {
    return await brokers[brokerName].getPrice(driver, isinOrWkn, action);
};

exports.getTanChallenge = async function (brokerName, driver, quantity, action) {
    return await brokers[brokerName].getTanChallenge(driver, quantity, action);
};

exports.getQuote = async function (brokerName, driver, tan) {
    return await brokers[brokerName].getQuote(driver, tan);
};

exports.placeOrder = async function (brokerName, driver) {
    return await brokers[brokerName].placeOrder(driver);
};

exports.logout = async function (brokerName, driver) {
    return await brokers[brokerName].logout(driver);
};

exports.getTan = async function (brokerName, tans, challenge) {
    return await brokers[brokerName].getTan(tans, challenge);
};

exports.validateTanList = async function (brokerName, tans) {
    return await brokers[brokerName].validateTanList(tans);
};
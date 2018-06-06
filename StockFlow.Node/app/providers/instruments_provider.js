var exports = module.exports = {}

var config = require('../config/envconfig');
var instrumentsProvider = require(config.instruments_provider);

exports.source = instrumentsProvider.source;

exports.getAllInstruments = async function (minCapitalization) {
    return await instrumentsProvider.getAllInstruments(minCapitalization);
};

exports.getInstrumentByUrl = async function (url) {    
    return await instrumentsProvider.getInstrumentByUrl(url);
};

exports.getIsinWknByInstrumentId = async function (instrumentId) {    
    return await instrumentsProvider.getIsinWknByInstrumentId(instrumentId);
};

var exports = module.exports = {}

var config = require('../config/envconfig');
var ratesProvider = require(config.rates_provider);

exports.market_not_found = ratesProvider.market_not_found;
exports.invalid_response = ratesProvider.invalid_response;

exports.getRates = async function(instrumentId, preferredMarketId, startTime, endTime) {
    return ratesProvider.getRates(instrumentId, preferredMarketId, startTime, endTime);
}
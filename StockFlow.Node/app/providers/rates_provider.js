var exports = module.exports = {}

var config = require('../config/envconfig');

var sources = Object.keys(config.rates_providers);
var providers = {};
for (var i = 0; i < sources.length; ++i) {
    var source = sources[i];
    var provider = require(config.rates_providers[source]);
    if (provider) {
        providers[source] = provider;
    }
}

exports.market_not_found = "market not found";
exports.invalid_response = "invalid response";

exports.getRates = async function (source, instrumentId, preferredMarketId, startTime, endTime) {
    if (providers[source]) {
        var rates = await providers[source].getRates(source, instrumentId, preferredMarketId, startTime, endTime);
        if (rates) {
            rates.Source = source;
        }
        return rates;
    }
    else {
        return null;
    }
}
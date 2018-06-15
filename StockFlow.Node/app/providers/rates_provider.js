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

exports.sources = sources;
exports.providers = providers;
exports.market_not_found = "market not found";
exports.invalid_response = "invalid response";

exports.getRates = async function (source, instrumentId, preferredMarketId, startTime, endTime, checkRates) {
    if (providers[source]) {

        var marketIds = providers[source].markets;
        if (preferredMarketId != null && typeof (preferredMarketId) === 'string' && preferredMarketId.length > 0) {

            var index = marketIds.indexOf(preferredMarketId);
            if (index > -1) {
                // remove known market from list
                marketIds.splice(index, 1);
            }

            // push known market to front of list
            marketIds.unshift(preferredMarketId);
        }

        for (var m = 0; m < marketIds.length; ++m) {
            var marketId = marketIds[m];

            ratesResponse = await providers[source].getRates(source, instrumentId, marketId, startTime, endTime);

            if (ratesResponse.Rates && ratesResponse.Rates.length > 0 && await checkRates(ratesResponse.Rates)) {
                ratesResponse.Source = source;
                ratesResponse.MarketId = marketId;
                break;
            }

            if (ratesResponse.MarketIds) {
                // remove markets that dont exist
                marketIds = marketIds.filter(x => ratesResponse.MarketIds.indexOf(x) > -1);
                m = marketIds.indexOf(marketId);
            }

            // try next market or abort if none left
            if (m < marketIds.length - 1) {
                continue;
            }
            else {
                throw exports.market_not_found;
            }
        }

        return ratesResponse;
    }
    else {
        return null;
    }
}

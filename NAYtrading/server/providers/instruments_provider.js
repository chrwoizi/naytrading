
const config = require('../config/envconfig');

const sources = Object.keys(config.instruments_providers);
const providers = {};
for (let i = 0; i < sources.length; ++i) {
    const source = sources[i];
    const provider = require(config.instruments_providers[source]);
    if (provider) {
        providers[source] = provider;
    }
}

exports.sources = sources;
exports.providers = providers;
exports.market_not_found = "market not found";
exports.invalid_response = "invalid response";

exports.getAllInstruments = async function (source, minCapitalization) {
    if (source) {
        if (providers[source]) {
            return await providers[source].getAllInstruments(source, minCapitalization);
        }
        else {
            return [];
        }
    }
    else {
        const result = [];
        for (let i = 0; i < sources.length; ++i) {
            const instruments = await providers[sources[i]].getAllInstruments(sources[i], minCapitalization);
            if (instruments && instruments.length > 0) {
                for (let k = 0; k < instruments.length; ++k) {
                    result.push(instruments[k]);
                }
            }
        }
        return result;
    }
};

exports.getInstrumentByUrl = async function (source, url) {
    if (source) {
        if (providers[source]) {
            return await providers[source].getInstrumentByUrl(source, url);
        }
        else {
            return null;
        }
    }
    else {
        for (let i = 0; i < sources.length; ++i) {
            const instrument = await providers[sources[i]].getInstrumentByUrl(sources[i], url);
            if (instrument) {
                return instrument;
            }
        }
    }
};

exports.getIsinWkn = async function (source, instrumentId) {
    if (providers[source]) {
        return await providers[source].getIsinWkn(source, instrumentId);
    }
    else {
        return null;
    }
};

exports.getInstrumentId = async function (source, isin, wkn) {
    if (providers[source]) {
        return await providers[source].getInstrumentId(source, isin, wkn);
    }
    else {
        return null;
    }
};

exports.updateInstruments = async function (source, sql) {
    if (providers[source]) {
        return await providers[source].updateInstruments(source, sql);
    }
};

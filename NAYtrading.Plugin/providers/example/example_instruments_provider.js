var exports = module.exports = {}

var config = require('../../config/envconfig');
var downloader = require('../downloader');

exports.source = "e";
exports.market_not_found = "market not found";
exports.invalid_response = "invalid response";

exports.getAllInstruments = async function (source, minCapitalization) {
    if (source != exports.source)
        throw new Error("invalid source");

    // TODO load instruments

    return [{
        sources: [{
            SourceType: exports.source,
            SourceId: "example_1",
            MarketId: null,
            Status: "ACTIVE"
        }],
        InstrumentName: "example",
        Capitalization: 42,
        Isin: "example",
        Wkn: "example"
    }];
};

exports.getInstrumentByUrl = async function (source, url) {
    if (source != exports.source)
        throw new Error("invalid source");

    var doc = await downloader.downloadHtml(source, url);

    // TODO extract values from doc

    var instrument = {
        sources: [{
            SourceType: exports.source,
            SourceId: "example_1",
            MarketId: null,
            Status: "ACTIVE"
        }],
        InstrumentName: "example",
        Capitalization: 42,
        Isin: "example",
        Wkn: "example"
    };

    return instrument;
};

exports.getIsinWkn = async function (source, instrumentId) {
    if (source != exports.source)
        throw new Error("invalid source");

    // TODO load values

    return {
        Isin: "example",
        Wkn: "example"
    };
};

exports.getInstrumentId = async function (source, isin, wkn) {
    if (source != exports.source)
        throw new Error("invalid source");

    // TODO load value

    return "example";
};

exports.updateInstruments = async function (source, sql) {
    if (source != exports.source)
        throw new Error("invalid source");

    // TODO cleanup the instrument sources
};
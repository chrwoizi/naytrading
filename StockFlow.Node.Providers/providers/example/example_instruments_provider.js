var exports = module.exports = {}

var config = require('../../config/envconfig');
var downloader = require('../downloader');

exports.source = "e";

exports.getAllInstruments = async function (minCapitalization) {

    // TODO load instruments

    return [{
        Source: exports.source,
        InstrumentName: "example",
        InstrumentId: "example_1",
        Capitalization: 42,
        Isin: "example",
        Wkn: "example"
    }];
};

exports.getInstrumentByUrl = async function (url) {

    var doc = await downloader.downloadHtml(url);

    // TODO extract values from doc

    var instrument = {
        Source: exports.source,
        InstrumentName: "example",
        InstrumentId: "example_1",
        Capitalization: 42,
        Isin: "example",
        Wkn: "example"
    };

    return instrument;
};

exports.getIsinWknByInstrumentId = async function (instrumentId) {

    // TODO load values

    return {
        Isin: "example",
        Wkn: "example"
    };
};

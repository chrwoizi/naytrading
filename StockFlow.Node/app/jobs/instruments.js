var exports = module.exports = {}
var model = require('../models/index');
var sequelize = require('sequelize');
var sql = require('../sql/sql');
var instrumentsProvider = require('../providers/instruments_provider');
var config = require('../config/envconfig');
var settings = require('../config/settings');


async function updateGlobalInstruments() {
    var allInstruments = await instrumentsProvider.getAllInstruments(null, config.job_instruments_min_capitalization);

    var knownInstruments = await model.instrument.findAll({});

    function getKey(source) {
        return source.SourceType + "/" + source.SourceId;
    }

    function containsAny(refList, itemList) {
        for (var i = 0; i < itemList.length; ++i) {
            if (refList.indexOf(itemList[i]) >= 0) {
                return true;
            }
        }
    }

    var knownKeys = knownInstruments.map(i => i.sources.map(getKey));

    var newInstruments = allInstruments.filter(i => !containsAny(knownKeys, i.sources.map(getKey)));

    for (var i = 0; i < newInstruments.length; ++i) {
        var instrument = newInstruments[i];
        await model.instrument.create(instrument, {
            include: [{
                model: model.source
            }]
        });
    }
}

exports.run = async function () {
    try {

        if (settings.get("update_instruments") == "true") {
            await settings.set("update_instruments", "false");
            await updateGlobalInstruments();
        }

    }
    catch (error) {
        console.log("error in instruments job: " + error);
    }

    setTimeout(exports.run, config.job_instruments_interval_seconds * 1000);
};
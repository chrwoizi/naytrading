var exports = module.exports = {}
var model = require('../models/index');
var sequelize = require('sequelize');
var sql = require('../sql/sql');
var instrumentsProvider = require('../providers/instruments_provider');
var config = require('../config/envconfig');
var settings = require('../config/settings');


async function updateGlobalInstruments() {
    var allInstruments = await instrumentsProvider.getAllInstruments(config.job_instruments_min_capitalization);

    var knownInstruments = await model.instrument.findAll({});

    var knownIds = knownInstruments.filter(x => x.Source == instrumentsProvider.source).map(x => x.InstrumentId);

    var newInstruments = allInstruments.filter(x => knownIds.indexOf(x.InstrumentId) == -1);

    for (var i = 0; i < newInstruments.length; ++i) {
        var instrument = newInstruments[i];
        instrument.Strikes = 0;
        instrument.LastStrikeTime = new Date();
        await model.instrument.create(instrument);
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
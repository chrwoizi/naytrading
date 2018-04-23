var exports = module.exports = {}
var model = require('../models/index');
var sequelize = require('sequelize');
var sql = require('../sql/sql');
var***REMOVED***= require('../providers***REMOVED***);
var config = require('../config/envconfig');


async function updateGlobalInstruments() {
    var allInstruments = await***REMOVED***getAllInstruments(config.job_instruments_min_capitalization);

    var knownInstruments = await model.instrument.findAll({
        where: {
            User: null
        }
    });

    var knownIds = knownInstruments.filter(x => x.Source ==***REMOVED***source).map(x => x.InstrumentId);

    var newInstruments = allInstruments.filter(x => knownIds.indexOf(x.InstrumentId) == -1);

    for (var i = 0; i < newInstruments.length; ++i) {
        var instrument = newInstruments[i];
        instrument.User = null;
        instrument.Strikes = 0;
        instrument.LastStrikeTime = new Date();
        await model.instrument.create(instrument);
    }
}

exports.run = async function () {
    try {

        var result = await sql.query("SELECT COUNT(*) AS Count FROM instruments AS instrument WHERE instrument.User IS NULL");
        
        if (result[0].Count == 0) {
            await updateGlobalInstruments();
        }
                
    }
    catch (error) {
        console.log("error in instruments job: " + error);
    }

    setTimeout(exports.run, config.job_instruments_interval_seconds * 1000);
};
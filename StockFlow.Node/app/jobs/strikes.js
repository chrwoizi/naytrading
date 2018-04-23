var exports = module.exports = {}
var model = require('../models/index');
var sequelize = require('sequelize');
var sql = require('../sql/sql');
var***REMOVED***= require('../providers***REMOVED***);
var config = require('../config/envconfig');


exports.run = async function () {
    try {

        await sql.query("UPDATE instruments AS instrument SET instrument.Strikes = instrument.Strikes - 1, instrument.LastStrikeTime = NOW() WHERE instrument.Strikes > 0 AND instrument.LastStrikeTime <= @lastStrikeTime", {
            "@lastStrikeTime": new Date(new Date().getTime() - config.job_strikes_cooldown_seconds)
        });
                
    }
    catch (error) {
        console.log("error in strikes job: " + error);
    }

    setTimeout(exports.run, config.job_strikes_interval_seconds * 1000);
};
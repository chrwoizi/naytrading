var exports = module.exports = {}
var model = require('../models/index');
var sequelize = require('sequelize');
var sql = require('../sql/sql');
var***REMOVED***= require('../providers***REMOVED***);
var config = require('../config/envconfig');


exports.run = async function () {
    try {

        var isin = await sql.query("UPDATE instruments i INNER JOIN instruments g ON g.InstrumentId = i.InstrumentID AND g.Source = i.Source AND g.ID <> i.ID AND i.Isin IS NULL AND g.Isin IS NOT NULL SET i.Isin = g.Isin");
        var wkn = await sql.query("UPDATE instruments i INNER JOIN instruments g ON g.InstrumentId = i.InstrumentID AND g.Source = i.Source AND g.ID <> i.ID AND i.Wkn IS NULL AND g.Wkn IS NOT NULL SET i.Wkn = g.Wkn");
        var affectedRows = isin.affectedRows + wkn.affectedRows;
        if (affectedRows > 0) {
            console.log("Updated ISIN/WKN on " + affectedRows + " instruments");
        }
    }
    catch (error) {
        console.log("error in isin/wkn job: " + error);
    }

    setTimeout(exports.run, config.job_isinwkn_interval_seconds * 1000);
};
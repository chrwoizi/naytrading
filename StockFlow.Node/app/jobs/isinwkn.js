var exports = module.exports = {}
var model = require('../models/index');
var sequelize = require('sequelize');
var sql = require('../sql/sql');
var***REMOVED***= require('../providers***REMOVED***);
var config = require('../config/envconfig');


exports.run = async function () {
    try {

        var isinIds = await sql.query("SELECT i.ID FROM instruments i INNER JOIN instruments g ON g.InstrumentId = i.InstrumentID AND g.Source = i.Source AND g.ID <> i.ID AND i.Isin IS NULL AND g.Isin IS NOT NULL");
        var wknIds = await sql.query("SELECT i.ID FROM instruments i INNER JOIN instruments g ON g.InstrumentId = i.InstrumentID AND g.Source = i.Source AND g.ID <> i.ID AND i.Wkn IS NULL AND g.Wkn IS NOT NULL");
        
        for (var i = 0; i < isinIds.length; ++i) {
            var isin = await sql.query("UPDATE instruments i INNER JOIN instruments g ON g.InstrumentId = i.InstrumentID AND g.Source = i.Source AND g.ID <> i.ID AND i.Isin IS NULL AND g.Isin IS NOT NULL AND i.ID = @id SET i.Isin = g.Isin", {
                id: isinIds[i].ID
            });
            var affectedRows = isin.affectedRows;
            if (affectedRows > 0) {
                console.log("Updated ISIN of instrument " + isinIds[i].ID);
            }
        }

        for (var i = 0; i < isinIds.length; ++i) {
            var wkn = await sql.query("UPDATE instruments i INNER JOIN instruments g ON g.InstrumentId = i.InstrumentID AND g.Source = i.Source AND g.ID <> i.ID AND i.Wkn IS NULL AND g.Wkn IS NOT NULL AND i.ID = @id SET i.Wkn = g.Wkn", {
                id: isinIds[i].ID
            });
            var affectedRows = wkn.affectedRows;
            if (affectedRows > 0) {
                console.log("Updated WKN of instrument " + isinIds[i].ID);
            }
        }
    }
    catch (error) {
        console.log("error in isin/wkn job: " + error);
    }

    setTimeout(exports.run, config.job_isinwkn_interval_seconds * 1000);
};
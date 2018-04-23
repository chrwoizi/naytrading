var exports = module.exports = {}
var model = require('../models/index');
var sequelize = require('sequelize');
var dateFormat = require('dateformat');
var***REMOVED***= require('../providers***REMOVED***);
var sql = require('../sql/sql');
var fs = require('fs');
var config = require('../config/envconfig');

var copy_sql = "";
try {
    copy_sql = fs.readFileSync(__dirname + '/../sql/copy_instruments.sql', 'utf8');
} catch (e) {
    console.log('Error:', e.stack);
}


function getInstrumentViewModel(instrument) {
    return {
        ID: instrument.ID,
        InstrumentName: instrument.InstrumentName,
        Capitalization: instrument.Capitalization > 0 ? Math.floor(instrument.Capitalization) : null,
    };
}

exports.addDefault = async function (req, res) {
    try {
        if (req.isAuthenticated()) {

            var result = await sql.query(copy_sql, {
                "@userName": req.user.email
            });

            res.status(200);
            res.json({ added: result.affectedRows });
        }
        else {
            res.status(401);
			res.json({ error: "unauthorized" });
        }
    }
    catch (error) {
        res.status(500);
        res.json({ error: error.message });
    }
}

exports.addUrl = async function (req, res) {
    try {
        if (req.isAuthenticated()) {

            var instrument = await***REMOVED***getInstrumentByUrl(req.params.url);

            var knownInstruments = await model.instrument.findAll({
                where: {
                    User: req.user.email,
                    Source:***REMOVED***source,
                    InstrumentId: instrument.InstrumentId
                }
            });

            if (knownInstruments.length == 0) {
                instrument.User = req.user.email;
                await model.instrument.create(instrument);
                res.status(200);
                res.json({ added: 1 });
            }
            else {
                res.status(200);
                res.json({ added: 0 });
            }
            
        }
        else {
            res.status(401);
			res.json({ error: "unauthorized" });
        }
    }
    catch (error) {
        res.status(500);
        res.json({ error: error.message });
    }
}

exports.instruments = async function (req, res) {
    try {
        if (req.isAuthenticated()) {

            var instruments = await model.instrument.findAll({
                where: {
                    User: req.user.email
                },
                order: [['Capitalization', 'DESC']]
            });

            res.json(instruments.map(getInstrumentViewModel));

        }
        else {
            res.status(401);
			res.json({ error: "unauthorized" });
        }
    }
    catch (error) {
        res.status(500);
        res.json({ error: error.message });
    }
}

exports.instrument = async function (req, res) {
    try {
        if (req.isAuthenticated()) {

            await model.instrument.find({
                where: {
                    ID: req.params.id,
                    User: req.user.email
                }
            });

            if (instrument) {
                res.json(instrument.map(getInstrumentViewModel));
            }
            else {
                res.status(404);
                res.json({ error: 'instrument not found' });
            }
        }
        else {
            res.status(401);
			res.json({ error: "unauthorized" });
        }
    }
    catch (error) {
        res.status(500);
        res.json({ error: error.message });
    }
}

exports.clearDefaultInstruments = async function (req, res) {
    try {

        if (req.params.importSecret == config.import_secret) {

            var result = await sql.query('DELETE instrument FROM instruments AS instrument WHERE instrument.User IS NULL');
            
            res.status(200);
            res.json({ deleted: result.affectedRows });

        }
        else {
            res.status(401);
            res.json({ error: "unauthorized" });
        }

    }
    catch (error) {
        res.status(500);
        res.json({ error: error.message });
    }
}
var exports = module.exports = {}
var model = require('../models/index');
var sequelize = require('sequelize');
var dateFormat = require('dateformat');
var***REMOVED***= require('../providers***REMOVED***);

exports.addIndex = async function (req, res) {
    try {
        if (req.isAuthenticated()) {

            var allInstruments = await***REMOVED***getAllInstruments();
            
            var knownInstruments = await model.instrument.findAll({
                where: {
                    User: req.user.email
                }
            });

            var knownIds = knownInstruments.filter(x => x.Source ==***REMOVED***source).map(x => x.InstrumentId);

            var newInstruments = allInstruments.filter(x => knownIds.indexOf(x.InstrumentId) == -1);

            for (var i = 0; i < newInstruments.length; ++i) {
                var instrument = newInstruments[i];
                instrument.User = req.user.email;
                await model.instrument.create(instrument);
            }

            res.json(JSON.stringify({ added: newInstruments.length }));
            res.status(200);
        }
        else {
            res.status(401);
        }
    }
    catch (error) {
        res.json(JSON.stringify({ error: error.message }));
        res.status(500);
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
                res.json(JSON.stringify({ added: 1 }));
                res.status(200);
            }
            else {
                res.json(JSON.stringify({ added: 0 }));
                res.status(200);
            }
            
        }
        else {
            res.status(401);
        }
    }
    catch (error) {
        res.json(JSON.stringify({ error: error.message }));
        res.status(500);
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

            res.json(instruments);

        }
        else {
            res.status(401);
        }
    }
    catch (error) {
        res.json(JSON.stringify({ error: error.message }));
        res.status(500);
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
                res.json(instrument);
            }
            else {
                res.json(JSON.stringify({ error: 'instrument not found' }));
                res.status(404);
            }
        }
        else {
            res.status(401);
        }
    }
    catch (error) {
        res.json(JSON.stringify({ error: error.message }));
        res.status(500);
    }
}

var exports = module.exports = {}
var model = require('../models/index');
var sequelize = require('sequelize');
var dateFormat = require('dateformat');
var***REMOVED***= require('../providers***REMOVED***);

function getInstrumentViewModel(instrument) {
    return {
        ID: instrument.ID,
        InstrumentName: instrument.InstrumentName,
        Capitalization: instrument.Capitalization > 0 ? Math.floor(instrument.Capitalization) : null,
    };
}

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

            res.status(200);
            res.json({ added: newInstruments.length });
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

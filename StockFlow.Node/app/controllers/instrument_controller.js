var exports = module.exports = {}
var model = require('../models/index');
var sequelize = require('sequelize');
var dateFormat = require('dateformat');
var instrumentsProvider = require('../providers/instruments_provider');
var sql = require('../sql/sql');
var fs = require('fs');
var config = require('../config/envconfig');
var settings = require('../config/settings');

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

            var instrument = await instrumentsProvider.getInstrumentByUrl(null, req.body.url);

            if (instrument && instrument.sources && instrument.sources.length > 0) {

                var knownSource = null;
                for (var i = 0; i < instrument.sources.length; ++i) {
                    knownSource = await model.source.find({
                        where: {
                            SourceType: instrument.sources[i].SourceType,
                            SourceId: instrument.sources[i].SourceId
                        }
                    });
                    if (knownSource) {
                        break;
                    }
                }

                if (knownSource) {
                    var existing = await model.userinstrument.find({
                        where: {
                            Instrument_ID: knownSource.Instrument_ID,
                            User: req.user.email
                        }
                    });
                    if (existing) {
                        res.json({ added: 0 });
                    }
                    else {
                        await model.userinstrument.create({
                            Instrument_ID: knownSource.Instrument_ID,
                            User: req.user.email
                        });
                        res.json({ added: 1 });
                    }
                }
                else {
                    var instrument = await model.instrument.create(instrument, {
                        include: [{
                            model: model.source
                        }]
                    });
                    await model.userinstrument.create({
                        Instrument_ID: instrument.ID,
                        User: req.user.email
                    });
                    res.json({ added: 1 });
                }
            }
            else {
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

            var instruments = await sql.query("SELECT i.ID, i.InstrumentName, i.Capitalization FROM instruments AS i INNER JOIN userinstruments AS u ON u.Instrument_ID = i.ID WHERE u.User = @userName ORDER BY i.Capitalization DESC",
                {
                    "@userName": req.user.email
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

            var instrument = await model.instrument.find({
                where: {
                    ID: req.params.id
                }
            });

            if (instrument) {
                res.json(getInstrumentViewModel(instrument));
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

exports.getWeight = async function (req, res) {
    try {
        if (req.isAuthenticated()) {

            var instrument = await model.instrument.find({
                where: {
                    [sequelize.Op.or]: [
                        { Isin: req.params.instrumentId },
                        { Wkn: req.params.instrumentId }
                    ]
                }
            })

            if (instrument) {

                var weight = await model.weight.find({
                    where: {
                        User: req.user.email,
                        Instrument_ID: instrument.ID,
                        Type: req.params.type
                    }
                });

                if (weight) {
                    res.json(weight.Weight);
                }
                else {
                    res.json(null);
                }
            }
            else {
                res.status(404);
                res.json({ error: "instrument not found" });
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


exports.setWeight = async function (req, res) {
    try {
        if (req.isAuthenticated()) {

            var instrument = await model.instrument.find({
                where: {
                    [sequelize.Op.or]: [
                        { Isin: req.params.instrumentId },
                        { Wkn: req.params.instrumentId }
                    ]
                }
            })

            if (instrument) {

                var weight = await model.weight.find({
                    where: {
                        User: req.user.email,
                        Instrument_ID: instrument.ID,
                        Type: req.params.type
                    }
                });

                var value = parseFloat(req.params.weight);

                if (weight) {

                    if (weight.Weight != value) {

                        await model.weight.update(
                            {
                                Weight: value
                            },
                            {
                                where: {
                                    User: req.user.email,
                                    Instrument_ID: instrument.ID,
                                    Type: req.params.type
                                }
                            }
                        );
                    }
                }
                else {

                    await model.weight.create(
                        {
                            User: req.user.email,
                            Instrument_ID: instrument.ID,
                            Type: req.params.type,
                            Weight: value
                        }
                    );
                }

                res.json({});
            }
            else {
                res.status(404);
                res.json({ error: "instrument not found" });
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

exports.updateInstruments = async function (req, res) {
    try {

        if (req.params.importSecret == config.import_secret) {

            await settings.set("update_instruments", "true");

            res.json({ status: "ok" });

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

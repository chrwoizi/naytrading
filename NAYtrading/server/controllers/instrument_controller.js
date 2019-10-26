const model = require('../models/index');
const sequelize = require('sequelize');
const instrumentsProvider = require('../providers/instruments_provider');
const sql = require('../sql/sql');
const fs = require('fs');
const config = require('../config/envconfig');
const settings = require('../config/settings');

let copy_sql = "";
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

exports.addAllInstruments = async function (userName) {
    const result = await sql.query(copy_sql, {
        "@userName": userName
    });

    return result.affectedRows;
}

exports.addDefault = async function (req, res) {
    try {
        if (req.isAuthenticated()) {

            const affectedRows = await exports.addAllInstruments(req.user.email);

            res.json({ added: affectedRows });
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
        if (req.isAuthenticated() && req.user.email == config.admin_user) {

            const instrument = await instrumentsProvider.getInstrumentByUrl(null, req.body.url);

            if (instrument && instrument.sources && instrument.sources.length > 0) {

                let knownSource = null;
                for (let i = 0; i < instrument.sources.length; ++i) {
                    knownSource = await model.source.findOne({
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
                    const existing = await model.userinstrument.findOne({
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
                    const instrument = await model.instrument.create(instrument, {
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

            const instruments = await sql.query("SELECT i.ID, i.InstrumentName, i.Capitalization FROM instruments AS i INNER JOIN userinstruments AS u ON u.Instrument_ID = i.ID WHERE u.User = @userName AND EXISTS (SELECT 1 FROM sources AS s WHERE s.Instrument_ID = i.ID AND s.Strikes <= @maxStrikes) ORDER BY i.Capitalization DESC",
                {
                    "@userName": req.user.email,
                    "@maxStrikes": config.max_strikes
                });

            res.json({ instruments: instruments.map(getInstrumentViewModel) });

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

            const instrument = await model.instrument.findOne({
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

            const instrument = await model.instrument.findOne({
                where: {
                    [sequelize.Op.or]: [
                        { Isin: req.params.instrumentId },
                        { Wkn: req.params.instrumentId }
                    ]
                }
            })

            if (instrument) {

                const weight = await model.weight.findOne({
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

            const instrument = await model.instrument.findOne({
                where: {
                    [sequelize.Op.or]: [
                        { Isin: req.params.instrumentId },
                        { Wkn: req.params.instrumentId }
                    ]
                }
            })

            if (instrument) {

                const weight = await model.weight.findOne({
                    where: {
                        User: req.user.email,
                        Instrument_ID: instrument.ID,
                        Type: req.params.type
                    }
                });

                const value = parseFloat(req.params.weight);

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

        if (req.isAuthenticated() && req.user.email == config.admin_user) {

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
};

exports.setInstrumentRates = async function (instrumentId, rates) {
    let transaction;

    try {
        transaction = await model.sequelize.transaction();

        await model.instrumentrate.destroy({
            where: {
                Instrument_ID: instrumentId
            },
            transaction: transaction
        });

        await model.instrumentrate.bulkCreate(
            rates.map(function (r) {
                return {
                    Instrument_ID: instrumentId,
                    Open: r.Open,
                    Close: r.Close,
                    High: r.High,
                    Low: r.Low,
                    Time: r.Time
                };
            }), {
                transaction: transaction
            });

        await model.instrument.update(
            {
                LastRateDate: rates[rates.length - 1].Time,
                FirstRateDate: rates[0].Time,
                Split: "FIXED",
                SplitUpdatedAt: new Date()
            },
            {
                where: {
                    ID: instrumentId
                },
                transaction: transaction
            });

        await transaction.commit();

    } catch (err) {
        await transaction.rollback();
        throw err;
    }
};
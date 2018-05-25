var exports = module.exports = {}
var model = require('../models/index');
var sql = require('../sql/sql');
var sequelize = require('sequelize');
var JSONStream = require('JSONStream');
var multiparty = require('multiparty');
var stream = require('stream');
var fs = require('fs');
var config = require('../config/envconfig');
var tools = require('./import_tools');


function getInstrumentKey(data) {
    return data.Source + '/' + data.InstrumentId;
}

function getExistingSnapshotKey(data) {
    return data.Source + '/' + data.InstrumentId + '/' + new Date(data.Time).getTime();
}

function getSnapshotKey(data) {
    return data.instrument.Source + '/' + data.instrument.InstrumentId + '/' + new Date(data.Time).getTime();
}

function prepareSnapshot(data) {

    data.Price = data.Price || data.snapshotrates[data.snapshotrates.length - 1].Close;
    data.PriceTime = data.PriceTime || data.snapshotrates[data.snapshotrates.length - 1].Time;
    data.FirstPriceTime = data.FirstPriceTime || data.snapshotrates[0].Time;

    return data;
}

function addUserSnapshot(data, instrumentsDict, user) {
    return new Promise(async (resolve, reject) => {
        try {
            var instrumentKey = getInstrumentKey(data.instrument);
            var instrument = instrumentsDict[instrumentKey];
            if (instrument) {

                var existingSnapshot = await model.snapshot.find({
                    where: {
                        Instrument_ID: instrument.ID,
                        Time: data.Time
                    }
                });

                if (existingSnapshot) {

                    await model.usersnapshot.create({
                        User: user,
                        Decision: data.Decision,
                        ModifiedTime: data.ModifiedTime,
                        Snapshot_ID: existingSnapshot.ID
                    });
                }
            }
            resolve();
        }
        catch (e) {
            reject(e);
        }
    });
}

function updateUserSnapshot(data, existing) {
    return new Promise(async (resolve, reject) => {
        try {
            var existingU = await model.usersnapshot.find({
                where: {
                    User: existing.User,
                    Snapshot_ID: existing.ID
                }
            });

            if (existingU) {
                await model.usersnapshot.update(
                    {
                        Decision: data.Decision,
                        ModifiedTime: data.ModifiedTime
                    },
                    {
                        where: {
                            ID: existingU.ID
                        }
                    });
            }

            resolve();
        }
        catch (e) {
            reject(e);
        }
    });
}

async function removeUserSnapshot(dictValue) {
    return await model.usersnapshot.destroy({
        where: {
            User: dictValue.User,
            Snapshot_ID: dictValue.ID
        }
    });
}

function addUserInstrument(data, user) {
    return new Promise(async (resolve, reject) => {
        try {
            delete data.ID;
            delete data.createdAt;
            delete data.updatedAt;
            var existingI = await model.instrument.find({
                where: {
                    Source: data.Source,
                    InstrumentId: data.InstrumentId,
                    MarketId: data.MarketId
                }
            });

            if (existingI) {
                await model.userinstrument.create({
                    User: user,
                    Instrument_ID: existingI.ID
                });
            }

            resolve();
        }
        catch (e) {
            reject(e);
        }
    });
}

function updateUserInstrument(data, existing) {
    return new Promise(async (resolve, reject) => {
        resolve();
    });
}

async function removeUserInstrument(dictValue) {
    return await model.userinstrument.destroy({
        where: {
            User: dictValue.User,
            Instrument_ID: dictValue.ID
        }
    });
}

exports.importUserInstruments = async function (req, res) {

    if (req.isAuthenticated()) {

        async function getExistingInstruments() {
            var existing = await sql.query('SELECT u.User, i.ID, i.Source, i.InstrumentId FROM instruments AS i INNER JOIN userinstruments AS u ON u.Instrument_ID = i.ID WHERE u.User = @userName',
                {
                    "@userName": req.user.email
                });
            return tools.toDictionary(existing, getInstrumentKey);
        }

        tools.importFromFormSubmit(
            req,
            res,
            getExistingInstruments,
            getInstrumentKey,
            instrument => {
                return addUserInstrument(instrument, req.user.email);
            },
            updateUserInstrument,
            removeUserInstrument);

    }
    else {
        res.status(401);
        res.json({ error: "unauthorized" });
    }
}

exports.importUserSnapshots = async function (req, res) {

    if (req.isAuthenticated()) {

        async function getExistingInstruments() {
            var existing = await sql.query('SELECT u.User, i.ID, i.Source, i.InstrumentId FROM instruments AS i INNER JOIN userinstruments AS u ON u.Instrument_ID = i.ID WHERE u.User = @userName',
                {
                    "@userName": req.user.email
                });
            return tools.toDictionary(existing, getInstrumentKey);
        }

        async function getExistingSnapshots() {
            var existing = await sql.query('SELECT u.User, s.ID, i.Source, i.InstrumentId, s.Time FROM snapshots AS s INNER JOIN usersnapshots AS u ON u.Snapshot_ID = s.ID INNER JOIN instruments AS i ON i.ID = s.Instrument_ID WHERE u.User = @userName',
                {
                    "@userName": req.user.email
                });
            return tools.toDictionary(existing, getExistingSnapshotKey);
        }

        var instrumentsDict = await getExistingInstruments();

        tools.importFromFormSubmit(
            req,
            res,
            getExistingSnapshots,
            getSnapshotKey,
            snapshot => {
                return addUserSnapshot(snapshot, instrumentsDict, req.user.email);
            },
            updateUserSnapshot,
            removeUserSnapshot,
            prepareSnapshot);

    }
    else {
        res.status(401);
        res.json({ error: "unauthorized" });
    }
}

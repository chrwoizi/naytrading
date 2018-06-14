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


function getInstrumentKeys(data) {
    return data.sources.map(x => x.SourceType + '/' + x.SourceId);
}

function getSnapshotKeys(data) {
    return data.instrument.sources.map(x => x.SourceType + '/' + x.SourceId + '/' + new Date(data.Time).getTime());
}

function getExistingInstrumentKey(data) {
    return data.SourceType + '/' + data.SourceId;
}

function getExistingSnapshotKey(data) {
    return data.SourceType + '/' + data.SourceId + '/' + new Date(data.Time).getTime();
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
            var instrumentKeys = getInstrumentKeys(data.instrument);
            var instruments = instrumentKeys.map(x => instrumentsDict[x]).filter(x => x);
            if (instruments.length > 0) {

                var existingSnapshot = await model.snapshot.find({
                    where: {
                        Instrument_ID: instruments[0].ID,
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
                        ModifiedTime: data.DecisionTime
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

            for (var i = 0; i < data.sources.length; ++i) {
                var existingSource = await model.source.find({
                    where: {
                        SourceType: data.sources[i].SourceType,
                        SourceId: data.sources[i].SourceId
                    }
                });

                if (existingSource) {
                    await model.userinstrument.create({
                        User: user,
                        Instrument_ID: existingSource.Instrument_ID
                    });
                    break;
                }
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
            var existing = await sql.query('SELECT u.User, i.ID, c.SourceType, c.SourceId FROM instruments AS i INNER JOIN userinstruments AS u ON u.Instrument_ID = i.ID INNER JOIN sources AS c ON c.Instrument_ID = i.ID WHERE u.User = @userName',
                {
                    "@userName": req.user.email
                });
            return tools.toDictionary(existing, getExistingInstrumentKey);
        }

        tools.importFromFormSubmit(
            req,
            res,
            getExistingInstruments,
            getInstrumentKeys,
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
            var existing = await sql.query('SELECT u.User, i.ID, c.SourceType, c.SourceId FROM instruments AS i INNER JOIN userinstruments AS u ON u.Instrument_ID = i.ID INNER JOIN sources AS c ON c.Instrument_ID = i.ID WHERE u.User = @userName',
                {
                    "@userName": req.user.email
                });
            return tools.toDictionary(existing, getExistingInstrumentKey);
        }

        async function getExistingSnapshots() {
            var existing = await sql.query('SELECT u.User, s.ID, c.SourceType, i.SourceId, s.Time FROM snapshots AS s INNER JOIN usersnapshots AS u ON u.Snapshot_ID = s.ID INNER JOIN instruments AS i ON i.ID = s.Instrument_ID INNER JOIN sources AS c ON c.Instrument_ID = i.ID WHERE u.User = @userName',
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
            getSnapshotKeys,
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

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

function addSnapshot(data, instrumentsDict) {
    return new Promise(async (resolve, reject) => {
        try {
            var instrumentKey = getInstrumentKey(data.instrument);
            var instrument = instrumentsDict[instrumentKey];
            if (instrument) {
                data.Instrument_ID = instrument.ID;
            }
            else {

                delete data.instrument.ID;
                delete data.instrument.createdAt;
                delete data.instrument.updatedAt;

                instrument = await model.instrument.create(data.instrument);
                instrumentsDict[instrumentKey] = instrument;

                data.Instrument_ID = instrument.ID;
            }

            delete data.ID;
            delete data.createdAt;
            delete data.updatedAt;
            for (var i = 0; i < data.snapshotrates.length; ++i) {
                delete data.snapshotrates[i].ID;
                delete data.snapshotrates[i].createdAt;
                delete data.snapshotrates[i].updatedAt;
            }

            await model.snapshot.create(data, {
                include: [{
                    model: model.snapshotrate
                }]
            });

            resolve();
        }
        catch (e) {
            reject(e);
        }
    });
}

function updateSnapshot(data, existing) {
    return new Promise(async (resolve, reject) => {
        try {
            if (data.usersnapshots) {
                for (var i = 0; i < data.usersnapshots.length; ++i) {
                    var u = data.usersnapshots[i];
                    var existingU = await model.usersnapshot.find({
                        where: {
                            User: u.User,
                            Snapshot_ID: existing.ID
                        }
                    });
                    if (existingU) {
                        await model.usersnapshot.update(
                            {
                                Decision: u.Decision,
                                ModifiedTime: u.ModifiedTime
                            },
                            {
                                where: {
                                    ID: existingU.ID
                                }
                            });
                    }
                    else {
                        await model.usersnapshot.create({
                            User: u.User,
                            Decision: u.Decision,
                            ModifiedTime: u.ModifiedTime,
                            Snapshot_ID: existing.ID
                        })
                    }
                }

                var existingUs = await sql.query('SELECT u.ID, u.User FROM usersnapshots AS u WHERE u.Snapshot_ID = @snapshotId',
                    {
                        "@snapshotId": existing.ID
                    });
                for (var i = 0; i < existingUs.length; ++i) {
                    var exists = false;
                    for (var k = 0; k < data.usersnapshots.length; ++k) {
                        if (existingUs[i].User == data.usersnapshots[k].User) {
                            exists = true;
                            break;
                        }
                    }
                    if (!exists) {
                        model.usersnapshot.destroy({
                            where: {
                                ID: existingUs[i].ID
                            }
                        })
                    }
                }

                resolve();
            }
        }
        catch (e) {
            reject(e);
        }
    });
}

async function removeSnapshot(dictValue) {
    return await model.snapshot.destroy({
        where: {
            ID: dictValue.ID
        },
        include: [{
            model: model.snapshotrate
        }]
    });
}

function addInstrument(data) {
    return new Promise(async (resolve, reject) => {
        try {
            delete data.ID;
            delete data.createdAt;
            delete data.updatedAt;
            await model.instrument.create(data);
            resolve();
        }
        catch (e) {
            reject(e);
        }
    });
}

function updateInstrument(data, existing) {
    return new Promise(async (resolve, reject) => {
        try {
            if (data.userinstruments) {
                for (var i = 0; i < data.userinstruments.length; ++i) {
                    var u = data.userinstruments[i];
                    var existingU = await model.userinstrument.find({
                        where: {
                            User: u.User,
                            Instrument_ID: existing.ID
                        }
                    });
                    if (existingU) {
                        await model.userinstrument.update(
                            {
                                Decision: u.Decision,
                                ModifiedTime: u.ModifiedTime
                            },
                            {
                                where: {
                                    ID: existingU.ID
                                }
                            });
                    }
                    else {
                        await model.userinstrument.create({
                            User: u.User,
                            Decision: u.Decision,
                            ModifiedTime: u.ModifiedTime,
                            Instrument_ID: existing.ID
                        })
                    }
                }

                var existingUs = await sql.query('SELECT u.ID, u.User FROM userinstruments AS u WHERE u.Instrument_ID = @instrumentId',
                    {
                        "@instrumentId": existing.ID
                    });
                for (var i = 0; i < existingUs.length; ++i) {
                    var exists = false;
                    for (var k = 0; k < data.userinstruments.length; ++k) {
                        if (existingUs[i].User == data.userinstruments[k].User) {
                            exists = true;
                            break;
                        }
                    }
                    if (!exists) {
                        model.userinstrument.destroy({
                            where: {
                                ID: existingUs[i].ID
                            }
                        })
                    }
                }
            }

            resolve();
        }
        catch (e) {
            reject(e);
        }
    });
}

async function removeInstrument(dictValue) {
    return await model.instrument.destroy({
        where: {
            ID: dictValue.ID
        }
    });
}

exports.importInstruments = async function (req, res) {

    if (req.params.importSecret == config.import_secret) {

        async function getExistingInstruments() {
            var existing = await sql.query('SELECT i.ID, i.Source, i.InstrumentId FROM instruments AS i');
            return tools.toDictionary(existing, getInstrumentKey);
        }

        tools.importFromFormSubmit(
            req,
            res,
            getExistingInstruments,
            getInstrumentKey,
            addInstrument,
            updateInstrument,
            removeInstrument);
    }
    else {
        res.status(401);
        res.json({ error: "unauthorized" });
    }
}

exports.importSnapshots = async function (req, res) {

    if (req.params.importSecret == config.import_secret) {

        async function getExistingInstruments() {
            var existing = await sql.query('SELECT i.ID, i.Source, i.InstrumentId FROM instruments AS i');
            return tools.toDictionary(existing, getInstrumentKey);
        }

        async function getExistingSnapshots() {
            var existing = await sql.query('SELECT s.ID, i.Source, i.InstrumentId, s.Time FROM snapshots AS s INNER JOIN instruments AS i ON i.ID = s.Instrument_ID');
            return tools.toDictionary(existing, getExistingSnapshotKey);
        }

        var instrumentsDict = await getExistingInstruments();

        tools.importFromFormSubmit(
            req,
            res,
            getExistingSnapshots,
            getSnapshotKey,
            snapshot => {
                return addSnapshot(snapshot, instrumentsDict);
            },
            updateSnapshot,
            removeSnapshot,
            prepareSnapshot);

    }
    else {
        res.status(401);
        res.json({ error: "unauthorized" });
    }
}

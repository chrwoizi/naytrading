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

function addSnapshot(data, instrumentsDict) {
    return new Promise(async (resolve, reject) => {
        try {
            var instrumentKeys = getInstrumentKeys(data.instrument);
            var instruments = instrumentKeys.map(x => instrumentsDict[x]).filter(x => x);
            if (instruments.length > 0) {
                data.Instrument_ID = instruments[0].ID;
            }
            else {

                delete data.instrument.ID;
                delete data.instrument.createdAt;
                delete data.instrument.updatedAt;

                for (var i = 0; i < data.instrument.userinstruments.length; ++i) {
                    delete data.instrument.userinstruments[i].ID;
                    delete data.instrument.userinstruments[i].createdAt;
                    delete data.instrument.userinstruments[i].updatedAt;
                }

                for (var i = 0; i < data.instrument.sources.length; ++i) {
                    delete data.instrument.sources[i].ID;
                    delete data.instrument.sources[i].createdAt;
                    delete data.instrument.sources[i].updatedAt;
                }

                instrument = await model.instrument.create(data.instrument, {
                    include: [{
                        model: model.userinstrument
                    }, {
                        model: model.source
                    }]
                });

                for(var i = 0; i < instrumentKeys.length; ++i) {
                    instrumentsDict[instrumentKeys[i]] = instrument;
                }

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

            for (var i = 0; i < data.sources.length; ++i) {
                delete data.sources[i].ID;
                delete data.sources[i].createdAt;
                delete data.sources[i].updatedAt;
            }

            for (var i = 0; i < data.userinstruments.length; ++i) {
                delete data.userinstruments[i].ID;
                delete data.userinstruments[i].createdAt;
                delete data.userinstruments[i].updatedAt;
            }

            await model.instrument.create(data, {
                include: [{
                    model: model.userinstrument
                },{
                    model: model.source
                }]
            });
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
                        });
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

    if (req.body.import_secret == config.import_secret) {

        async function getExistingInstruments() {
            var existing = await sql.query('SELECT i.ID, c.SourceType, c.SourceId FROM instruments AS i INNER JOIN sources AS c ON c.Instrument_ID = i.ID');
            return tools.toDictionary(existing, getExistingInstrumentKey);
        }

        tools.importFromFormSubmit(
            req,
            res,
            getExistingInstruments,
            getInstrumentKeys,
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

    if (req.body.import_secret == config.import_secret) {

        async function getExistingInstruments() {
            var existing = await sql.query('SELECT i.ID, c.SourceType, c.SourceId FROM instruments AS i INNER JOIN sources AS c ON c.Instrument_ID = i.ID');
            return tools.toDictionary(existing, getExistingInstrumentKey);
        }

        async function getExistingSnapshots() {
            var existing = await sql.query('SELECT s.ID, c.SourceType, c.SourceId, s.Time FROM snapshots AS s INNER JOIN instruments AS i ON i.ID = s.Instrument_ID INNER JOIN sources AS c ON c.Instrument_ID = i.ID');
            return tools.toDictionary(existing, getExistingSnapshotKey);
        }

        var instrumentsDict = await getExistingInstruments();

        tools.importFromFormSubmit(
            req,
            res,
            getExistingSnapshots,
            getSnapshotKeys,
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

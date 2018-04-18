var exports = module.exports = {}
var model = require('../models/index');
var sql = require('../sql/sql');
var sequelize = require('sequelize');
var JSONStream = require('JSONStream');
var multiparty = require('multiparty');
var stream = require('stream');
var fs = require('fs');

var env = process.env.NODE_ENV || 'development';
var config = require(__dirname + '/../config/config.json')[env];


function return500(res, e) {
    res.json(JSON.stringify({ error: e.message }));
    res.status(500);
}

async function importFromFormSubmit(req, res, getExistingEntities, getEntityKey, createEntity, destroyEntity) {
    var filePath = undefined;

    try {
        if (req.isAuthenticated()) {

            var form = new multiparty.Form();

            form.parse(req, async (error, fields, files) => {

                if (!(files.file && files.file.length == 1 && files.file[0].path && files.file[0].size > 0)) {
                    return500(res, { message: "no file received" });
                    return;
                }

                filePath = files.file[0].path;

                var existing = await getExistingEntities();
                var remaining = Object.assign({}, existing);

                var addedCount = 0;
                var removedCount = 0;
                var errors = [];

                var processor = new stream.Transform({ objectMode: true })
                processor._transform = function (data, encoding, onDone) {
                    (async (resolve, reject) => {
                        try {
                            var key = getEntityKey(data);
                            var value = existing[key];
                            if (value) {
                                delete remaining[key];
                            }
                            else {
                                await createEntity(data);
                                addedCount++;
                            }

                            onDone();
                        }
                        catch (e) {
                            errors.push(e);
                            onDone(e);
                        }
                    })();
                };

                fs.createReadStream(filePath)
                    .pipe(JSONStream.parse('*'))
                    .pipe(processor)
                    .on('finish', async () => {
                        try {
                            if (errors.length == 0) {
                                if (fields.delete && fields.delete.length == 1 && fields.delete[0] == "on") {
                                    for (var key in remaining) {
                                        if (remaining.hasOwnProperty(key)) {
                                            removedCount += await destroyEntity(remaining[key]);
                                        }
                                    }
                                }
                            }

                            res.json(JSON.stringify({ added: addedCount, removed: removedCount, errors: errors }));
                        }
                        catch (e) {
                            return500(res, e);
                        }

                        try {
                            fs.unlinkSync(filePath);
                        }
                        catch (e) { }
                    })
                    .on('error', err => {
                        return500(res, err);
                        try {
                            fs.unlinkSync(filePath);
                        }
                        catch (e) { }
                    });

            });

        }
        else {
            res.json(JSON.stringify({ error: "unauthorized" }));
            res.status(401);
        }
    }
    catch (error) {
        return500(res, error);
        if (filePath) {
            try {
                fs.unlinkSync(filePath);
            }
            catch (e) { }
        }
    }
}

function toDictionary(existing, getKey) {
    var dict = {};
    for (var i = 0; i < existing.length; ++i) {
        var item = existing[i];
        var key = getKey(item);
        dict[key] = item;
    };
    return dict;
}

exports.importUserInstruments = async function (req, res) {

    function getInstrumentKey(data) {
        return data.Source + '/' + data.InstrumentId;
    }

    async function getExistingInstruments() {
        var existing = await sql.query('SELECT instrument.ID, instrument.Source, instrument.InstrumentId FROM Instruments AS instrument WHERE instrument.User = @userName',
            {
                "@userName": req.user.email
            });
        return toDictionary(existing, getInstrumentKey);
    }
    
    async function addInstrument(data) {
        delete data.ID;
        delete data.createdAt;
        delete data.updatedAt;
        data.User = req.user.email;
        await model.instrument.create(data);
    }

    async function removeInstrument(dictValue) {
        return await model.instrument.destroy({
            where: {
                User: req.user.email,
                ID: dictValue.ID
            }
        });
    }

    importFromFormSubmit(req, res, getExistingInstruments, getInstrumentKey, addInstrument, removeInstrument);
}

exports.importUserSnapshots = async function (req, res) {

    function toDict(existing, getKey) {
        var dict = {};
        for (var i = 0; i < existing.length; ++i) {
            var item = existing[i];
            var key = getKey(item);
            dict[key] = item;
        };
        return dict;
    }

    function getInstrumentKey(data) {
        return data.Source + '/' + data.InstrumentId;
    }

    function getExistingSnapshotKey(data) {
        return data.Source + '/' + data.InstrumentId + '/' + new Date(data.Time).getTime();
    }

    function getSnapshotKey(data) {
        return data.instrument.Source + '/' + data.instrument.InstrumentId + '/' + new Date(data.Time).getTime();
    }

    async function getExistingInstruments() {
        var existing = await sql.query('SELECT instrument.ID, instrument.Source, instrument.InstrumentId FROM Instruments AS instrument WHERE instrument.User = @userName',
            {
                "@userName": req.user.email
            });
        return toDict(existing, getInstrumentKey);
    }

    async function getExistingSnapshots() {
        var existing = await sql.query('SELECT snapshot.ID, instrument.Source, instrument.InstrumentId, snapshot.Time FROM Snapshots AS snapshot INNER JOIN Instruments AS instrument ON instrument.ID = snapshot.Instrument_ID WHERE snapshot.User = @userName',
            {
                "@userName": req.user.email
            });
        return toDict(existing, getExistingSnapshotKey);
    }

    var instrumentsDict = await getExistingInstruments();

    async function addSnapshot(data) {
        var instrumentKey = getInstrumentKey(data.instrument);
        var instrument = instrumentsDict[instrumentKey];
        if (instrument) {
            data.Instrument_ID = instrument.ID;
        }
        else {

            delete data.instrument.ID;
            delete data.instrument.createdAt;
            delete data.instrument.updatedAt;
            data.instrument.User = req.user.email;

            instrument = await model.instrument.create(data.instrument);
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

        data.User = req.user.email;

        await model.snapshot.create(data, {
            include: [{
                model: model.snapshotrate
            }]
        });
    }

    async function removeSnapshot(dictValue) {
        return await model.snapshot.destroy({
            where: {
                User: req.user.email,
                ID: dictValue.ID
            },
            include: [{
                model: model.snapshotrate
            }]
        });
    }

    importFromFormSubmit(req, res, getExistingSnapshots, getSnapshotKey, addSnapshot, removeSnapshot);
}

var exports = module.exports = {}
var model = require('../models/index');
var sql = require('../sql/sql');
var sequelize = require('sequelize');
var JSONStream = require('JSONStream');
var multiparty = require('multiparty');
var stream = require('stream');
var fs = require('fs');
var config = require('../config/envconfig');


function return500(res, e) {
    res.json(JSON.stringify({ error: e.message }));
    res.status(500);
}

async function importFromFormSubmit(req, res, getExistingEntities, getEntityKey, createEntity, destroyEntity, prepareEntity) {
    var filePath = undefined;

    try {
            var form = new multiparty.Form();

            form.parse(req, async (error, fields, files) => {

                if (!(files && files.file && files.file.length == 1 && files.file[0].path && files.file[0].size > 0)) {
                    return500(res, { message: "no file received" });
                    return;
                }

                filePath = files.file[0].path;

                var existing = await getExistingEntities();
                var remaining = Object.assign({}, existing);

                var addedCount = 0;
                var removedCount = 0;
                var errors = [];

                var processor = new stream.Transform({ objectMode: true });
                processor._transform = function (data, encoding, onDone) {
                    try {
                        if(prepareEntity) {
                            prepareEntity(data);
                        }
                        var key = getEntityKey(data);
                        console.log("importing " + key);
                        var value = existing[key];
                        if (value) {
                            delete remaining[key];
                            onDone();
                        }
                        else {
                            createEntity(data).then(() => {
                                addedCount++;
                                onDone();
                            })
                            .catch(e => {
                                errors.push(e);
                                onDone(e);
                            });
                        }
                    }
                    catch (e) {
                        errors.push(e);
                        onDone(e);
                    }
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
                                            console.log("deleting " + key);
                                            removedCount += await destroyEntity(remaining[key]);
                                        }
                                    }
                                }
                            }

                            console.log("import complete. added: " + addedCount + ", removed: " + removedCount + ", errors: " + JSON.stringify(errors));
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
    // map old data format

    delete data.StartTimeString;
    delete data.TimeString;
    delete data.ModifiedTimeString;
    delete data.ModifiedDateString;
    delete data.PreviousDecision;
    delete data.PreviousBuyRate;
    delete data.PreviousTime;
    delete data.PreviousTimeString;
    
    data.instrument = data.instrument || data.Instrument;
    delete data.Instrument;

    data.snapshotrates = data.snapshotrates || data.Rates;
    delete data.Rates;
    for(var i = 0; i < data.snapshotrates.length; ++i) {
        delete data.snapshotrates[i].TimeString;
    }

    return data;
}

function addSnapshot(data, instrumentsDict) {
    return new Promise(async (resolve, reject) => {
        var instrumentKey = getInstrumentKey(data.instrument);
        var instrument = instrumentsDict[instrumentKey];
        if (instrument) {
            data.Instrument_ID = instrument.ID;
        }
        else {

            delete data.instrument.ID;
            delete data.instrument.createdAt;
            delete data.instrument.updatedAt;
            data.instrument.User = data.User;

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

        model.snapshot.create(data, {
            include: [{
                model: model.snapshotrate
            }]
        }).then(resolve);
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
        delete data.ID;
        delete data.createdAt;
        delete data.updatedAt;
        model.instrument.create(data).then(resolve);
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
            var existing = await sql.query('SELECT instrument.ID, instrument.Source, instrument.InstrumentId FROM instruments AS instrument');
            return toDictionary(existing, getInstrumentKey);
        }
        
        importFromFormSubmit(
            req,
            res,
            getExistingInstruments,
            getInstrumentKey, 
            addInstrument, 
            removeInstrument);

    }
    else {
        res.json(JSON.stringify({ error: "unauthorized" }));
        res.status(401);
    }
}

exports.importUserInstruments = async function (req, res) {

    if (req.isAuthenticated()) {

        async function getExistingInstruments() {
            var existing = await sql.query('SELECT instrument.ID, instrument.Source, instrument.InstrumentId FROM instruments AS instrument WHERE instrument.User = @userName',
                {
                    "@userName": req.user.email
                });
            return toDictionary(existing, getInstrumentKey);
        }
        
        importFromFormSubmit(
            req,
            res,
            getExistingInstruments,
            getInstrumentKey, 
            instrument => {
                instrument.User = req.user.email;    
                return addInstrument(instrument);
            }, 
            removeInstrument);

    }
    else {
        res.json(JSON.stringify({ error: "unauthorized" }));
        res.status(401);
    }
}

exports.importSnapshots = async function (req, res) {

    if (req.params.importSecret == config.import_secret) {

        async function getExistingInstruments() {
            var existing = await sql.query('SELECT instrument.ID, instrument.Source, instrument.InstrumentId FROM instruments AS instrument');
            return toDictionary(existing, getInstrumentKey);
        }

        async function getExistingSnapshots() {
            var existing = await sql.query('SELECT snapshot.ID, instrument.Source, instrument.InstrumentId, snapshot.Time FROM snapshots AS snapshot INNER JOIN instruments AS instrument ON instrument.ID = snapshot.Instrument_ID');
            return toDictionary(existing, getExistingSnapshotKey);
        }

        var instrumentsDict = await getExistingInstruments();

        importFromFormSubmit(
            req, 
            res,
            getExistingSnapshots,
            getSnapshotKey,
            snapshot => {   
                return addSnapshot(snapshot, instrumentsDict);
            }, 
            removeSnapshot,
            prepareSnapshot);

    }
    else {
        res.json(JSON.stringify({ error: "unauthorized" }));
        res.status(401);
    }
}

exports.importUserSnapshots = async function (req, res) {

    if (req.isAuthenticated()) {

        async function getExistingInstruments() {
            var existing = await sql.query('SELECT instrument.ID, instrument.Source, instrument.InstrumentId FROM instruments AS instrument WHERE instrument.User = @userName',
                {
                    "@userName": req.user.email
                });
            return toDictionary(existing, getInstrumentKey);
        }

        async function getExistingSnapshots() {
            var existing = await sql.query('SELECT snapshot.ID, instrument.Source, instrument.InstrumentId, snapshot.Time FROM snapshots AS snapshot INNER JOIN instruments AS instrument ON instrument.ID = snapshot.Instrument_ID WHERE snapshot.User = @userName',
                {
                    "@userName": req.user.email
                });
            return toDictionary(existing, getExistingSnapshotKey);
        }

        var instrumentsDict = await getExistingInstruments();

        importFromFormSubmit(
            req, 
            res,
            getExistingSnapshots,
            getSnapshotKey,
            snapshot => {
                snapshot.User = req.user.email;    
                return addSnapshot(snapshot, instrumentsDict);
            }, 
            removeSnapshot,
            prepareSnapshot);

    }
    else {
        res.json(JSON.stringify({ error: "unauthorized" }));
        res.status(401);
    }
}

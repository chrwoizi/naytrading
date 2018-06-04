var exports = module.exports = {}
var fs = require('fs');
var path = require('path');
var model = require('../models/index');
var sql = require('../sql/sql');
var fs = require('fs');
var config = require('../config/envconfig');

var trades_sql = "";
try {
    trades_sql = fs.readFileSync(__dirname + '/../sql/trades.sql', 'utf8');
} catch (e) {
    console.log('Error:', e.stack);
}


function return500(res, e) {
    res.status(500);
    res.json({ error: e.message });
}

function parseDate(str) {
    return new Date(Date.UTC(str.substr(0, 4), parseInt(str.substr(4, 2)) - 1, str.substr(6, 2)));
}

function parseTime(str) {
    return new Date(Date.UTC(str.substr(0, 4), parseInt(str.substr(4, 2)) - 1, str.substr(6, 2), str.substr(8, 2), parseInt(str.substr(10, 2)), str.substr(12, 2)));
}

exports.exportUserInstruments = async function (req, res) {
    try {
        if (req.isAuthenticated()) {

            var cancel = false;

            req.on("close", function () {
                cancel = true;
            });

            req.on("end", function () {
                cancel = true;
            });

            var ids = await sql.query('SELECT instrument.ID FROM instruments AS instrument WHERE instrument.User = @userName ORDER BY instrument.ID',
                {
                    "@userName": req.user.email
                });

            res.header('Content-disposition', 'attachment; filename=instruments.json');
            res.header('Content-type', 'application/json');

            res.write('[');

            for (var i = 0; i < ids.length && !cancel; ++i) {

                var instrument = await model.instrument.find({
                    where: {
                        ID: ids[i].ID
                    }
                });
                instrument = instrument.get({ plain: true });

                if (i > 0) {
                    res.write(',');
                }

                delete instrument.createdAt;
                delete instrument.updatedAt;

                res.write(JSON.stringify(instrument));
            }

            res.write(']');
            res.end();

            if (cancel) {
                throw { message: "client disconnected" }
            }
        }
        else {
            res.status(401);
            res.json({ error: "unauthorized" });
        }
    }
    catch (error) {
        return500(res, error);
    }
}

exports.exportUserSnapshots = async function (req, res) {
    try {
        if (req.isAuthenticated()) {

            if (typeof (req.params.fromDate) !== 'string' || !(req.params.fromDate.length == 8 || req.params.fromDate.length == 14)) {

                return500(res, { message: 'invalid date format' });
                return;
            }

            var fromDate = new Date(Date.UTC(1970, 0, 1));
            if (req.params.fromDate.length == 8) {
                fromDate = parseDate(req.params.fromDate);
            }
            else if (req.params.fromDate.length == 14) {
                fromDate = parseTime(req.params.fromDate);
            }

            var cancel = false;

            req.on("close", function () {
                cancel = true;
            });

            req.on("end", function () {
                cancel = true;
            });

            var user = req.user.email;

            res.header('Content-disposition', 'attachment; filename=usersnapshots.json');
            res.header('Content-type', 'application/json');

            await exports.exportUserSnapshotsGeneric(fromDate, user, res, () => cancel);
        }
        else {
            res.status(401);
            res.json({ error: "unauthorized" });
        }
    }
    catch (error) {
        return500(res, error);
    }
}

exports.exportUserSnapshotsGeneric = async function (fromDate, user, stream, cancel, reportProgress) {
    reportProgress(0);

    var ids = await sql.query('SELECT userSnapshot.ID FROM usersnapshots AS userSnapshot WHERE userSnapshot.User = @userName AND userSnapshot.ModifiedTime >= @fromDate ORDER BY userSnapshot.ModifiedTime',
        {
            "@userName": user,
            "@fromDate": fromDate
        });

    stream.write('[');

    for (var i = 0; i < ids.length && !cancel(); ++i) {

        reportProgress(i / ids.length);

        var usersnapshot = await model.usersnapshot.find({
            where: {
                ID: ids[i].ID
            }
        });

        var snapshot = await model.snapshot.find({
            include: [{
                model: model.instrument
            }, {
                model: model.snapshotrate
            }],
            where: {
                ID: usersnapshot.Snapshot_ID
            },
            order: [
                [model.snapshotrate, "Time", "ASC"]
            ]
        });
        snapshot = snapshot.get({ plain: true });

        for (var r = 0; r < snapshot.snapshotrates.length; ++r) {
            var rate = snapshot.snapshotrates[r];
            delete rate.ID;
            delete rate.createdAt;
            delete rate.updatedAt;
            delete rate.Snapshot_ID;
        }

        delete snapshot.instrument.createdAt;
        delete snapshot.instrument.updatedAt;

        delete snapshot.createdAt;
        delete snapshot.updatedAt;

        snapshot.DecisionId = usersnapshot.ID;
        snapshot.Decision = usersnapshot.Decision;
        snapshot.DecisionTime = usersnapshot.ModifiedTime;

        if (i > 0) {
            stream.write(',');
        }

        stream.write(JSON.stringify(snapshot));
    }

    stream.write(']');
    stream.end();

    reportProgress(1);

    if (cancel()) {
        throw { message: "cancelled" }
    }

    return ids.length;
}

exports.exportUserTrades = async function (req, res) {
    try {
        if (req.isAuthenticated()) {

            if (typeof (req.params.fromDate) !== 'string' || !(req.params.fromDate.length == 8 || req.params.fromDate.length == 14)) {

                return500(res, { message: 'invalid date format' });
                return;
            }

            var fromDate = new Date(Date.UTC(1970, 0, 1));
            if (req.params.fromDate.length == 8) {
                fromDate = parseDate(req.params.fromDate);
            }
            else if (req.params.fromDate.length == 14) {
                fromDate = parseTime(req.params.fromDate);
            }

            var cancel = false;

            req.on("close", function () {
                cancel = true;
            });

            req.on("end", function () {
                cancel = true;
            });

            var trades = await sql.query(trades_sql,
                {
                    "@userName": req.user.email,
                    "@fromDate": fromDate
                });

            res.header('Content-disposition', 'attachment; filename=trades.json');
            res.header('Content-type', 'application/json');

            res.write('[');

            for (var i = 0; i < trades.length && !cancel; ++i) {

                var trade = trades[i];

                if (i > 0) {
                    res.write(',');
                }

                res.write(JSON.stringify(trade));
            }

            res.write(']');
            res.end();

            if (cancel) {
                throw { message: "client disconnected" }
            }
        }
        else {
            res.status(401);
            res.json({ error: "unauthorized" });
        }
    }
    catch (error) {
        return500(res, error);
    }
}

function downloadFile(req, res, filename) {
    try {
        if (req.isAuthenticated()) {

            var filePath = path.resolve(config.processing_dir + "/" + req.user.email + "/" + filename);

            if (fs.existsSync(filePath)) {
                if (typeof (req.params.time) === 'string' && req.params.time.length == 14) {
                    if (fs.existsSync(filePath + ".meta")) {
                        var meta = JSON.parse(fs.readFileSync(filePath + ".meta", 'utf8'));
                        if (req.params.time != meta.time) {
                            res.redirect("/manage");
                            return;
                        }
                    }
                }

                res.download(filePath);
            }
            else {
                res.status(404);
                res.json({ error: "file does not exist" });
            }
        }
        else {
            res.status(401);
            res.json({ error: "unauthorized" });
        }
    }
    catch (error) {
        return500(res, error);
    }
}

exports.downloadBuyingTrain = async function (req, res) {
    downloadFile(req, res, "buying_train_aug_norm.csv");
}

exports.downloadBuyingTest = async function (req, res) {
    downloadFile(req, res, "buying_test_aug_norm.csv");
}

exports.downloadSellingTrain = async function (req, res) {
    downloadFile(req, res, "selling_train_aug_norm.csv");
}

exports.downloadSellingTest = async function (req, res) {
    downloadFile(req, res, "selling_test_aug_norm.csv");
}
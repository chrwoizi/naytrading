var exports = module.exports = {}
var fs = require('fs');
var path = require('path');
var model = require('../models/index');
var sequelize = require('sequelize');
var sql = require('../sql/sql');
var fs = require('fs');
var config = require('../config/envconfig');
var snapshotController = require('./snapshot_controller');

var trades_sql = "";
try {
    trades_sql = fs.readFileSync(__dirname + '/../sql/trades.sql', 'utf8');
} catch (e) {
    console.log('Error:', e.stack);
}


function return500(res, e) {
    try {
        res.status(500);
        res.json({ error: e.message });
    }
    catch (e2) {
        res.write(JSON.stringify({ error: e.message }));
        res.end();
    }
}

function parseDateUTC(str) {
    return new Date(Date.UTC(str.substr(0, 4), parseInt(str.substr(4, 2)) - 1, str.substr(6, 2)));
}

function parseTimeUTC(str) {
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

            var ids = await sql.query('SELECT i.ID FROM instruments AS i INNER JOIN userinstruments as u ON u.Instrument_ID = i.ID WHERE u.User = @userName ORDER BY i.ID',
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
                delete instrument.FirstRateDate;
                delete instrument.LastRateDate;

                res.write(JSON.stringify(instrument));
            }

            res.write(']');
            res.end();

            if (cancel) {
                throw new Error("client disconnected");
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
                fromDate = parseDateUTC(req.params.fromDate);
            }
            else if (req.params.fromDate.length == 14) {
                fromDate = parseTimeUTC(req.params.fromDate);
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

            await exports.exportUserSnapshotsGeneric(fromDate, user, res, () => cancel, x => { });
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

exports.exportUserSnapshotsGeneric = async function (fromTimeUTC, user, stream, cancel, reportProgress) {
    reportProgress(0);

    var ids = await sql.query('SELECT userSnapshot.ID FROM usersnapshots AS userSnapshot WHERE userSnapshot.User = @userName AND userSnapshot.ModifiedTime >= @fromTime ORDER BY userSnapshot.ModifiedTime',
        {
            "@userName": user,
            "@fromTime": fromTimeUTC
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
            }, {
                model: model.tradelog
            }],
            where: {
                ID: usersnapshot.Snapshot_ID
            },
            order: [
                [model.snapshotrate, "Time", "ASC"],
                [model.tradelog, "Time", "ASC"]
            ]
        });
        snapshot = snapshot.get({ plain: true });

        await snapshotController.ensureRates(snapshot);

        for (var r = 0; r < snapshot.snapshotrates.length; ++r) {
            var rate = snapshot.snapshotrates[r];
            delete rate.ID;
            delete rate.createdAt;
            delete rate.updatedAt;
            delete rate.Snapshot_ID;
            delete rate.Instrument_ID;
        }

        delete snapshot.instrument.createdAt;
        delete snapshot.instrument.updatedAt;

        delete snapshot.createdAt;
        delete snapshot.updatedAt;

        snapshot.DecisionId = usersnapshot.ID;
        snapshot.Decision = usersnapshot.Decision;
        snapshot.DecisionTime = usersnapshot.ModifiedTime;
        snapshot.Confirmed = usersnapshot.Confirmed;

        if (i > 0) {
            stream.write(',');
        }

        stream.write(JSON.stringify(snapshot));
    }

    stream.write(']');
    stream.end();

    reportProgress(1);

    if (cancel()) {
        throw new Error("cancelled");
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
                fromDate = parseDateUTC(req.params.fromDate);
            }
            else if (req.params.fromDate.length == 14) {
                fromDate = parseTimeUTC(req.params.fromDate);
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
                trade.tradelogs = await sql.query("SELECT * FROM tradelogs l WHERE l.User = @user AND l.Snapshot_ID = @snapshotId ORDER BY l.Time ASC", {
                    "@user": req.user.email,
                    "@snapshotId": trade.SnapshotId
                });

                if (i > 0) {
                    res.write(',');
                }

                res.write(JSON.stringify(trade));
            }

            res.write(']');
            res.end();

            if (cancel) {
                throw new Error("client disconnected");
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

exports.exportUserTradelogs = async function (req, res) {
    try {
        if (req.isAuthenticated()) {

            if (typeof (req.params.fromDate) !== 'string' || !(req.params.fromDate.length == 8 || req.params.fromDate.length == 14)) {

                return500(res, { message: 'invalid date format' });
                return;
            }

            var fromDate = new Date(Date.UTC(1970, 0, 1));
            if (req.params.fromDate.length == 8) {
                fromDate = parseDateUTC(req.params.fromDate);
            }
            else if (req.params.fromDate.length == 14) {
                fromDate = parseTimeUTC(req.params.fromDate);
            }

            var cancel = false;

            req.on("close", function () {
                cancel = true;
            });

            req.on("end", function () {
                cancel = true;
            });

            var tradelogs = await sql.query("SELECT l.*, i.Isin, i.Wkn, s.Time AS SnapshotTime FROM tradelogs l INNER JOIN snapshots s ON s.ID = l.Snapshot_ID INNER JOIN instruments i ON i.ID = s.Instrument_ID \
                WHERE l.User = @user AND l.Time >= @fromDate ORDER BY l.Time ASC",
                {
                    "@user": req.user.email,
                    "@fromDate": fromDate
                });

            res.header('Content-disposition', 'attachment; filename=tradelogs.json');
            res.header('Content-type', 'application/json');

            res.write('[');

            for (var i = 0; i < tradelogs.length && !cancel; ++i) {

                var tradelog = tradelogs[i];

                if (i > 0) {
                    res.write(',');
                }

                res.write(JSON.stringify(tradelog));
            }

            res.write(']');
            res.end();

            if (cancel) {
                throw new Error("client disconnected");
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
    downloadFile(req, res, "buying_train_norm.csv");
}

exports.downloadBuyingTest = async function (req, res) {
    downloadFile(req, res, "buying_test_norm.csv");
}

exports.downloadSellingTrain = async function (req, res) {
    downloadFile(req, res, "selling_train_norm.csv");
}

exports.downloadSellingTest = async function (req, res) {
    downloadFile(req, res, "selling_test_norm.csv");
}
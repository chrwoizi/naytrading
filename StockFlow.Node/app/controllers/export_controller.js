var exports = module.exports = {}
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

exports.exportInstruments = async function (req, res) {
    try {
        if (req.params.exportSecret == config.export_secret) {

            var cancel = false;

            req.on("close", function() {
                cancel = true;
            });

            req.on("end", function() {
                cancel = true;
            });

            var ids = await sql.query('SELECT instrument.ID FROM instruments AS instrument ORDER BY instrument.ID', {});

            res.header('Content-disposition', 'attachment; filename=instruments.json');
            res.header('Content-type', 'application/json');

            res.write('[');

            for (var i = 0; i < ids.length && !cancel; ++i) {

                var instrument = await model.instrument.find({
                    include: [{
                        model: model.userinstruments
                    }],
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

exports.exportSnapshots = async function (req, res) {
    try {
        if (req.params.exportSecret == config.export_secret) {

            if (typeof (req.params.fromDate) !== 'string' || !(req.params.fromDate.length == 8 || req.params.fromDate.length == 14)) {

                res.status(500);
                res.json({ error: 'invalid date format' });
                return;
            }

            var fromDate = new Date(Date.UTC(1970, 0, 1));
            if (req.params.fromDate.length == 8) {
                fromDate = new Date(Date.UTC(req.params.fromDate.substr(0, 4), parseInt(req.params.fromDate.substr(4, 2)) - 1, req.params.fromDate.substr(6, 2)));
            }
            else if (req.params.fromDate.length == 14) {
                fromDate = new Date(Date.UTC(req.params.fromDate.substr(0, 4), parseInt(req.params.fromDate.substr(4, 2)) - 1, req.params.fromDate.substr(6, 2),
                    req.params.fromDate.substr(8, 2), parseInt(req.params.fromDate.substr(10, 2)), req.params.fromDate.substr(12, 2)));
            }

            var cancel = false;

            req.on("close", function() {
                cancel = true;
            });

            req.on("end", function() {
                cancel = true;
            });

            var ids = await sql.query('SELECT snapshot.ID FROM snapshots AS snapshot WHERE snapshot.Time >= @fromDate ORDER BY snapshot.Time',
                {
                    "@fromDate": fromDate
                });

            res.header('Content-disposition', 'attachment; filename=snapshots.json');
            res.header('Content-type', 'application/json');

            res.write('[');

            for (var i = 0; i < ids.length && !cancel; ++i) {

                var snapshot = await model.snapshot.find({
                    include: [{
                        model: model.instrument
                    }, {
                        model: model.snapshotrate
                    }, {
                        model: model.usersnapshot
                    }],
                    where: {
                        ID: ids[i].ID
                    },
                    order: [
                        [model.snapshotrate, "Time", "ASC"],
                        [model.usersnapshot, "ModifiedTime", "ASC"]
                    ]
                });

                snapshot = snapshot.get({ plain: true });

                for (var r = 0; r < snapshot.snapshotrates.length; ++r) {
                    var rate = snapshot.snapshotrates[r];
                    delete rate.createdAt;
                    delete rate.updatedAt;
                    delete rate.Snapshot_ID;
                }

                for (var r = 0; r < snapshot.usersnapshots.length; ++r) {
                    var u = snapshot.usersnapshots[r];
                    delete u.ID;
                    delete u.createdAt;
                    delete u.updatedAt;
                    delete u.Snapshot_ID;
                }

                delete snapshot.instrument.createdAt;
                delete snapshot.instrument.updatedAt;

                delete snapshot.createdAt;
                delete snapshot.updatedAt;
                
                if (i > 0) {
                    res.write(',');
                }

                res.write(JSON.stringify(snapshot));
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

exports.exportLog = async function (req, res) {
    try {
        if (req.isAuthenticated() && req.user.email == config.admin_user) {

            res.download(__dirname + '/../../' + config.log_path);

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

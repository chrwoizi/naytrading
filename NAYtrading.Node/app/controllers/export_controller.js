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
    try {
        res.status(500);
        res.json({ error: e.message });
    }
    catch (e2) {
        res.write(JSON.stringify({ error: e.message }));
        res.end();
    }
}

exports.exportInstruments = async function (req, res) {
    try {
        if (req.isAuthenticated() && req.user.email == config.admin_user) {

            var cancel = false;

            req.on("close", function () {
                cancel = true;
            });

            req.on("end", function () {
                cancel = true;
            });

            var ids = await sql.query('SELECT instrument.ID FROM instruments AS instrument ORDER BY instrument.ID', {});

            res.header('Content-disposition', 'attachment; filename=instruments.json');
            res.header('Content-type', 'application/json');

            res.write('[');

            for (var i = 0; i < ids.length && !cancel; ++i) {

                var instrument = await model.instrument.find({
                    include: [{
                        model: model.userinstrument
                    }, {
                        model: model.source
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

                for (var k = 0; k < instrument.userinstruments; ++k) {
                    delete instrument.userinstruments[k].createdAt;
                    delete instrument.userinstruments[k].updatedAt;
                }

                for (var k = 0; k < instrument.sources; ++k) {
                    delete instrument.sources[k].createdAt;
                    delete instrument.sources[k].updatedAt;
                }

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

exports.exportSnapshots = async function (req, res) {
    try {
        if (req.isAuthenticated() && req.user.email == config.admin_user) {

            if (typeof (req.params.fromDate) !== 'string' || !(req.params.fromDate.length == 8 || req.params.fromDate.length == 14)) {

                res.status(500);
                res.json({ error: 'invalid date format' });
                return;
            }

            var fromDate = new Date(1970, 0, 1);
            if (req.params.fromDate.length == 8) {
                fromDate = new Date(req.params.fromDate.substr(0, 4), parseInt(req.params.fromDate.substr(4, 2)) - 1, req.params.fromDate.substr(6, 2));
            }
            else if (req.params.fromDate.length == 14) {
                fromDate = new Date(req.params.fromDate.substr(0, 4), parseInt(req.params.fromDate.substr(4, 2)) - 1, req.params.fromDate.substr(6, 2),
                    req.params.fromDate.substr(8, 2), parseInt(req.params.fromDate.substr(10, 2)), req.params.fromDate.substr(12, 2));
            }

            var cancel = false;

            req.on("close", function () {
                cancel = true;
            });

            req.on("end", function () {
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
                        model: model.instrument,
                        include: [{
                            model: model.userinstrument
                        }, {
                            model: model.source
                        }]
                    }, {
                        model: model.snapshotrate
                    }, {
                        model: model.usersnapshot
                    }, {
                        model: model.tradelog
                    }],
                    where: {
                        ID: ids[i].ID
                    },
                    order: [
                        [model.snapshotrate, "Time", "ASC"],
                        [model.usersnapshot, "ModifiedTime", "ASC"],
                        [model.tradelog, "Time", "ASC"]
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
                    delete u.createdAt;
                    delete u.updatedAt;
                    delete u.Snapshot_ID;
                }

                for (var r = 0; r < snapshot.instrument.userinstruments.length; ++r) {
                    var u = snapshot.instrument.userinstruments[r];
                    delete u.createdAt;
                    delete u.updatedAt;
                    delete u.Instrument_ID;
                }

                for (var r = 0; r < snapshot.instrument.sources.length; ++r) {
                    var u = snapshot.instrument.sources[r];
                    delete u.createdAt;
                    delete u.updatedAt;
                    delete u.Instrument_ID;
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

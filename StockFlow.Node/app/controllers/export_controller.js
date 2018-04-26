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

            var ids = await sql.query('SELECT instrument.ID FROM instruments AS instrument ORDER BY instrument.ID', {});

            res.header('Content-disposition', 'attachment; filename=instruments.json');
            res.header('Content-type', 'application/json');

            res.write('[');

            for (var i = 0; i < ids.length; ++i) {

                var instrument = await model.instrument.find({
                    where: {
                        ID: ids[i].ID
                    }
                }).get({ plain: true });

                if (i > 0) {
                    res.write(',');
                }

                delete instrument.createdAt;
                delete instrument.updatedAt;
                
                res.write(JSON.stringify(instrument));
            }

            res.write(']');
            res.end();

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

exports.exportUserInstruments = async function (req, res) {
    try {
        if (req.isAuthenticated()) {

            var ids = await sql.query('SELECT instrument.ID FROM instruments AS instrument WHERE instrument.User = @userName ORDER BY instrument.ID',
                {
                    "@userName": req.user.email
                });

            res.header('Content-disposition', 'attachment; filename=instruments.json');
            res.header('Content-type', 'application/json');

            res.write('[');

            for (var i = 0; i < ids.length; ++i) {

                var instrument = await model.instrument.find({
                    where: {
                        ID: ids[i].ID
                    }
                }).get({ plain: true });

                if (i > 0) {
                    res.write(',');
                }

                delete instrument.createdAt;
                delete instrument.updatedAt;
                
                res.write(JSON.stringify(instrument));
            }

            res.write(']');
            res.end();

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

            if (typeof (req.params.fromDate) !== 'string' || req.params.fromDate.length != 8) {

                res.status(500);
                res.json({ error: 'invalid date format' });
                return;
            }

            var fromDate = new Date(req.params.fromDate.substr(0, 4), parseInt(req.params.fromDate.substr(4, 2)) - 1, req.params.fromDate.substr(6, 2));

            cancel = false;

            var ids = await sql.query('SELECT snapshot.ID FROM snapshots AS snapshot WHERE snapshot.Time >= @fromDate ORDER BY snapshot.Time',
                {
                    "@fromDate": fromDate
                });

            res.header('Content-disposition', 'attachment; filename=snapshots.json');
            res.header('Content-type', 'application/json');

            res.write('[');

            for (var i = 0; i < ids.length; ++i && !cancel) {

                var snapshot = await model.snapshot.find({
                    include: [{
                        model: model.instrument
                    }, {
                        model: model.snapshotrate
                    }],
                    where: {
                        ID: ids[i].ID
                    },
                    order: [
                        [model.snapshotrate, "Time", "ASC"]
                    ]
                });

                snapshot = snapshot.get({ plain: true });

                for (var r = 0; r < snapshot.snapshotrates.length; ++r) {
                    var rate = snapshot.snapshotrates[r];
                    delete rate.createdAt;
                    delete rate.updatedAt;
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

            if (typeof (req.params.fromDate) !== 'string' || req.params.fromDate.length != 8) {

                return500(res, { message: 'invalid date format' });
                return;
            }

            var fromDate = new Date(req.params.fromDate.substr(0, 4), parseInt(req.params.fromDate.substr(4, 2)) - 1, req.params.fromDate.substr(6, 2));

            var ids = await sql.query('SELECT snapshot.ID FROM snapshots AS snapshot WHERE snapshot.User = @userName AND snapshot.Time >= @fromDate ORDER BY snapshot.Time',
                {
                    "@userName": req.user.email,
                    "@fromDate": req.params.fromDate
                });

            res.header('Content-disposition', 'attachment; filename=snapshots.json');
            res.header('Content-type', 'application/json');

            res.write('[');

            for (var i = 0; i < ids.length; ++i) {

                var snapshot = await model.snapshot.find({
                    include: [{
                        model: model.instrument
                    }, {
                        model: model.snapshotrate
                    }],
                    where: {
                        ID: ids[i].ID
                    },
                    order: [
                        [model.snapshotrate, "Time", "ASC"]
                    ]
                }).get({ plain: true });

                for (var r = 0; r < snapshot.snapshotrates.length; ++r) {
                    var rate = snapshot.snapshotrates[r];
                    delete rate.createdAt;
                    delete rate.updatedAt;
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

exports.exportUserTrades = async function (req, res) {
    try {
        if (req.isAuthenticated()) {

            if (typeof (req.params.fromDate) !== 'string' || req.params.fromDate.length != 8) {

                return500(res, { message: 'invalid date format' });
                return;
            }

            var fromDate = new Date(req.params.fromDate.substr(0, 4), parseInt(req.params.fromDate.substr(4, 2)) - 1, req.params.fromDate.substr(6, 2));

            var trades = await sql.query(trades_sql,
                {
                    "@userName": req.user.email,
                    "@fromDate": req.params.fromDate
                });

            res.header('Content-disposition', 'attachment; filename=trades.json');
            res.header('Content-type', 'application/json');

            res.write('[');

            for (var i = 0; i < trades.length; ++i) {

                var trade = trades[i];
                
                var rates = await sql.query('SELECT r.Time, r.Close FROM snapshotrates r WHERE r.Snapshot_ID = @snapshotId ORDER BY r.Time DESC LIMIT 1',
                    {
                        "@snapshotId": trade.SnapshotId
                    });
                trade.Time = rates[0].Time;
                trade.Price = rates[0].Close;

                if (i > 0) {
                    res.write(',');
                }

                res.write(JSON.stringify(trade));
            }

            res.write(']');
            res.end();

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

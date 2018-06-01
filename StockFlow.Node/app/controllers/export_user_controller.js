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
                fromDate = new Date(Date.UTC(req.params.fromDate.substr(0, 4), parseInt(req.params.fromDate.substr(4, 2)) - 1, req.params.fromDate.substr(6, 2)));
            }
            else if (req.params.fromDate.length == 14) {
                fromDate = new Date(Date.UTC(req.params.fromDate.substr(0, 4), parseInt(req.params.fromDate.substr(4, 2)) - 1, req.params.fromDate.substr(6, 2),
                    req.params.fromDate.substr(8, 2), parseInt(req.params.fromDate.substr(10, 2)), req.params.fromDate.substr(12, 2)));
            }

            var ids = await sql.query('SELECT userSnapshot.ID FROM usersnapshots AS userSnapshot WHERE userSnapshot.User = @userName AND userSnapshot.ModifiedTime >= @fromDate ORDER BY userSnapshot.ModifiedTime',
                {
                    "@userName": req.user.email,
                    "@fromDate": fromDate
                });

            res.header('Content-disposition', 'attachment; filename=usersnapshots.json');
            res.header('Content-type', 'application/json');

            res.write('[');

            for (var i = 0; i < ids.length; ++i) {

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

            if (typeof (req.params.fromDate) !== 'string' || !(req.params.fromDate.length == 8 || req.params.fromDate.length == 14)) {

                return500(res, { message: 'invalid date format' });
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

            var trades = await sql.query(trades_sql,
                {
                    "@userName": req.user.email,
                    "@fromDate": fromDate
                });

            res.header('Content-disposition', 'attachment; filename=trades.json');
            res.header('Content-type', 'application/json');

            res.write('[');

            for (var i = 0; i < trades.length; ++i) {

                var trade = trades[i];
                
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
var exports = module.exports = {}
var model = require('../models/index');
var sequelize = require('sequelize');
var sql = require('../sql/sql');
var fs = require('fs');
var config = require('../config/envconfig');
var newSnapshotController = require('../controllers/new_snapshot_controller');

var duplicates_sql = "";
try {
    duplicates_sql = fs.readFileSync(__dirname + '/../sql/duplicates.sql', 'utf8');
} catch (e) {
    console.log('Error:', e.stack);
}

var missing_rates_sql = "";
try {
    missing_rates_sql = fs.readFileSync(__dirname + '/../sql/missing_rates.sql', 'utf8');
} catch (e) {
    console.log('Error:', e.stack);
}

var late_rates_sql = "";
try {
    late_rates_sql = fs.readFileSync(__dirname + '/../sql/late_rates.sql', 'utf8');
} catch (e) {
    console.log('Error:', e.stack);
}


function groupBy(xs, key, equals) {
    return xs.reduce(function (rv, x) {
        let v = key(x);
        let el = rv.find((r) => r && equals(r.key, v));
        if (el) {
            el.values.push(x);
        } else {
            rv.push({ key: v, values: [x] });
        } return rv;
    }, []);
}

async function cleanupDuplicates() {
    var rows = await sql.query(duplicates_sql, {});

    var groups = groupBy(rows, x => {
        return {
            Instrument_ID: x.Instrument_ID,
            Time: x.Time
        };
    }, (a, b) => {
        return a.Instrument_ID == b.Instrument_ID && a.Time.substr(0, 10) == b.Time.substr(0, 10);
    });

    for (var i = 0; i < groups.length; ++i) {

        var snapshots = groups[i].values;

        for (var i = 1; i < snapshots.length; ++i) {
            console.log("deleting duplicate snapshot " + snapshots[i].ID + " for instrument " + snapshots[i].Instrument_ID);
            await model.usersnapshot.update(
                {
                    Snapshot_ID: snapshots[0].ID
                },
                {
                    where: {
                        Snapshot_ID: snapshots[i].ID
                    }
                });
            await model.snapshot.destroy({
                where: {
                    ID: snapshots[i].ID
                }
            });
        }
    }
}

async function cleanupMissingRates() {
    var rows = await sql.query(missing_rates_sql, {
        "@minRates": newSnapshotController.minDays
    });

    for (var i = 0; i < rows.length; ++i) {
        console.log("deleting snapshot " + rows[i].ID + " for instrument " + rows[i].Instrument_ID + " because of missing rates in time span");
        await model.snapshot.destroy({
            where: {
                ID: rows[i].ID
            }
        })
    }
}

async function cleanupLateBegin() {
    var rows = await sql.query(late_rates_sql, {
        "@minDays": (config.chart_period_seconds - config.discard_threshold_seconds) / 60 / 60 / 24
    });

    for (var i = 0; i < rows.length; ++i) {
        console.log("deleting snapshot " + rows[i].ID + " for instrument " + rows[i].Instrument_ID + " because first rate is late");
        await model.snapshot.destroy({
            where: {
                ID: rows[i].ID
            }
        })
    }
}

async function cleanupOldUnseen() {
    var result = await sql.query("DELETE FROM s USING snapshots AS s WHERE NOT EXISTS (SELECT 1 FROM usersnapshots AS u WHERE u.Snapshot_ID = s.ID) AND s.Time < NOW() - INTERVAL @hours HOUR", {
        "@hours": config.max_unused_snapshot_age_hours + 1
    });

    if (result.affectedRows > 0) {
        console.log("Deleted " + result.affectedRows + " unused snapshots");
    }
}

exports.run = async function () {
    try {

        await cleanupDuplicates();
        await cleanupMissingRates();
        await cleanupLateBegin();
        await cleanupOldUnseen();

    }
    catch (error) {
        console.log("error in cleanup: " + error);
    }

    setTimeout(exports.run, config.job_cleanup_interval_seconds * 1000);
};
var exports = module.exports = {}
var model = require('../models/index');
var sequelize = require('sequelize');
var sql = require('../sql/sql');
var fs = require('fs');

var env = process.env.NODE_ENV || 'development';
var config = require(__dirname + '/../config/config.json')[env];

var duplicates_sql = "";
try {
    duplicates_sql = fs.readFileSync(__dirname + '/../sql/duplicates.sql', 'utf8');
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

exports.run = async function () {
    try {

        var rows = await sql.query(duplicates_sql, {});

        var groups = groupBy(rows, x => {
            return {
                User: x.User,
                Instrument_ID: x.Instrument_ID,
                Time: x.Time.getTime()
            };
        }, (a, b) => {
            return a.User == b.User && a.Instrument_ID == b.Instrument_ID && a.Time == b.Time;
            });

        for (var i = 0; i < groups.length; ++i) {

            var snapshots = groups[i].values.sort((a, b) => {
                if (a.Decision == null && b.Decision == null) {
                    return b.Time - a.Time;
                }
                else if (a.Decision != null && b.decision != null) {
                    return b.Time - a.Time;
                }
                else if (a.Decision != null) {
                    return -1;
                }
                else {
                    return 1;
                }
            });

            for (var i = 1; i < snapshots.length; ++i) {
                console.log("deleting duplicate snapshot " + snapshots[i].ID + " for instrument " + snapshots[i].Instrument_ID);
                await model.snapshot.destroy({
                    where: {
                        ID: snapshots[i].ID
                    }
                })
            }

        }

    }
    catch (error) {
        console.log("error in cleanup: " + error);
    }

    setTimeout(exports.run, config.job_cleanup_interval_seconds * 1000);
};
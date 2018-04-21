var exports = module.exports = {}
var model = require('../models/index');
var sql = require('../sql/sql');
var dateFormat = require('dateformat');
var fs = require('fs');
var viewsController = require('./views_controller.js');

var stats_sql = "";
try {
    stats_sql = fs.readFileSync(__dirname + '/../sql/stats_simple.sql', 'utf8');
} catch (e) {
    console.log('Error:', e.stack);
}


function return500(res, e) {
    res.status(500);
    res.json({ error: e.message });
}

function getStatsViewModel(model) {
    function getSaleViewModel(model) {
        return {
            D: dateFormat(model.Time, 'dd.mm.yy'),
            DS: dateFormat(model.Time, 'yymmdd'),
            S: model.IsComplete == 1 ? 'c' : 'o',
            R: (Math.floor(model.Return * 10000)) / 10000.0,
            I: model.InstrumentName
        };
    }

    return {
        Sales: model.Sales.map(getSaleViewModel)
    };
}

function groupBy(xs, key) {
    return xs.reduce(function (rv, x) {
        let v = key instanceof Function ? key(x) : x[key];
        let el = rv.find((r) => r && r.key === v);
        if (el) {
            el.values.push(x);
        } else {
            rv.push({ key: v, values: [x] });
        }
        return rv;
    }, []);
}

async function loadPrice(snapshotId) {
    var result = await sql.query("SELECT rate.Close\
    FROM snapshotrates AS rate\
    WHERE rate.Snapshot_ID = @snapshotId\
    ORDER BY rate.Time DESC LIMIT 1", 
    {
        "@snapshotId": snapshotId
    });

    return result[0].Close;
}

exports.getStats = async function (req, res) {
    try {
        if (req.isAuthenticated()) {

            var trades = await sql.query(stats_sql, {
                "@userName": req.user.email
            });

            var instruments = groupBy(trades, "InstrumentId");

            var stats = {};
            stats.Sales = [];

            for (var i = 0; i < instruments.length; ++i)
            {
                var snapshots = instruments[i].values;
                var buy = null;
                for (var s = 0; s < snapshots.length; ++s)
                {
                    var snapshot = snapshots[s];
                    if (snapshot.Decision == "buy")
                    {
                        buy = snapshot;
                        snapshot.Price = await loadPrice(snapshot.SnapshotId);
                    }
                    else if (snapshot.Decision == "sell")
                    {
                        if (buy != null)
                        {
                            snapshot.Price = await loadPrice(snapshot.SnapshotId);
                            stats.Sales.push({
                                Time: snapshot.Time,
                                IsComplete: true,
                                Return: (snapshot.Price - buy.Price) / buy.Price,
                                InstrumentName: snapshot.InstrumentName
                            });
                            buy = null;
                        }
                    }
                }

                if (buy != null)
                {
                    var snapshot = snapshots[snapshots.length - 1];
                    if (snapshot != buy)
                    {
                        snapshot.Price = await loadPrice(snapshot.SnapshotId);
                    }
                    stats.Sales.push({
                        Time: snapshot.Time,
                        IsComplete: false,
                        Return: (snapshot.Price - buy.Price) / buy.Price,
                        InstrumentName: snapshot.InstrumentName
                    });
                }
            }

            var viewModel = getStatsViewModel(stats);
            res.json(viewModel);

        }
        else {
            res.status(401);
            res.json({ error: "unauthorized" });
        }
    }
    catch (error) {
        return500(res, error);
    }
};

exports.clearDecisions = async function (req, res) {
    try {
        if (req.isAuthenticated()) {

            if (req.user.email.endsWith('.ai')) {

                await model.snapshot.update(
                    { Decision: null },
                    { where: { User: req.user.email } }
                );

                res.render('clear', viewsController.get_default_args(req));

            }
            else {
                res.status(404);
                res.json({ error: "action not applicable" });
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

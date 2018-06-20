var exports = module.exports = {}
var model = require('../models/index');
var sequelize = require('sequelize');
var sql = require('../sql/sql');
var dateFormat = require('dateformat');
var config = require('../config/envconfig');
var newSnapshotController = require('./new_snapshot_controller');
var ratesProvider = require('../providers/rates_provider');


function parseDate(dateString) {
    return new Date(Date.UTC(
        dateString.substr(0, 4),
        dateString.substr(5, 2) - 1,
        dateString.substr(8, 2),
        dateString.substr(11, 2),
        dateString.substr(14, 2),
        dateString.substr(17, 2)
    ));
}

exports.getSnapshotViewModel = function (snapshot, previous, user) {

    var decision = null;
    var modifiedTime = new Date();

    if (snapshot.usersnapshots) {
        var usersnapshot = snapshot.usersnapshots.filter(x => x.User = user);
        if (usersnapshot.length > 0) {
            decision = usersnapshot[0].Decision;
            modifiedTime = usersnapshot[0].ModifiedTime;
        }
    }

    function getInstrumentViewModel(instrument) {
        return {
            ID: instrument.ID,
            InstrumentName: instrument.InstrumentName
        };
    }

    function getSnapshotRateViewModel(snapshotRate) {
        return {
            T: dateFormat(snapshotRate.Time, "yymmdd"),
            C: snapshotRate.Close
        };
    }

    return {
        ID: snapshot.ID,
        Instrument: getInstrumentViewModel(snapshot.instrument),
        StartTime: dateFormat(snapshot.StartTime, 'dd.mm.yy'),
        Date: dateFormat(snapshot.Time, 'dd.mm.yy'),
        DateSortable: dateFormat(snapshot.Time, 'yymmdd'),
        ModifiedDateSortable: dateFormat(modifiedTime, 'yymmddHHMMss'),
        ModifiedDate: dateFormat(modifiedTime, 'dd.mm.yy'),
        Rates: snapshot.snapshotrates ? snapshot.snapshotrates.map(getSnapshotRateViewModel) : undefined,
        Decision: decision,
        PreviousDecision: previous ? previous.PreviousDecision : undefined,
        PreviousBuyRate: previous ? previous.PreviousBuyRate : undefined,
        PreviousTime: previous ? previous.PreviousTime : undefined
    };
};

exports.countSnapshots = async function (req, res) {
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

            var result = await model.usersnapshot.count({
                where: {
                    User: req.user.email,
                    ModifiedTime: {
                        [sequelize.Op.gte]: fromDate
                    }
                }
            });

            res.json(result);

        }
        else {
            res.status(401);
            res.json({ error: "unauthorized" });
        }
    }
    catch (error) {
        res.status(500);
        res.json({ error: error.message });
    }
}

exports.snapshots = async function (req, res) {
    try {
        if (req.isAuthenticated()) {

            var snapshots = await model.snapshot.findAll({
                include: [{
                    model: model.instrument
                }, {
                    model: model.usersnapshot,
                    where: {
                        User: req.user.email
                    },
                    required: true
                }]
            });

            var viewModels = snapshots.map(snapshot => exports.getSnapshotViewModel(snapshot, undefined, req.user.email));
            res.json(viewModels);

        }
        else {
            res.status(401);
            res.json({ error: "unauthorized" });
        }
    }
    catch (error) {
        res.status(500);
        res.json({ error: error.message });
    }
}

exports.getSnapshot = async function (id, user) {

    var snapshot = await model.snapshot.find({
        include: [{
            model: model.instrument
        }, {
            model: model.snapshotrate
        }, {
            model: model.usersnapshot,
            where: {
                User: user
            },
            required: false
        }],
        where: {
            ID: id
        },
        order: [
            [model.snapshotrate, "Time", "ASC"]
        ]
    });

    if (snapshot) {
        var previous = await exports.getPreviousDecision(snapshot, user);
        var viewModel = exports.getSnapshotViewModel(snapshot, previous, user);
        return viewModel;
    }
    else {
        return null;
    }
}

exports.snapshot = async function (req, res) {
    try {
        if (req.isAuthenticated()) {

            var viewModel = await exports.getSnapshot(req.params.id, req.user.email);

            if (viewModel != null) {
                res.json(viewModel);
            }
            else {
                res.status(404);
                res.json({ error: 'snapshot not found' });
            }
        }
        else {
            res.status(401);
            res.json({ error: "unauthorized" });
        }
    }
    catch (error) {
        res.status(500);
        res.json({ error: error.message });
    }
}

exports.getPreviousDecision = async function (snapshot, user) {

    var previous = await sql.query("SELECT s.ID, u.Decision FROM snapshots AS s INNER JOIN usersnapshots AS u ON u.Snapshot_ID = s.ID \
        WHERE u.User = @userName AND s.ID <> @snapshotId AND s.Instrument_ID = @instrumentId AND s.Time < @time AND (u.Decision = 'buy' OR u.Decision = 'sell') \
        ORDER BY s.Time DESC LIMIT 1",
        {
            "@userName": user,
            "@snapshotId": snapshot.ID,
            "@instrumentId": snapshot.Instrument_ID,
            "@time": snapshot.Time
        });

    result = {};

    if (previous && previous.length == 1) {
        result.PreviousDecision = previous[0].Decision;
        if (result.PreviousDecision == 'buy') {

            var lastRates = await model.snapshotrate.findAll({
                limit: 1,
                where: {
                    Snapshot_ID: previous[0].ID
                },
                order: [['Time', 'DESC']]
            });

            if (lastRates && lastRates.length == 1) {
                result.PreviousBuyRate = lastRates[0].Close;
                result.PreviousTime = dateFormat(lastRates[0].Time, 'yymmdd');
            }

        }
    }

    return result;
};

exports.setDecision = async function (req, res) {
    try {
        if (req.isAuthenticated()) {

            var usersnapshot = await model.usersnapshot.find({
                where: {
                    User: req.user.email,
                    Snapshot_ID: req.params.id
                }
            });

            var deletePortfolio = false;

            if (usersnapshot) {
                if (usersnapshot.Decision != req.params.decision) {

                    deletePortfolio = true;

                    await model.usersnapshot.update(
                        {
                            Decision: req.params.decision,
                            ModifiedTime: new Date()
                        },
                        {
                            where: {
                                User: req.user.email,
                                Snapshot_ID: req.params.id
                            }
                        }
                    );
                }

                if (deletePortfolio) {
                    var snapshot = await model.snapshot.find({
                        where: {
                            ID: req.params.id
                        }
                    });

                    var fromTime = new Date(snapshot.Time);

                    await model.portfolio.destroy({
                        where: {
                            User: req.user.email,
                            Time: {
                                [sequelize.Op.gte]: fromTime
                            }
                        }
                    });

                    var latest = await model.portfolio.find({
                        where: {
                            User: req.user.email
                        },
                        order: [["Time", "DESC"]],
                        limit: 1
                    });

                    if (latest) {
                        fromTime = new Date(latest.Time);
                    }

                    await model.trade.destroy({
                        where: {
                            User: req.user.email,
                            Time: {
                                [sequelize.Op.gte]: fromTime
                            }
                        }
                    });
                }
            }
            else {
                await model.usersnapshot.create({
                    Snapshot_ID: req.params.id,
                    User: req.user.email,
                    Decision: req.params.decision,
                    ModifiedTime: new Date()
                });
            }

            res.json({ status: "ok" });
        }
        else {
            res.status(401);
            res.json({ error: "unauthorized" });
        }
    }
    catch (error) {
        res.status(500);
        res.json({ error: error.message });
    }
}

exports.resetStats = async function (snapshotId, endTime) {
    var users = await sql.query("SELECT u.User FROM usersnapshots AS u WHERE u.Snapshot_ID = @snapshotId", {
        "@snapshotId": snapshotId
    });

    for (var u = 0; u < users.length; ++u) {

        var fromTime = new Date(endTime);

        await model.portfolio.destroy({
            where: {
                User: users[u].User,
                Time: {
                    [sequelize.Op.gte]: fromTime
                }
            }
        });

        var latest = await model.portfolio.find({
            where: {
                User: users[u].User
            },
            order: [["Time", "DESC"]],
            limit: 1
        });

        if (latest) {
            fromTime = new Date(latest.Time);
        }

        await model.trade.destroy({
            where: {
                User: users[u].User,
                Time: {
                    [sequelize.Op.gte]: fromTime
                }
            }
        });
    }
}

exports.setRates = async function (snapshotId, source, marketId, rates, endTime) {

    let transaction;

    try {
        transaction = await model.sequelize.transaction();

        await model.snapshotrate.destroy({
            where: {
                Snapshot_ID: snapshotId
            },
            transaction: transaction
        });

        await model.snapshotrate.bulkCreate(
            rates.map(function (r) {
                return {
                    Snapshot_ID: snapshotId,
                    Open: r.Open,
                    Close: r.Close,
                    High: r.High,
                    Low: r.Low,
                    Time: r.Time
                };
            }), {
                transaction: transaction
            });

        await model.snapshot.update(
            {
                SourceType: source,
                Price: rates[rates.length - 1].Close,
                PriceTime: rates[rates.length - 1].Time,
                FirstPriceTime: rates[0].Time,
                MarketId: marketId
            },
            {
                where: {
                    ID: snapshotId
                },
                transaction: transaction
            });

        await model.usersnapshot.update(
            {
                ModifiedTime: new Date()
            },
            {
                where: {
                    Snapshot_ID: snapshotId
                },
                transaction: transaction
            });
    
        await transaction.commit();

    } catch (err) {
        await transaction.rollback();
    }

    await exports.resetStats(snapshotId, endTime);
}

exports.refreshSnapshotRates = async function (req, res) {
    try {
        if (req.isAuthenticated() && req.user.email == config.admin_user) {

            var snapshotId = req.body.id;
            var newSource = req.body.source;
            var newMarketId = req.body.market;

            var snapshots = await sql.query("SELECT s.StartTime, s.Time, s.Instrument_ID, s.SourceType, s.MarketId FROM snapshots AS s WHERE s.ID = @id", {
                "@id": snapshotId
            });

            if (snapshots.length == 0) {
                res.json({ error: "snapshot not found" });
                return;
            }

            var startTime = parseDate(snapshots[0].StartTime);
            var endTime = parseDate(snapshots[0].Time);
            var instrumentId = snapshots[0].Instrument_ID;

            if (!newSource) {
                newSource = snapshots[0].SourceType;
                if (!newMarketId) {
                    newMarketId = snapshots[0].MarketId;
                }
            }

            if (!newSource) {
                res.json({ error: "source not found" });
                return;
            }

            var sources = await model.source.findAll({
                where: {
                    Instrument_ID: instrumentId,
                    SourceType: newSource
                }
            });

            if (sources.length == 0) {

                sources = await model.source.findAll({
                    where: {
                        Instrument_ID: instrumentId
                    }
                });

                sources = sources.filter(x => ratesProvider.sources.indexOf(x.SourceType) >= 0);
                sources.sort(x => ratesProvider.sources.indexOf(x.SourceType));

                if (sources.length == 0) {
                    res.json({ error: "source not found" });
                    return;
                }
            }

            var sourceInfo = sources[0];

            if (!newMarketId) {
                newMarketId = sourceInfo.MarketId;
            }

            async function checkRatesCallback(rates) {
                problem = newSnapshotController.checkRates(rates, startTime, endTime, newSource);
                return problem == null;
            }

            try {
                var ratesResponse = await ratesProvider.getRates(newSource, sourceInfo.SourceId, newMarketId, startTime, endTime, checkRatesCallback);
                if (ratesResponse && ratesResponse.Rates) {
                    var newRates = ratesResponse.Rates;

                    await exports.setRates(snapshotId, ratesResponse.Source, ratesResponse.MarketId, newRates, endTime);

                    res.json({ status: "ok" });
                }
                else {
                    res.json({ error: "no rates" });
                }
            }
            catch (e) {
                if (e == ratesProvider.market_not_found) {
                    res.json({ error: "market not found" });
                }
                else if (e == ratesProvider.invalid_response) {
                    res.json({ error: "invalid provider response" });
                }
                else {
                    res.json({ error: e.message });
                }
            }
        }
        else {
            res.status(401);
            res.json({ error: "unauthorized" });
        }
    }
    catch (error) {
        res.status(500);
        res.json({ error: error.message });
    }
}

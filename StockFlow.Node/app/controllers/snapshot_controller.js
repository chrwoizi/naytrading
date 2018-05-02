var exports = module.exports = {}
var model = require('../models/index');
var sequelize = require('sequelize');
var sql = require('../sql/sql');
var dateFormat = require('dateformat');
var viewsController = require('./views_controller.js');


exports.getSnapshotViewModel = function (snapshot, previous) {

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
        ModifiedDateSortable: dateFormat(snapshot.ModifiedTime, 'yymmddHHMMss'),
        ModifiedDate: dateFormat(snapshot.ModifiedTime, 'dd.mm.yy'),
        Rates: snapshot.snapshotrates ? snapshot.snapshotrates.map(getSnapshotRateViewModel) : undefined,
        Decision: snapshot.Decision,
        PreviousDecision: previous ? previous.PreviousDecision : undefined,
        PreviousBuyRate: previous ? previous.PreviousBuyRate : undefined,
        PreviousTime: previous ? previous.PreviousTime : undefined
    };
};

exports.countSnapshots = async function (req, res) {
    try {
        if (req.isAuthenticated()) {

            var result = await model.snapshot.count(
                { where: { User: req.user.email } }
            );

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
                }],
                where: {
                    User: req.user.email
                },
                order: [['ModifiedTime', 'DESC']]
            });

            var viewModels = snapshots.map(snapshot => exports.getSnapshotViewModel(snapshot, undefined));
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

exports.snapshot = async function (req, res) {
    try {
        if (req.isAuthenticated()) {

            var snapshot = await model.snapshot.find({
                include: [{
                    model: model.instrument
                }, {
                    model: model.snapshotrate
                }],
                where: {
                    ID: req.params.id,
                    User: req.user.email
                },
                order: [
                    [model.snapshotrate, "Time", "ASC"]
                ]
            });

            if (snapshot) {

                var previous = await exports.getPreviousDecision(snapshot);

                var viewModel = exports.getSnapshotViewModel(snapshot, previous);

                var previous = await model.snapshot.findAll({
                    limit: 1,
                    where: {
                        User: req.user.email,
                        ID: { [sequelize.Op.ne]: snapshot.ID },
                        Instrument_ID: snapshot.Instrument_ID,
                        Time: { [sequelize.Op.lt]: snapshot.Time },
                        Decision: { [sequelize.Op.or]: ['buy', 'sell'] }
                    },
                    order: [['Time', 'DESC']]
                });

                if (previous && previous.length == 1) {
                    viewModel.PreviousDecision = previous[0].Decision;
                    if (viewModel.PreviousDecision == 'buy') {

                        var lastRates = await model.snapshotrate.findAll({
                            limit: 1,
                            where: {
                                Snapshot_ID: previous[0].ID
                            },
                            order: [['Time', 'DESC']]
                        });

                        if (lastRates && lastRates.length == 1) {
                            viewModel.PreviousBuyRate = lastRates[0].Close;
                            viewModel.PreviousTime = dateFormat(lastRates[0].Time, 'yymmdd');
                        }

                        res.json(viewModel);

                    }
                    else {
                        res.json(viewModel);
                    }
                }
                else {
                    res.json(viewModel);
                }

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

exports.getPreviousDecision = async function (snapshot) {

    var previous = await model.snapshot.findAll({
        limit: 1,
        where: {
            User: snapshot.User,
            ID: { [sequelize.Op.ne]: snapshot.ID },
            Instrument_ID: snapshot.Instrument_ID,
            Time: { [sequelize.Op.lt]: snapshot.Time },
            Decision: { [sequelize.Op.or]: ['buy', 'sell'] }
        },
        order: [['Time', 'DESC']]
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

            var snapshot = await model.snapshot.find({
                where: {
                    User: req.user.email,
                    Id: req.params.id
                }
            });

            var deletePortfolio = false;

            if (snapshot.Decision != req.params.decision) {

                deletePortfolio = true;

                await model.snapshot.update(
                    {
                        Decision: req.params.decision,
                        ModifiedTime: new Date()
                    },
                    {
                        where: {
                            User: req.user.email,
                            Id: req.params.id
                        }
                    }
                );
            }

            res.status(200);
            res.json({});

            if (deletePortfolio) {
                var day = new Date(snapshot.Time);
                day.setHours(0, 0, 0, 0);
                
                await sql.query("DELETE portfolio FROM portfolios AS portfolio WHERE portfolio.User = @userName AND portfolio.Time >= @time", {
                    "@userName": req.user.email,
                    "@time": day
                });
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

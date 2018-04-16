var exports = module.exports = {}
var model = require('../models/index');
var sequelize = require('sequelize');
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
            T: dateFormat(snapshotRate.Time, "dd.mm.yy"),
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
			res.json(JSON.stringify({ error: "unauthorized" }));
            res.status(401);
        }
    }
    catch (error) {
        res.json(JSON.stringify({ error: error.message }));
        res.status(500);
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
			res.json(JSON.stringify({ error: "unauthorized" }));
            res.status(401);
        }
    }
    catch (error) {
        res.json(JSON.stringify({ error: error.message }));
        res.status(500);
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
                }
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
                            viewModel.PreviousTime = dateFormat(lastRates[0].Time, 'dd.mm.yy');
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
                res.json(JSON.stringify({ error: 'snapshot not found' }));
                res.status(404);
            }

        }
        else {
			res.json(JSON.stringify({ error: "unauthorized" }));
            res.status(401);
        }
    }
    catch (error) {
        res.json(JSON.stringify({ error: error.message }));
        res.status(500);
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
                result.PreviousTime = dateFormat(lastRates[0].Time, 'dd.mm.yy');
            }

        }
    }

    return result;
};

exports.setDecision = async function (req, res) {
    try {
        if (req.isAuthenticated()) {

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

			res.json(JSON.stringify({}));
            res.status(200);

        }
        else {
			res.json(JSON.stringify({ error: "unauthorized" }));
            res.status(401);
        }
    }
    catch (error) {
        res.json(JSON.stringify({ error: error.message }));
        res.status(500);
    }
}

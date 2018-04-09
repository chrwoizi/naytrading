var exports = module.exports = {}
var model = require('../models/index');
var sequelize = require('sequelize');
var dateFormat = require('dateformat');

function loadInstrumentById(id, success, notfound, error) {

    model.instrument.find({
        where: {
            ID: id,
            User: user
        }
    })
        .then(instrument => {
            if (instrument) {
                success(instrument);
            }
            else {
                notfound();
            }
        })
        .catch(message => {
            error(message);
        });

}

function loadInstrumentByUserAndId(user, id, success, notfound, error) {

    model.instrument.find({
        where: {
            ID: id,
            User: user
        }
    })
        .then(instrument => {
            if (instrument) {
                success(instrument);
            }
            else {
                notfound();
            }
        })
        .catch(message => {
            error(message);
        });

}

function loadSnapshotByUserAndId(user, id, success, notfound, error) {

    model.snapshot.find({
        include: [{
            model: model.instrument
        }, {
            model: model.snapshotrate
        }],
        where: {
            ID: id,
            User: user
        }
    })
        .then(snapshot => {
            if (snapshot) {
                success(snapshot);
            }
            else {
                notfound();
            }
        })
        .catch(message => {
            error(message);
        });

}

function getSnapshotViewModel(snapshot) {
    return {
        ID: snapshot.ID,
        Instrument: snapshot.instrument,
        StartTime: dateFormat(snapshot.StartTime, 'dd.mm.yy'),
        Date: dateFormat(snapshot.Time, 'dd.mm.yy'),
        DateSortable: dateFormat(snapshot.Time, 'yymmdd'),
        ModifiedDateSortable: dateFormat(snapshot.ModifiedTime, 'yymmddHHMMss'),
        ModifiedDate: dateFormat(snapshot.ModifiedTime, 'dd.mm.yy'),
        Rates: snapshot.snapshotrates ? snapshot.snapshotrates.map(getSnapshotRateViewModel) : undefined,
        Decision: snapshot.Decision,
        User: snapshot.User
    };
}

function getSnapshotRateViewModel(snapshotRate) {
    return {
        T: dateFormat(snapshotRate.Time, "dd.mm.yy"),
        C: snapshotRate.Close
    };
}

exports.instruments = function (req, res) {

    if (req.isAuthenticated()) {

        model.instrument.findAll({
            where: {
                User: req.user.email
            },
            order: [['Capitalization', 'DESC']]
        })
            .then(instruments => {
                res.json(instruments);
            })
            .catch(error => {
                res.json(JSON.stringify({ error: error.message }));
                res.status(500);
            });

    }
    else {
        res.status(401);
    }

}

exports.instrument = function (req, res) {

    if (req.isAuthenticated()) {

        loadInstrumentByUserAndId(req.user.email, req.params.id,
            instrument => {
                res.json(instrument);
            },
            () => {
                res.json(JSON.stringify({ error: 'instrument not found' }));
                res.status(404);
            },
            error => {
                res.json(JSON.stringify({ error: error.message }));
                res.status(500);
            });

    }
    else {
        res.status(401);
    }

}

exports.snapshots = function (req, res) {

    if (req.isAuthenticated()) {

        model.snapshot.findAll({
            include: [{
                model: model.instrument
            }],
            where: {
                User: req.user.email
            },
            order: [['ModifiedTime', 'DESC']]
        })
            .then(snapshots => {
                var viewModels = snapshots.map(snapshot => getSnapshotViewModel(snapshot, undefined));
                res.json(viewModels);
            })
            .catch(error => {
                res.json(JSON.stringify({ error: error.message }));
                res.status(500);
            });

    }
    else {
        res.status(401);
    }

}

exports.snapshot = function (req, res) {

    if (req.isAuthenticated()) {

        loadSnapshotByUserAndId(req.user.email, req.params.id,
            snapshot => {

                var viewModel = getSnapshotViewModel(snapshot);

                model.snapshot.findAll({
                    limit: 1,
                    where: {
                        User: req.user.email,
                        ID: { [sequelize.Op.ne]: snapshot.ID },
                        Instrument_ID: snapshot.Instrument_ID,
                        Time: { [sequelize.Op.lt]: snapshot.Time },
                        Decision: { [sequelize.Op.or]: ['buy', 'sell'] }
                    },
                    order: [['Time', 'DESC']]
                })
                    .then(previous => {
                        if (previous && previous.length == 1) {
                            viewModel.PreviousDecision = previous[0].Decision;
                            if (viewModel.PreviousDecision == 'buy') {

                                model.snapshotrate.findAll({
                                    limit: 1,
                                    where: {
                                        Snapshot_ID: previous[0].ID
                                    },
                                    order: [['Time', 'DESC']]
                                })
                                    .then(lastRates => {
                                        if (lastRates && lastRates.length == 1) {
                                            viewModel.PreviousBuyRate = lastRates[0].Close;
                                            viewModel.PreviousTime = dateFormat(lastRates[0].Time, 'dd.mm.yy');
                                        }
                                        res.json(viewModel);
                                    })
                                    .catch(error => {
                                        res.json(JSON.stringify({ error: error.message }));
                                        res.status(500);
                                    });

                            }
                            else {
                                res.json(viewModel);
                            }
                        }
                        else {
                            res.json(viewModel);
                        }
                    })
                    .catch(error => {
                        res.json(JSON.stringify({ error: error.message }));
                        res.status(500);
                    });
                
            },
            () => {
                res.json(JSON.stringify({ error: 'snapshot not found' }));
                res.status(404);
            },
            error => {
                res.json(JSON.stringify({ error: error.message }));
                res.status(500);
            });

    }
    else {
        res.status(401);
    }

}
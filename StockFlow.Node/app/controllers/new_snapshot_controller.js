var exports = module.exports = {}
var model = require('../models/index');
var sql = require('../sql/sql');
var sequelize = require('sequelize');
var dateFormat = require('dateformat');
var fs = require('fs');

var env = process.env.NODE_ENV || 'development';
var config = require(__dirname + '/../config/config.json')[env];

var rank_instruments = "";
try {
    rank_instruments = fs.readFileSync(__dirname + '/../sql/rank_instruments.sql', 'utf8');
} catch (e) {
    console.log('Error:', e.stack);
}

var lockFlag = 0;

var***REMOVED***= {
    getRates: async function (instrument, startTime, endTime) {
        var rates = [];
        for (var i = 0; i < Math.floor((endTime.getTime() - startTime.getTime()) / 1000 / 60 / 60 / 24); ++i) {
            rates.push({
                Time: new Date(startTime.getTime() + 1000 * 60 * 60 * 24 * i),
                Open: i,
                Close: i,
                High: i,
                Low: i
            });
        }
        return rates;
    }
}

function getInstrumentViewModel(instrument) {
    return {
        ID: instrument.ID,
        InstrumentName: instrument.InstrumentName
    };
}

function getSnapshotViewModel(snapshot) {
    var previous = getPreviousDecision(snapshot);
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
        PreviousDecision: previous.PreviousDecision,
        PreviousBuyRate: previous.PreviousBuyRate,
        PreviousTime: previous.PreviousTime
    };
}

function getSnapshotRateViewModel(snapshotRate) {
    return {
        T: dateFormat(snapshotRate.Time, "dd.mm.yy"),
        C: snapshotRate.Close
    };
}

async function isAutoIgnore(newSnapshot) {
    if (newSnapshot.PreviousDecision == "buy") {
        if (newSnapshot.Rates && newSnapshot.Rates.length > 0 && newSnapshot.PreviousBuyRate != null) {
            var lastRate = newSnapshot.Rates[newSnapshot.Rates.length - 1];
            if (lastRate.Close < newSnapshot.PreviousBuyRate) {
                return true;
            }
        }

        return false;
    }
    else {
        var endTime = new Date();
        var startTime = new Date(endTime.getTime() - config.chart_period_seconds * 1000);

        var timeDiff = endTime - startTime;
        var firstRatesUntil = new Date(startTime.getTime() + 1000 * (config.chart_period_seconds * 0.2));
        var lastRatesFrom = new Date(endTime.getTime() - 1000 * (config.chart_period_seconds * 0.2));

        var firstRates = newSnapshot.Rates.filter(x => x.Close != null && x.Time < firstRatesUntil);
        var lastRates = newSnapshot.Rates.filter(x => x.Close != null && x.Time > lastRatesFrom);

        var firstAverage = firstRates.reduce((a, b) => a.Close + b.Close) / firstRates.length;
        var lastAverage = lastRates.reduce((a, b) => a.Close + b.Close) / firstRates.length;

        // overall bearish trend
        return lastAverage < firstAverage;
    }
}

async function getPreviousDecision(snapshot) {

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
}

async function getNewSnapshotInstruments(endTime, userName) {

    var upToDateFrom = new Date(endTime.getTime() - config.snapshot_valid_seconds * 1000);

    if (await model.instrument.count({}) == 0) {
        return [];
    }

    var maxCapitalization = await model.instrument.max('Capitalization');
    maxCapitalization = Math.max(maxCapitalization, 1);
    
    var args = {
        "@userName": userName,
        "@validFromDateTime": upToDateFrom,
        "@maxCapitalization": maxCapitalization,
        "@maxStrikes": config.max_strikes,
        "@strikesOrderWeight": config.strikes_order_weight,
        "@boughtOrderWeight": config.bought_order_weight,
        "@capitalizationOrderWeight": config.capitalization_order_weight,
        "@snapshotCountOrderWeight": config.snapshot_count_order_weight
    };

    var rows = await sql.query(rank_instruments, args);

    var instrumentIds = rows.sort((a, b) => b.Order - a.Order);
    return instrumentIds;
}

/// <summary>
/// Gets an index from gaussian normal distribution
/// </summary>
/// <param name="count">number of list items</param>
/// <param name="randomRange">range within the list from which to pick items. e.g. 0.33 means picking from the first third of the list</param>
/// <returns>An index within [0..count-1]</returns>
function getRandomIndex(count, randomRange) {
    var u1 = 1.0 - Math.random();
    var u2 = 1.0 - Math.random();

    // gaussian normal distribution around 0 with standard deviation of 1
    var randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);

    // roughly within [0..1] where 0 has the highest probability and 1+ the lowest.
    // values are <1 with probability 99,73% but can be larger
    var randNormal = Math.abs(randStdNormal) / 3.0;

    var index = Math.floor(randNormal * count * randomRange) % count;
    return index;
}

async function getNewRandomSnapshot(instrumentIds) {
    var endTime = new Date();
    var startTime = new Date(endTime.getTime() - config.chart_period_seconds * 1000);

    // try to load rates of a random instrument. 
    // if rates can not be loaded, try another random instrument. 
    // try for a fixed number of times to avoid infinite loop.
    for (var i = 0; i < Math.min(instrumentIds.length, 10); ++i) {
        var index = getRandomIndex(instrumentIds.length, config.random_order_weight);

        var instrument = await model.instrument.findOne({ where: { ID: instrumentIds[index].ID } });

        try {
            var rates = await***REMOVED***getRates(instrument, startTime, endTime);
            var minRateTime = new Date(startTime.getTime() + 1000 * config.discard_threshold_seconds);
            var maxRateTime = new Date(endTime.getTime() - 1000 * config.discard_threshold_seconds);

            if (rates != null && rates.length > 0 && rates[0].Time <= minRateTime && rates[rates.length - 1].Time >= maxRateTime) {
                var similar = await model.snapshot.findAll({
                    include: [{
                        model: model.instrument
                    }, {
                        model: model.snapshotrate
                    }],
                    where: {
                        User: instrument.User,
                        Instrument_ID: instrument.ID,
                        StartTime: startTime,
                        Time: endTime
                    },
                    order: [['Time'], ['ID']],
                    limit: 1
                })

                if (similar != null && similar.length > 0) {
                    if (similar[0].Decision == null) {
                        return similar[0];
                    }
                    else {
                        return null;
                    }
                }

                var snapshot = await model.snapshot.create({
                    StartTime: startTime,
                    Time: endTime,
                    ModifiedTime: new Date(),
                    snapshotrates: rates,
                    Instrument_ID: instrument.ID,
                    User: instrument.User
                }, {
                    include: [{
                        model: model.instrument
                    }, {
                        model: model.snapshotrate
                    }]
                });

                snapshot.instrument = instrument;
                return snapshot;
            }
            else {
                if (rates && rates.length > 0) {
                    console.log("Adding 10 strikes to instrument " + instrument.InstrumentName + " because it has insufficient rates. Available rates are from " + dateFormat(rates[0].Time, 'dd.mm.yy') + " to " + dateFormat(rates[rates.length - 1].Time, 'dd.mm.yy'));
                    await instrument.updateAttributes({
                        Strikes: instrument.Strikes + 10,
                        LastStrikeTime: new Date()
                    });
                }
                else {
                    console.log("Adding 1 strike to instrument " + instrument.InstrumentName + " because it has no rates");
                    await instrument.updateAttributes({
                        Strikes: instrument.Strikes + 1,
                        LastStrikeTime: new Date()
                    });
                }

            }
        }
        catch (error) {
            console.log(error);
            console.log("Adding 1 strike to instrument " + instrument.InstrumentName + " because it caused an exception: " + error);
            await instrument.updateAttributes({
                Strikes: instrument.Strikes + 1,
                LastStrikeTime: new Date()
            });
        }

        if (lockFlag > 0) {
            break;
        }
    }

    return null;
}

exports.newSnapshot = async function (req, res) {
    try {
        if (req.isAuthenticated()) {

            var endTime = new Date();

            var forgotten = await model.snapshot.findAll({
                limit: 1,
                include: [{
                    model: model.instrument
                }, {
                    model: model.snapshotrate
                }],
                where: {
                    User: req.user.email,
                    Decision: null
                },
                order: [['Time', 'ASC'], ['ID', 'ASC']]
            });

            if (forgotten && forgotten.length == 1) {
                var viewModel = getSnapshotViewModel(forgotten[0]);
                res.json(viewModel);
                return;
            }

            var instrumentIds = await getNewSnapshotInstruments(endTime, req.user.email);

            var newSnapshot = null;
            for (var i = 0; i <= config.automatic_ignores; ++i) {
                newSnapshot = await getNewRandomSnapshot(instrumentIds);
                if (newSnapshot != null) {

                    var k = instrumentIds.indexOf(newSnapshot.Instrument_ID);
                    instrumentIds.splice(k, 1);

                    var viewModel = getSnapshotViewModel(newSnapshot);
                    if (i == config.automatic_ignores || !isAutoIgnore(viewModel)) {
                        res.json(viewModel);
                        return;
                    }

                }
                else {
                    break;
                }
            }

            res.json(JSON.stringify({ error: 'no instrument available' }));
            res.status(404);
        }
        else {
            res.status(401);
        }
    }
    catch (error) {
        res.json(JSON.stringify({ error: error.message }));
        res.status(500);
    }
};

exports.newSnapshotByInstrumentId = async function (req, res) {
    try {
        if (req.isAuthenticated()) {

            var instrumentIds = [{ ID: req.params.instrumentId, Order: 1 }];

            var newSnapshot = await getNewRandomSnapshot(instrumentIds);
            if (newSnapshot != null) {
                var viewModel = getSnapshotViewModel(newSnapshot);
                res.json(viewModel);
                return;
            }
            else {
                res.json(JSON.stringify({ error: 'instrument not available' }));
                res.status(404);
            }

        }
        else {
            res.status(401);
        }
    }
    catch (error) {
        res.json(JSON.stringify({ error: error.message }));
        res.status(500);
    }
};

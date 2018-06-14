var exports = module.exports = {}
var model = require('../models/index');
var sql = require('../sql/sql');
var ratesProvider = require('../providers/rates_provider');
var snapshotController = require('./snapshot_controller');
var sequelize = require('sequelize');
var dateFormat = require('dateformat');
var fs = require('fs');
var config = require('../config/envconfig');

var rank_instruments = "";
try {
    rank_instruments = fs.readFileSync(__dirname + '/../sql/rank_instruments.sql', 'utf8');
} catch (e) {
    console.log('Error:', e.stack);
}

var rank_open_snapshots = "";
try {
    rank_open_snapshots = fs.readFileSync(__dirname + '/../sql/rank_open_snapshots.sql', 'utf8');
} catch (e) {
    console.log('Error:', e.stack);
}

var lockFlag = 0;


function isEmpty(str) {
    return typeof (str) === 'undefined' || str == null || !str.length;
}

exports.getNewSnapshotInstruments = async function (endTime) {

    var upToDateFrom = new Date(endTime.getTime() - config.snapshot_valid_seconds * 1000);

    if (await model.instrument.count({}) == 0) {
        return [];
    }

    var maxCapitalization = await model.instrument.max('Capitalization');
    maxCapitalization = Math.max(maxCapitalization, 1);

    var args = {
        "@validFromDateTime": upToDateFrom,
        "@maxCapitalization": maxCapitalization,
        "@maxStrikes": config.max_strikes,
        "@strikesOrderWeight": config.strikes_order_weight,
        "@boughtOrderWeight": config.bought_order_weight,
        "@capitalizationOrderWeight": config.capitalization_order_weight,
        "@snapshotCountOrderWeight": config.snapshot_count_order_weight,
        "@staticWeight": config.static_weight
    };

    var rows = await sql.query(rank_instruments, args);

    var instrumentIds = rows.sort((a, b) => b.Order - a.Order);
    return instrumentIds;
}

/**
Gets an index from gaussian normal distribution
@param count number of list items.
@param randomRange range within the list from which to pick items. e.g. 0.33 means picking from the first third of the list.
@return An index within [0..count-1].
*/
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

exports.minDays = 5 * (config.chart_period_seconds / 60 / 60 / 24 / 7) - config.discard_threshold_missing_workdays;

exports.isUserAutoIgnore = async function (newSnapshot) {
    if (newSnapshot.PreviousDecision == "buy") {
        if (newSnapshot.Rates && newSnapshot.Rates.length > 0 && newSnapshot.PreviousBuyRate != null) {
            var lastRate = newSnapshot.Rates[newSnapshot.Rates.length - 1];
            if (lastRate.C < newSnapshot.PreviousBuyRate) {
                return true;
            }
        }

        return false;
    }
}

exports.isGlobalAutoIgnore = async function (rates) {
    var endTime = new Date();
    endTime.setHours(0, 0, 0, 0);
    var startTime = new Date(endTime.getTime() - config.chart_period_seconds * 1000);

    var timeDiff = endTime - startTime;
    var firstRatesUntil = new Date(startTime.getTime() + 1000 * (config.chart_period_seconds * 0.2));
    var lastRatesFrom = new Date(endTime.getTime() - 1000 * (config.chart_period_seconds * 0.2));

    var firstRates = rates.filter(x => x.Time < firstRatesUntil);
    var lastRates = rates.filter(x => x.Time > lastRatesFrom);

    if (firstRates.length == 0 || lastRates.length == 0) {
        return false;
    }

    var firstAverage = firstRates.map(x => x.Close).reduce((a, b) => a + b) / firstRates.length;
    var lastAverage = lastRates.map(x => x.Close).reduce((a, b) => a + b) / lastRates.length;

    // overall bearish trend
    return lastAverage < firstAverage;
}

exports.createNewSnapshotFromRandomInstrument = async function (instrumentIds) {
    var endTime = new Date();
    var endDate = new Date(endTime.getTime());
    endDate.setHours(0, 0, 0, 0);
    var startTime = new Date(endDate.getTime() - config.chart_period_seconds * 1000);

    // try to load rates of a random instrument. 
    // if rates can not be loaded, try another random instrument. 
    // try for a fixed number of times to avoid infinite loop.
    for (var i = 0; i < Math.min(instrumentIds.length, 10); ++i) {
        var index = getRandomIndex(instrumentIds.length, config.random_order_weight);

        var instrument = await model.instrument.findOne({
            where: {
                ID: instrumentIds[index].ID,
            },
            include: [{
                model: model.source
            }]
        });

        try {
            var ratesResponse = null;
            for (var s = 0; s < instrument.sources.length; ++s) {
                var source = instrument.sources[s];
                try {
                    ratesResponse = await ratesProvider.getRates(source.SourceType, source.SourceId, source.MarketId, startTime, endTime);
                    if (ratesResponse && ratesResponse.Rates && ratesResponse.Rates.length > 0) {
                        break;
                    }
                }
                catch (error) {
                    if (error == ratesProvider.market_not_found) {
                        var strikes = config.max_strikes + 12;
                        console.log("Setting " + strikes + " strikes on instrument " + instrument.InstrumentName + " because the market id does not exist");
                        await source.updateAttributes({
                            Strikes: strikes,
                            LastStrikeTime: new Date()
                        });
                    }
                    else if (error == ratesProvider.invalid_response) {
                        console.log("Adding 5 strikes to instrument " + instrument.InstrumentName + " because the server returned an unexpected response");
                        await source.updateAttributes({
                            Strikes: source.Strikes + 5,
                            LastStrikeTime: new Date()
                        });
                    }
                    else {
                        console.log(error);
                        console.log("Adding 1 strike to instrument " + instrument.InstrumentName + " because it caused an exception: " + error);
                        await source.updateAttributes({
                            Strikes: source.Strikes + 1,
                            LastStrikeTime: new Date()
                        });
                    }
                }
            }

            if (ratesResponse) {

                var source = instrument.sources.filter(x => x.SourceType = ratesResponse.Source)[0];

                if (ratesResponse.MarketId != instrument.MarketId) {
                    // change preferred market id for instrument
                    instrument.MarketId = ratesResponse.MarketId;
                    await model.source.update(
                        {
                            MarketId: ratesResponse.MarketId
                        },
                        {
                            where: {
                                Instrument_ID: instrument.ID,
                                SourceType: ratesResponse.Source
                            }
                        });
                }

                var rates = ratesResponse.Rates;
                var isin = ratesResponse.Isin;
                var wkn = ratesResponse.Wkn;

                var updated = false;
                var fields = {};
                if (isEmpty(instrument.Isin) && !isEmpty(isin)) {
                    fields.Isin = isin;
                    updated = true;
                }
                if (isEmpty(instrument.Wkn) && !isEmpty(wkn)) {
                    fields.Wkn = wkn;
                    updated = true;
                }
                if (updated) {
                    await instrument.updateAttributes(fields);
                    instrument = await model.instrument.findOne({ where: { ID: instrumentIds[index].ID } });
                }

                var minRateTime = new Date(startTime.getTime() + 1000 * config.discard_threshold_seconds);
                var maxRateTime = new Date(endTime.getTime() - 1000 * config.discard_threshold_seconds);

                var strikes = source.Strikes;
                var reason = null;
                if (rates == null || rates.length == 0) {
                    strikes = source.Strikes + 5;
                    reason = "there are no rates";
                }
                else if (rates[0].Time > minRateTime || rates[rates.length - 1].Time < maxRateTime) {
                    strikes = config.max_strikes + 6;
                    reason = "the rates are not available for the full time span";
                }
                else if (rates.length < exports.minDays) {
                    strikes = config.max_strikes + 6;
                    reason = "too many rates are missing within time span";
                }

                if (reason == null) {
                    var similar = await model.snapshot.findAll({
                        include: [{
                            model: model.instrument
                        }, {
                            model: model.snapshotrate
                        }],
                        where: {
                            Instrument_ID: instrument.ID,
                            StartTime: startTime,
                            Time: {
                                [sequelize.Op.$gte]: endDate
                            }
                        },
                        order: [
                            ['Time'],
                            ['ID'],
                            [model.snapshotrate, "Time", "ASC"]
                        ],
                        limit: 1
                    })

                    if (similar != null && similar.length > 0) {
                        return similar[0];
                    }

                    var snapshot = await model.snapshot.create({
                        StartTime: startTime,
                        Time: endTime,
                        snapshotrates: rates,
                        Price: rates[rates.length - 1].Close,
                        PriceTime: rates[rates.length - 1].Time,
                        FirstPriceTime: rates[0].Time,
                        Instrument_ID: instrument.ID
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
                    console.log("Changing strikes on instrument " + instrument.InstrumentName + " from " + source.Strikes + " to " + strikes + " because " + reason);
                    await source.updateAttributes({
                        Strikes: strikes,
                        LastStrikeTime: new Date()
                    });
                }
            }
        }
        catch (error) {
            console.log(error);
        }

        if (lockFlag > 0) {
            break;
        }
    }

    return null;
}

exports.createNewRandomSnapshot = async function (req, res) {
    try {
        if (req.isAuthenticated()) {

            var endTime = new Date();
            endTime.setHours(0, 0, 0, 0);

            var forgotten = await sql.query(rank_open_snapshots, {
                "@userName": req.user.email,
                "@hours": config.max_unused_snapshot_age_hours
            });

            if (forgotten && forgotten.length > 0) {
                var index = getRandomIndex(forgotten.length, config.random_order_weight);
                var viewModel = await snapshotController.getSnapshot(forgotten[index].ID, req.user.email);
                res.json(viewModel);
                return;
            }

            var instrumentIds = await exports.getNewSnapshotInstruments(endTime);

            var newSnapshot = null;
            for (var i = 0; i <= config.automatic_ignores; ++i) {
                newSnapshot = await exports.createNewSnapshotFromRandomInstrument(instrumentIds);
                if (newSnapshot != null) {

                    var k = instrumentIds.indexOf(newSnapshot.Instrument_ID);
                    instrumentIds.splice(k, 1);

                    var previous = await snapshotController.getPreviousDecision(newSnapshot, req.user.email);
                    var viewModel = snapshotController.getSnapshotViewModel(newSnapshot, previous, req.user.email);

                    if (i < config.automatic_ignores && (exports.isUserAutoIgnore(viewModel) || exports.isGlobalAutoIgnore(viewModel.Rates))) {
                        await model.usersnapshot.create({
                            User: req.user.email,
                            Snapshot_ID: newSnapshot.ID,
                            Decision: "ignore",
                            ModifiedTime: new Date()
                        });
                    }
                    else {
                        res.json(viewModel);
                        return;
                    }

                }
                else {
                    break;
                }
            }

            res.status(404);
            res.json({ error: 'no instrument available' });
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
};

exports.createNewSnapshotByInstrumentId = async function (req, res) {
    try {
        if (req.isAuthenticated()) {

            var upToDateFrom = new Date(new Date().getTime() - config.snapshot_valid_seconds * 1000);
            var existing = await model.snapshot.findOne({
                where: {
                    Instrument_ID: req.params.instrumentId,
                    Time: {
                        [sequelize.Op.gte]: upToDateFrom
                    }
                }
            });
            if (existing != null) {
                var viewModel = await snapshotController.getSnapshot(existing.ID, req.user.email);
                res.json(viewModel);
                return;
            }

            var instrumentIds = [{ ID: req.params.instrumentId, Order: 1 }];

            var newSnapshot = await exports.createNewSnapshotFromRandomInstrument(instrumentIds);
            if (newSnapshot != null) {
                var viewModel = snapshotController.getSnapshotViewModel(newSnapshot, undefined, req.user.email);
                res.json(viewModel);
                return;
            }
            else {
                res.status(404);
                res.json({ error: 'instrument not available' });
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
};

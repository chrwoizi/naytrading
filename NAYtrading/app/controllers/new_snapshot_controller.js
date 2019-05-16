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

var get_open_snapshots = "";
try {
    get_open_snapshots = fs.readFileSync(__dirname + '/../sql/get_open_snapshots.sql', 'utf8');
} catch (e) {
    console.log('Error:', e.stack);
}

var lockFlag = 0;


function isEmpty(str) {
    return typeof (str) === 'undefined' || str == null || !str.length;
}

function parseDate(str) {
    return new Date("20" + str.substr(0, 2), parseInt(str.substr(2, 2)) - 1, str.substr(4, 2));
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

exports.isAutoWait = async function (newSnapshot) {
    if (newSnapshot.PreviousDecision == "buy") {
        if (newSnapshot.Rates && newSnapshot.Rates.length > 0 && newSnapshot.PreviousBuyRate != null) {
            var lastRate = newSnapshot.Rates[newSnapshot.Rates.length - 1];
            if (lastRate.C < newSnapshot.PreviousBuyRate && lastRate.C > 0.9 * newSnapshot.PreviousBuyRate) {
                return true;
            }
        }

        return false;
    }
    else if (newSnapshot.PreviousDecision == "wait1yr") {
        var date = parseDate(newSnapshot.DateSortable);
        var previousDate = parseDate(newSnapshot.PreviousTime);
        if (date.getTime() - previousDate.getTime() < 365 * 24 * 60 * 60 * 1000) {
            return true;
        }
    }
    else if (newSnapshot.PreviousDecision == "wait2mo") {
        var date = parseDate(newSnapshot.DateSortable);
        var previousDate = parseDate(newSnapshot.PreviousTime);
        if (date.getTime() - previousDate.getTime() < 60 * 24 * 60 * 60 * 1000) {
            return true;
        }
    }

    var endTime = new Date();
    endTime.setHours(0, 0, 0, 0);
    var startTime = new Date(endTime.getTime() - config.chart_period_seconds * 1000);

    var firstRatesUntil = new Date(startTime.getTime() + 1000 * (config.chart_period_seconds * 0.2));
    var lastRatesFrom = new Date(endTime.getTime() - 1000 * (config.chart_period_seconds * 0.2));

    var firstRates = newSnapshot.Rates.filter(x => x.Time < firstRatesUntil);
    var lastRates = newSnapshot.Rates.filter(x => x.Time > lastRatesFrom);

    if (firstRates.length == 0 || lastRates.length == 0) {
        return false;
    }

    var firstAverage = firstRates.map(x => x.Close).reduce((a, b) => a + b) / firstRates.length;
    var lastAverage = lastRates.map(x => x.Close).reduce((a, b) => a + b) / lastRates.length;

    // overall bearish trend
    return lastAverage < firstAverage;
}

async function handleRateProviderError(instrument, source, error) {
    if (error.message == ratesProvider.market_not_found) {
        var strikes = config.max_strikes + 12;
        console.log("Setting " + strikes + " strikes on instrument " + instrument.InstrumentName + " (" + source.SourceId + " on " + source.SourceType + ") because the market id " + source.MarketId + " does not exist");
        await source.updateAttributes({
            Strikes: strikes,
            LastStrikeTime: new Date()
        });
    }
    else if (error.message == ratesProvider.invalid_response) {
        console.log("Adding 5 strikes to instrument " + instrument.InstrumentName + " (" + source.SourceId + " on " + source.SourceType + ") because the server returned an unexpected response for market id " + source.MarketId);
        await source.updateAttributes({
            Strikes: source.Strikes + 5,
            LastStrikeTime: new Date()
        });
    }
    else {
        console.log(error.message + "\n" + error.stack);
        console.log("Adding 1 strike to instrument " + instrument.InstrumentName + " (" + source.SourceId + " on " + source.SourceType + ") because it caused an exception: " + error);
        await source.updateAttributes({
            Strikes: source.Strikes + 1,
            LastStrikeTime: new Date()
        });
    }
}

async function updateIsinWkn(instrument, isin, wkn) {
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
        instrument.Isin = isin;
        instrument.Wkn = wkn;
    }
}

exports.checkRates = function (rates, startTime, endTime, source) {

    var minRateTime = new Date(startTime.getTime() + 1000 * config.discard_threshold_seconds);
    var maxRateTime = new Date(endTime.getTime() - 1000 * config.discard_threshold_seconds);

    if (rates == null || rates.length == 0) {
        return {
            Strikes: source.Strikes + 5,
            Reason: "there are no rates"
        };
    }
    else if (rates[0].Time > minRateTime || rates[rates.length - 1].Time < maxRateTime) {
        return {
            Strikes: config.max_strikes + 6,
            Reason: "the rates are not available for the full time span"
        };
    }
    else if (rates.length < exports.minDays) {
        return {
            Strikes: config.max_strikes + 6,
            Reason: "too many rates are missing within time span"
        };
    }

    return null;
};

async function updateMarket(source, marketId) {
    if (marketId != source.MarketId) {
        // change preferred market id for source
        source.MarketId = marketId;
        await source.updateAttributes({
            MarketId: marketId
        });
    }
}

async function findSimilarSnapshot(instrumentId, startTime, endDate) {
    var snapshot = await model.snapshot.findAll({
        include: [{
            model: model.instrument
        }, {
            model: model.snapshotrate
        }],
        where: {
            Instrument_ID: instrumentId,
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
    });

    if (snapshot) {
        await snapshotController.ensureRates(snapshot);
    }
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
            var sortedSources = instrument.sources
                .filter(x => x.Status == "ACTIVE")
                .filter(x => x.Strikes < config.max_strikes)
                .filter(x => ratesProvider.sources.indexOf(x.SourceType) >= 0);
            sortedSources.sort(function (a, b) {
                var aIndex = ratesProvider.sources.indexOf(a.SourceType);
                var bIndex = ratesProvider.sources.indexOf(b.SourceType);
                return aIndex - bIndex;
            });

            for (var s = 0; s < sortedSources.length; ++s) {
                var source = sortedSources[s];
                try {

                    var problem = null;
                    async function checkRatesCallback(rates) {
                        problem = exports.checkRates(rates, startTime, endTime, source);
                        return problem == null;
                    }

                    var ratesResponse = await ratesProvider.getRates(source.SourceType, source.SourceId, source.MarketId, startTime, endTime, checkRatesCallback);

                    if (ratesResponse && ratesResponse.Rates && ratesResponse.Rates.length > 0) {

                        var rates = ratesResponse.Rates;

                        await updateIsinWkn(instrument, ratesResponse.Isin, ratesResponse.Wkn);

                        await updateMarket(source, ratesResponse.MarketId);

                        var similar = await findSimilarSnapshot(instrument.ID, startTime, endDate);

                        if (similar != null && similar.length > 0) {
                            return similar[0];
                        }

                        var snapshot = await model.snapshot.create(
                            {
                                StartTime: startTime,
                                Time: endTime,
                                snapshotrates: rates,
                                Price: rates[rates.length - 1].Close,
                                PriceTime: rates[rates.length - 1].Time,
                                FirstPriceTime: rates[0].Time,
                                Instrument_ID: instrument.ID,
                                SourceType: source.SourceType,
                                MarketId: ratesResponse.MarketId
                            },
                            {
                                include: [{
                                    model: model.instrument
                                }, {
                                    model: model.snapshotrate
                                }]
                            });

                        snapshot.instrument = instrument;
                        return snapshot;
                    }
                    else if (problem != null) {
                        console.log("Changing strikes on instrument " + instrument.InstrumentName + " from " + source.Strikes + " to " + problem.Strikes + " because " + problem.Reason);
                        await source.updateAttributes({
                            Strikes: problem.Strikes,
                            LastStrikeTime: new Date()
                        });
                    }
                }
                catch (error) {
                    await handleRateProviderError(instrument, source, error);
                }
            }
        }
        catch (error) {
            console.log(error.message + "\n" + error.stack);
        }

        if (lockFlag > 0) {
            break;
        }
    }

    return null;
}

async function handleNewRandomSnapshot(req, res, allowConfirm) {
    try {
        if (req.isAuthenticated()) {

            var endTime = new Date();
            endTime.setHours(0, 0, 0, 0);

            var isAI = req.user.email.endsWith(".ai");

            var hours = config.max_unused_snapshot_age_hours;
            if (req.query.max_age) {
                hours = parseFloat(req.query.max_age);
            }

            var forgotten = await sql.query(rank_open_snapshots, {
                "@userName": req.user.email,
                "@hours": hours,
                "@isAI": isAI ? 1 : 0
            });

            var confirm = Math.random() < config.check_rate;
            if ((allowConfirm && confirm) || !(forgotten && forgotten.length > 0)) {
                var toCheck = await sql.query("SELECT ID, Snapshot_ID, Confirmed FROM usersnapshots WHERE User = @userName AND Decision = 'buy' ORDER BY ABS(Confirmed), ModifiedTime", {
                    "@userName": req.user.email
                });

                if (toCheck && toCheck.length > 0) {
                    var index = getRandomIndex(toCheck.length, config.random_order_weight);
                    var viewModel = await snapshotController.getSnapshot(toCheck[index].Snapshot_ID, req.user.email);
                    viewModel.ConfirmDecision = toCheck[index].ID;
                    viewModel.Confirmed = toCheck[index].Confirmed;
                    res.json(viewModel);
                    return;
                }
            }

            if (forgotten && forgotten.length > 0) {
                // var index = getRandomIndex(forgotten.length, config.random_order_weight);
                var viewModel = await snapshotController.getSnapshot(forgotten[0].ID, req.user.email);
                res.json(viewModel);
                return;
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

async function handleGetOpenSnapshots(req, res) {
    try {
        if (req.isAuthenticated()) {

            var endTime = new Date();
            endTime.setHours(0, 0, 0, 0);

            var isAI = req.user.email.endsWith(".ai");

            var count = 1;
            if (req.query.count) {
                count = parseInt(req.query.count);
            }

            var forgotten = await sql.query(get_open_snapshots, {
                "@userName": req.user.email,
                "@isAI": isAI ? 1 : 0
            });

            if (forgotten && forgotten.length > 0) {
                var results = [];
                for (var i = 0; i < count; ++i) {
                    var viewModel = await snapshotController.getSnapshot(forgotten[i].ID, req.user.email);
                    results.push(viewModel);
                }
                res.json(results);
                return;
            }

            res.status(404);
            res.json({ error: 'no snapshot available' });
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

exports.createNewRandomSnapshot = async function (req, res) {
    await handleNewRandomSnapshot(req, res, false);
};

exports.createNewRandomOrConfirmSnapshot = async function (req, res) {
    await handleNewRandomSnapshot(req, res, true);
};

exports.getOpenSnapshots = async function (req, res) {
    await handleGetOpenSnapshots(req, res);
};

exports.createNewSnapshotByInstrumentId = async function (req, res) {
    try {
        if (req.isAuthenticated()) {

            var upToDateFrom = new Date(new Date().getTime() - config.snapshot_valid_seconds * 1000);
            var existing = await sql.query("SELECT s.ID FROM snapshots AS s \
                WHERE s.Instrument_ID = @instrumentId AND s.Time >= @time \
                AND NOT EXISTS (SELECT 1 FROM usersnapshots AS nu WHERE nu.Snapshot_ID = s.ID AND nu.User = @user) \
                ORDER BY s.Time ASC", {
                    "@instrumentId": req.params.instrumentId,
                    "@time": upToDateFrom,
                    "@user": req.user.email
                });

            if (existing && existing.length > 0) {
                var viewModel = await snapshotController.getSnapshot(existing[0].ID, req.user.email);
                res.json(viewModel);
                return;
            }

            var instrumentIds = [{ ID: req.params.instrumentId, Order: 1 }];

            var newSnapshot = await exports.createNewSnapshotFromRandomInstrument(instrumentIds);
            if (newSnapshot != null) {
                var previous = await snapshotController.getPreviousDecisionAndBuyRate(newSnapshot.ID, req.user.email);
                var viewModel = snapshotController.getSnapshotViewModel(newSnapshot, previous, req.user.email);
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

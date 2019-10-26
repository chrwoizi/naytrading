const model = require('../models/index');
const sql = require('../sql/sql');
const ratesProvider = require('../providers/rates_provider');
const snapshotController = require('./snapshot_controller');
const sequelize = require('sequelize');
const fs = require('fs');
const config = require('../config/envconfig');

let rank_instruments = "";
try {
    rank_instruments = fs.readFileSync(__dirname + '/../sql/rank_instruments.sql', 'utf8');
} catch (e) {
    console.log('Error:', e.stack);
}

let rank_open_snapshots = "";
try {
    rank_open_snapshots = fs.readFileSync(__dirname + '/../sql/rank_open_snapshots.sql', 'utf8');
} catch (e) {
    console.log('Error:', e.stack);
}

let get_open_snapshots = "";
try {
    get_open_snapshots = fs.readFileSync(__dirname + '/../sql/get_open_snapshots.sql', 'utf8');
} catch (e) {
    console.log('Error:', e.stack);
}

let lockFlag = 0;


function isEmpty(str) {
    return typeof (str) === 'undefined' || str == null || !str.length;
}

function parseDate(str) {
    return new Date("20" + str.substr(0, 2), parseInt(str.substr(2, 2)) - 1, str.substr(4, 2));
}

exports.getNewSnapshotInstruments = async function (endTime) {

    const upToDateFrom = new Date(endTime.getTime() - config.snapshot_valid_seconds * 1000);

    if (await model.instrument.count({}) == 0) {
        return [];
    }

    let maxCapitalization = await model.instrument.max('Capitalization');
    maxCapitalization = Math.max(maxCapitalization, 1);

    const args = {
        "@validFromDateTime": upToDateFrom,
        "@maxCapitalization": maxCapitalization,
        "@maxStrikes": config.max_strikes,
        "@strikesOrderWeight": config.strikes_order_weight,
        "@boughtOrderWeight": config.bought_order_weight,
        "@capitalizationOrderWeight": config.capitalization_order_weight,
        "@snapshotCountOrderWeight": config.snapshot_count_order_weight,
        "@staticWeight": config.static_weight
    };

    const rows = await sql.query(rank_instruments, args);

    const instrumentIds = rows.sort((a, b) => b.Order - a.Order);
    return instrumentIds;
}

/**
Gets an index from gaussian normal distribution
@param count number of list items.
@param randomRange range within the list from which to pick items. e.g. 0.33 means picking from the first third of the list.
@return An index within [0..count-1].
*/
function getRandomIndex(count, randomRange) {
    const u1 = 1.0 - Math.random();
    const u2 = 1.0 - Math.random();

    // gaussian normal distribution around 0 with standard deviation of 1
    const randStdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);

    // roughly within [0..1] where 0 has the highest probability and 1+ the lowest.
    // values are <1 with probability 99,73% but can be larger
    const randNormal = Math.abs(randStdNormal) / 3.0;

    const index = Math.floor(randNormal * count * randomRange) % count;
    return index;
}

exports.minDays = 5 * (config.chart_period_seconds / 60 / 60 / 24 / 7) - config.discard_threshold_missing_workdays;

exports.isAutoWait = async function (newSnapshot) {
    if (newSnapshot.PreviousDecision == "buy") {
        if (newSnapshot.Rates && newSnapshot.Rates.length > 0 && newSnapshot.PreviousBuyRate != null) {
            const lastRate = newSnapshot.Rates[newSnapshot.Rates.length - 1];
            if (lastRate.C < newSnapshot.PreviousBuyRate && lastRate.C > 0.9 * newSnapshot.PreviousBuyRate) {
                return true;
            }
        }

        return false;
    }

    const endTime = new Date();
    endTime.setHours(0, 0, 0, 0);
    const startTime = new Date(endTime.getTime() - config.chart_period_seconds * 1000);

    const firstRatesUntil = new Date(startTime.getTime() + 1000 * (config.chart_period_seconds * 0.2));
    const lastRatesFrom = new Date(endTime.getTime() - 1000 * (config.chart_period_seconds * 0.2));

    const firstRates = newSnapshot.Rates.filter(x => x.Time < firstRatesUntil);
    const lastRates = newSnapshot.Rates.filter(x => x.Time > lastRatesFrom);

    if (firstRates.length == 0 || lastRates.length == 0) {
        return false;
    }

    const firstAverage = firstRates.map(x => x.Close).reduce((a, b) => a + b) / firstRates.length;
    const lastAverage = lastRates.map(x => x.Close).reduce((a, b) => a + b) / lastRates.length;

    // overall bearish trend
    return lastAverage < firstAverage;
}

async function handleRateProviderError(instrument, source, error) {
    if (error.message == ratesProvider.market_not_found) {
        const strikes = config.max_strikes + 12;
        const reason = "the market id " + source.MarketId + " does not exist";
        //console.log("Setting " + strikes + " strikes on instrument " + instrument.InstrumentName + " (" + source.SourceId + " on " + source.SourceType + ") because " + reason);
        await source.update({
            Strikes: strikes,
            LastStrikeTime: new Date(),
            StrikeReason: (reason || '').substr(0, 200)
        });

        await increaseMonitor("preload_missing", source.SourceType, source.MarketId || 'null');
    }
    else if (error.message == ratesProvider.invalid_response) {
        const reason = "the server returned an unexpected response for market id " + source.MarketId;
        //console.log("Adding 5 strikes to instrument " + instrument.InstrumentName + " (" + source.SourceId + " on " + source.SourceType + ") because " + reason);
        await source.update({
            Strikes: source.Strikes + 5,
            LastStrikeTime: new Date(),
            StrikeReason: (reason || '').substr(0, 200)
        });

        await increaseMonitor("preload_invalid", source.SourceType, source.MarketId || 'null');
    }
    else {
        console.log(error.message + "\n" + error.stack);
        const reason = "it caused an exception: " + error;
        //console.log("Adding 1 strike to instrument " + instrument.InstrumentName + " (" + source.SourceId + " on " + source.SourceType + ") because " + reason);
        await source.update({
            Strikes: source.Strikes + 1,
            LastStrikeTime: new Date(),
            StrikeReason: (reason || '').substr(0, 200)
        });

        await increaseMonitor("preload_exception", source.SourceType, undefined);
    }
}

async function updateIsinWkn(instrument, isin, wkn) {
    let updated = false;
    const fields = {};
    if (isEmpty(instrument.Isin) && !isEmpty(isin)) {
        fields.Isin = isin;
        updated = true;
    }
    if (isEmpty(instrument.Wkn) && !isEmpty(wkn)) {
        fields.Wkn = wkn;
        updated = true;
    }
    if (updated) {
        await instrument.update(fields);
        instrument.Isin = isin;
        instrument.Wkn = wkn;
    }
}

exports.checkRates = function (rates, startTime, endTime, source) {

    const minRateTime = new Date(startTime.getTime() + 1000 * config.discard_threshold_seconds);
    const maxRateTime = new Date(endTime.getTime() - 1000 * config.discard_threshold_seconds);

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
        await source.update({
            MarketId: marketId
        });
    }
}

async function findSimilarSnapshot(instrumentId, startTime, endDate) {
    const snapshot = await model.snapshot.findAll({
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
    const endTime = new Date();
    const endDate = new Date(endTime.getTime());
    endDate.setHours(0, 0, 0, 0);
    const startTime = new Date(endDate.getTime() - config.chart_period_seconds * 1000);

    // try to load rates of a random instrument. 
    // if rates can not be loaded, try another random instrument. 
    // try for a fixed number of times to avoid infinite loop.
    for (let i = 0; i < Math.min(instrumentIds.length, 10); ++i) {
        const index = getRandomIndex(instrumentIds.length, config.random_order_weight);

        const instrument = await model.instrument.findOne({
            where: {
                ID: instrumentIds[index].ID,
            },
            include: [{
                model: model.source
            }]
        });

        try {
            const sortedSources = instrument.sources
                .filter(x => x.Status == "ACTIVE")
                .filter(x => x.Strikes < config.max_strikes)
                .filter(x => ratesProvider.sources.indexOf(x.SourceType) >= 0);
            sortedSources.sort(function (a, b) {
                const aIndex = ratesProvider.sources.indexOf(a.SourceType);
                const bIndex = ratesProvider.sources.indexOf(b.SourceType);
                return aIndex - bIndex;
            });

            for (let s = 0; s < sortedSources.length; ++s) {
                const source = sortedSources[s];
                try {

                    let problem = null;
                    async function checkRatesCallback(rates) {
                        problem = exports.checkRates(rates, startTime, endTime, source);
                        return problem == null;
                    }

                    const ratesResponse = await ratesProvider.getRates(source.SourceType, source.SourceId, source.MarketId, startTime, endTime, checkRatesCallback);

                    if (ratesResponse && ratesResponse.Rates && ratesResponse.Rates.length > 0) {

                        const rates = ratesResponse.Rates;

                        await updateIsinWkn(instrument, ratesResponse.Isin, ratesResponse.Wkn);

                        await updateMarket(source, ratesResponse.MarketId);

                        const similar = await findSimilarSnapshot(instrument.ID, startTime, endDate);

                        if (similar != null && similar.length > 0) {
                            return similar[0];
                        }

                        await increaseMonitor("preload_ok", source.SourceType, ratesResponse.MarketId || 'null');

                        const snapshot = await model.snapshot.create(
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
                        //console.log("Changing strikes on instrument " + instrument.InstrumentName + " from " + source.Strikes + " to " + problem.Strikes + " because " + problem.Reason);
                        await source.update({
                            Strikes: problem.Strikes,
                            LastStrikeTime: new Date(),
                            StrikeReason: (problem.Reason || '').substr(0, 200)
                        });

                        await increaseMonitor("preload_rates", source.SourceType, source.MarketId || 'null');
                    }
                    else {
                        await handleRateProviderError(instrument, source, new Error(ratesProvider.market_not_found));
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

async function increaseMonitor(name, sourceType, marketId) {
    const monitors = await sql.query("select id, value from monitors as m where m.`key` = @key and m.createdAt > CURDATE()",
        {
            "@key": name
        });

    let monitor;
    if (monitors.length > 0) {
        monitor = JSON.parse(monitors[0].value || "{}");
    }
    else {
        monitor = {};
    }

    if (!monitor.sources) {
        monitor.sources = {};
    }

    if (typeof (marketId) !== 'undefined') {
        if (!monitor.sources[sourceType]) {
            monitor.sources[sourceType] = {};
        }

        if (!monitor.sources[sourceType].markets) {
            monitor.sources[sourceType].markets = {};
        }

        if (!monitor.sources[sourceType].markets[marketId]) {
            monitor.sources[sourceType].markets[marketId] = 0;
        }

        monitor.sources[sourceType].markets[marketId]++;
    }
    else {
        if (!monitor.sources[sourceType]) {
            monitor.sources[sourceType] = 0;
        }

        monitor.sources[sourceType]++;
    }

    if (monitors.length == 0) {
        await model.monitor.create({
            key: name,
            value: JSON.stringify(monitor)
        });
    }
    else {
        await model.monitor.update(
            {
                value: JSON.stringify(monitor)
            },
            {
                where: {
                    id: monitors[0].id
                }
            });
    }
}

async function handleNewRandomSnapshot(req, res, allowConfirm) {
    try {
        if (req.isAuthenticated()) {

            const endTime = new Date();
            endTime.setHours(0, 0, 0, 0);

            let hours = config.max_unused_snapshot_age_hours;
            if (req.query.max_age) {
                hours = parseFloat(req.query.max_age);
            }

            const forgotten = await sql.query(rank_open_snapshots, {
                "@userName": req.user.email,
                "@hours": hours
            });

            const confirm = Math.random() < config.check_rate;
            if ((allowConfirm && confirm) || !(forgotten && forgotten.length > 0)) {
                const toCheck = await sql.query("SELECT ID, Snapshot_ID, Confirmed FROM usersnapshots WHERE User = @userName AND Decision = 'buy' ORDER BY ABS(Confirmed), ModifiedTime", {
                    "@userName": req.user.email
                });

                if (toCheck && toCheck.length > 0) {
                    const index = getRandomIndex(toCheck.length, config.random_order_weight);
                    const viewModel = await snapshotController.getSnapshot(toCheck[index].Snapshot_ID, req.user.email);
                    viewModel.ConfirmDecision = toCheck[index].ID;
                    viewModel.Confirmed = toCheck[index].Confirmed;
                    res.json({ snapshot: viewModel });
                    return;
                }
            }

            if (forgotten && forgotten.length > 0) {
                // const index = getRandomIndex(forgotten.length, config.random_order_weight);
                const viewModel = await snapshotController.getSnapshot(forgotten[0].ID, req.user.email);
                res.json({ snapshot: viewModel });
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
}

async function handleGetOpenSnapshots(req, res) {
    try {
        if (req.isAuthenticated()) {

            const endTime = new Date();
            endTime.setHours(0, 0, 0, 0);

            let count = 1;
            if (req.query.count) {
                count = parseInt(req.query.count);
            }

            const forgotten = await sql.query(get_open_snapshots, {
                "@userName": req.user.email,
                "@maxCount": count
            });

            if (forgotten && forgotten.length > 0) {
                const results = [];
                for (let i = 0; i < count && i < forgotten.length; ++i) {
                    const viewModel = await snapshotController.getSnapshot(forgotten[i].ID, req.user.email);
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
}

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

            const upToDateFrom = new Date(new Date().getTime() - config.snapshot_valid_seconds * 1000);
            const existing = await sql.query("SELECT s.ID FROM snapshots AS s \
                WHERE s.Instrument_ID = @instrumentId AND s.Time >= @time \
                AND NOT EXISTS (SELECT 1 FROM usersnapshots AS nu WHERE nu.Snapshot_ID = s.ID AND nu.User = @user) \
                ORDER BY s.Time ASC", {
                    "@instrumentId": req.params.instrumentId,
                    "@time": upToDateFrom,
                    "@user": req.user.email
                });

            if (existing && existing.length > 0) {
                const viewModel = await snapshotController.getSnapshot(existing[0].ID, req.user.email);
                res.json({ snapshot: viewModel });
                return;
            }

            const instrumentIds = [{ ID: req.params.instrumentId, Order: 1 }];

            const newSnapshot = await exports.createNewSnapshotFromRandomInstrument(instrumentIds);
            if (newSnapshot != null) {
                const previous = await snapshotController.getPreviousDecisionAndBuyRate(newSnapshot.ID, req.user.email);
                const viewModel = snapshotController.getSnapshotViewModel(newSnapshot, previous, req.user.email);
                res.json({ snapshot: viewModel });
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

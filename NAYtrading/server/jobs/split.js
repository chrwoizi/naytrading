const fs = require('fs');
const model = require('../models/index');
const sql = require('../sql/sql');
const config = require('../config/envconfig');
const ratesProvider = require('../providers/rates_provider');
const newSnapshotController = require('../controllers/new_snapshot_controller');
const snapshotController = require('../controllers/snapshot_controller');
const instrumentController = require('../controllers/instrument_controller');
const consolidateJob = require('./consolidate');
const cleanupJob = require('./cleanup');
const { parseDate } = require('../tools');

let split_adjust_sql = "";
try {
    split_adjust_sql = fs.readFileSync(__dirname + '/../sql/split_adjust_newest.sql', 'utf8');
} catch (e) {
    console.log('Error:', e.stack);
}


let previousTime = new Date();
function logVerbose(message) {
    if (config.env == "development") {
        const now = new Date();
        if (now.getTime() - previousTime.getTime() > 1000) {
            previousTime = now;
            console.log(message);
        }
    }
}

function sleep(ms) {
    return new Promise((resolve, reject) => {
        try {
            setTimeout(resolve, ms);
        }
        catch (e) {
            reject(e);
        }
    });
}

function daysBetween(one, another) {
    return Math.abs((+one) - (+another)) / 8.64e7;
}

function addDays(date, days) {
    return new Date(date.getTime() + days * 8.64e7);
}

function getDay(date) {
    const day = new Date(date.getTime());
    day.setHours(0, 0, 0, 0);
    return day;
}

exports.getError = function (rates1, rates2, getMedian) {
    const factors = [];
    let errorSum = 0;
    let errorCount = 0;
    let i = 0;
    for (let s = 0; s < rates1.length; ++s) {
        const rate1 = rates1[s];
        const rate1Time = parseDate(rate1.Time);
        while (i < rates2.length && parseDate(rates2[i].Time) < rate1Time) {
            i++;
        }
        if (i >= rates2.length) {
            break;
        }
        if (daysBetween(parseDate(rates2[i].Time), rate1Time) >= 1) {
            continue;
        }
        const error = (rates2[i].Close - rate1.Close) / rate1.Close;
        errorSum += Math.abs(error);
        errorCount++;
        if (getMedian) {
            factors.push(rates2[i].Close / rate1.Close);
        }
    }

    let median;
    if (getMedian) {
        factors.sort();
        median = factors[Math.floor(factors.length / 2)];
    }

    return {
        count: errorCount,
        errorSum: errorSum,
        errorAvg: errorSum / errorCount,
        factorMedian: median
    }
};

function isBigChange(ratio) {
    if (ratio > 1.9 || (1 / ratio) > 1.9) {
        return true;
    }
    return false;
}

function getCandidates(prePre, pre, rate) {
    const candidates = [];

    //candidates.push({ preTime: rate.Time, curTime: rate.Time, preOpen: true, curOpen: false, preRate: rate.Open, curRate: rate.Close });
    //candidates.push({ preTime: pre.Time, curTime: rate.Time, preOpen: false, curOpen: true, preRate: pre.Close, curRate: rate.Open });
    candidates.push({ preTime: pre.Time, curTime: rate.Time, preOpen: false, curOpen: false, preRate: pre.Close, curRate: rate.Close });
    //candidates.push({ preTime: pre.Time, curTime: rate.Time, preOpen: true, curOpen: true, preRate: pre.Open, curRate: rate.Open });
    //candidates.push({ preTime: pre.Time, curTime: rate.Time, preOpen: true, curOpen: false, preRate: pre.Open, curRate: rate.Close });
    //candidates.push({ preTime: prePre.Time, curTime: rate.Time, preOpen: false, curOpen: true, preRate: prePre.Close, curRate: rate.Open });
    candidates.push({ preTime: prePre.Time, curTime: rate.Time, preOpen: false, curOpen: false, preRate: prePre.Close, curRate: rate.Close });
    //candidates.push({ preTime: prePre.Time, curTime: rate.Time, preOpen: true, curOpen: true, preRate: prePre.Open, curRate: rate.Open });
    //candidates.push({ preTime: prePre.Time, curTime: rate.Time, preOpen: true, curOpen: false, preRate: prePre.Open, curRate: rate.Close });

    for (let c = 0; c < candidates.length; ++c) {
        const candidate = candidates[c];
        candidate.ratio = candidate.curRate / candidate.preRate;
    }

    return candidates;
}

function getDistinctFindings(findings, days) {
    let prevFinding = null;
    const distinct = [];
    for (let f = 0; f < findings.length; ++f) {
        const finding = findings[f];
        if (prevFinding == null) {
            // first
            distinct.push(finding);
        }
        else if ((finding.curTime - prevFinding.curTime) > days * 24 * 60 * 60 * 1000) {
            // much later
            distinct.push(finding);
        }
        else if (Math.sign(1 - finding.ratio) != Math.sign(1 - prevFinding.ratio)) {
            // spike
            distinct.splice(distinct.indexOf(prevFinding), 1);
        }
        prevFinding = finding;
    }
    return distinct;
}

function getHunchFromRates(rates) {
    let status = "NO";

    if (rates && rates.length) {
        const findings = [];

        let prePre = rates[0];
        let pre = rates[0];
        for (let r = 0; r < rates.length; ++r) {
            const rate = rates[r];
            rate.Time = parseDate(rate.Time);

            const candidates = getCandidates(prePre, pre, rate);
            for (let c = 0; c < candidates.length; ++c) {
                const candidate = candidates[c];
                if (isBigChange(candidate.ratio)) {
                    findings.push(candidate);
                    break;
                }
            }

            prePre = pre;
            pre = rate;
        }

        const detections = getDistinctFindings(findings, 5);
        if (detections.length > 0) {
            status = "HUNCH";
        }
    }

    return status;
}

async function getSnapshotHunches() {
    const ids = await sql.query("SELECT s.ID FROM snapshots AS s WHERE s.Split IS NULL OR (s.Split IN ('NODIFF', 'NOSOURCE', 'FIXED') AND s.updatedAt < NOW() - INTERVAL @minDaysSinceRefresh DAY)", {
        "@minDaysSinceRefresh": config.job_split_hunch_min_days_since_refresh
    });

    for (let i = 0; i < ids.length; ++i) {
        const snapshotId = ids[i].ID;

        try {
            const rates = await sql.query("SELECT r.Time, r.Open, r.Close FROM snapshotrates AS r WHERE r.Snapshot_ID = @snapshotId", {
                "@snapshotId": snapshotId
            });

            const status = getHunchFromRates(rates);

            await sql.query("UPDATE snapshots AS s SET s.Split = @status WHERE s.ID = @snapshotId", {
                "@snapshotId": snapshotId,
                "@status": status
            });
        }
        catch (error) {
            console.log("error in split job getHunches for " + JSON.stringify(ids[i]) + ": " + error.message + "\n" + error.stack);
        }

        logVerbose("split job getHunches: " + (100 * i / ids.length).toFixed(2) + "%");
    }
}

async function getInstrumentHunches() {
    const ids = await sql.query("SELECT i.ID FROM instruments AS i WHERE i.Split IS NULL OR (i.Split IN ('NODIFF', 'NOSOURCE', 'FIXED') AND i.SplitUpdatedAt < NOW() - INTERVAL @minDaysSinceRefresh DAY)", {
        "@minDaysSinceRefresh": config.job_split_hunch_min_days_since_refresh
    });

    for (let i = 0; i < ids.length; ++i) {
        const instrumentId = ids[i].ID;

        try {
            const rates = await sql.query("SELECT r.Time, r.Open, r.Close FROM instrumentrates AS r WHERE r.Instrument_ID = @instrumentId", {
                "@instrumentId": instrumentId
            });

            const status = getHunchFromRates(rates);

            if (status == "HUNCH") {
                await sql.query("UPDATE instruments AS i SET i.Split = @status WHERE i.ID = @instrumentId", {
                    "@instrumentId": instrumentId,
                    "@status": status
                });
            }
            else {
                await sql.query("UPDATE instruments AS i SET i.Split = 'NODIFF', i.SplitUpdatedAt = NOW() WHERE i.ID = @instrumentId", {
                    "@instrumentId": instrumentId
                });
            }
        }
        catch (error) {
            console.log("error in split job getInstrumentHunches for " + JSON.stringify(ids[i]) + ": " + error.message + "\n" + error.stack);
        }

        logVerbose("split job getInstrumentHunches: " + (100 * i / ids.length).toFixed(2) + "%");
    }
}

async function fixSnapshotHunches() {
    const items = await sql.query("SELECT s.ID, s.SourceType, s.Instrument_ID, s.StartTime, s.Time FROM snapshots AS s WHERE s.Split = 'HUNCH' ORDER BY s.Time DESC");

    for (let i = 0; i < items.length; ++i) {
        try {
            await fixSnapshotSplit(items[i].ID, items[i].SourceType, items[i].Instrument_ID, parseDate(items[i].StartTime), parseDate(items[i].Time));
        }
        catch (error) {
            console.log("error in split job fixHunches for " + JSON.stringify(items[i]) + ": " + error.message + "\n" + error.stack);
        }

        logVerbose("split job fixHunches: " + (100 * i / items.length).toFixed(2) + "%");
    }
}

async function fixInstrumentHunchesAndDiffs() {
    const items = await sql.query("SELECT i.ID FROM instruments AS i WHERE i.Split = 'HUNCH' OR i.Split = 'DIFF' ORDER BY i.SplitUpdatedAt ASC");

    for (let i = 0; i < items.length; ++i) {
        try {
            await exports.fixInstrumentSplit(items[i].ID);
        }
        catch (error) {
            console.log("error in split job fixInstrumentHunches for " + JSON.stringify(items[i]) + ": " + error.message + "\n" + error.stack);
        }

        logVerbose("split job fixInstrumentHunches: " + (100 * i / items.length).toFixed(2) + "%");
    }
}

async function refreshRates(snapshotId, newSource, newMarketId, instrumentId, startTime, endTime) {

    async function checkRatesCallback(rates) {
        let problem = newSnapshotController.checkRates(rates, startTime, endTime, newSource);
        return problem == null;
    }

    const sources = await model.source.findAll({
        where: {
            Instrument_ID: instrumentId,
            SourceType: newSource
        }
    });

    const sourceInfo = sources[0];

    let status = "NOSOURCE";

    try {
        const ratesResponse = await ratesProvider.getRates(newSource, sourceInfo.SourceId, newMarketId, startTime, endTime, checkRatesCallback);
        if (ratesResponse && ratesResponse.Rates) {
            const newRates = ratesResponse.Rates;

            status = "FIXED";
            await snapshotController.setRates(snapshotId, ratesResponse.Source, ratesResponse.MarketId, newRates, endTime);
        }
    }
    catch (e) {
        if (e.message == ratesProvider.market_not_found) {
            // expected
        }
        else if (e.message == ratesProvider.invalid_response) {
            // expected
        }
        else {
            throw e;
        }
    }

    await sql.query("UPDATE snapshots AS s SET s.Split = @status, s.updatedAt = NOW() WHERE s.ID = @snapshotId", {
        "@status": status,
        "@snapshotId": snapshotId
    });
}

async function fixPriceDifferences() {
    const items = await sql.query(split_adjust_sql, {
        "@minDiffRatio": config.job_split_min_diff_ratio,
        "@minDaysSinceRefresh": config.job_split_diff_min_days_since_refresh
    });

    for (let i = 0; i < items.length; ++i) {

        const item = items[i];

        try {
            const snapshots = await sql.query("SELECT s.ID, s.StartTime, s.Time FROM snapshots AS s WHERE s.Instrument_ID = @instrumentId AND EXISTS (SELECT 1 FROM snapshotrates AS r WHERE r.Snapshot_ID = s.ID)", {
                "@instrumentId": item.Instrument_ID
            });

            for (let s = 0; s < snapshots.length; ++s) {
                try {
                    await refreshRates(snapshots[s].ID, item.NewSourceType, item.NewMarketId, item.Instrument_ID, parseDate(snapshots[s].StartTime), parseDate(snapshots[s].Time));
                }
                catch (error) {
                    console.log("error in split job fixPriceDifferences for " + JSON.stringify([item, snapshots[s]]) + ": " + error.message + "\n" + error.stack);
                }

                logVerbose("split job fixPriceDifferences: " + (100 * (i + s / snapshots.length) / items.length).toFixed(2) + "%");
            }
        }
        catch (error) {
            console.log("error in split job fixPriceDifferences for " + JSON.stringify(item) + ": " + error.message + "\n" + error.stack);
        }

        logVerbose("split job fixPriceDifferences: " + (100 * i / items.length).toFixed(2) + "%");
    }
}

async function fixSnapshotSplit(snapshotId, knownSource, instrumentId, startTime, endTime) {
    const knownRates = await model.snapshotrate.findAll({
        where: {
            Snapshot_ID: snapshotId
        },
        orderBy: [
            ['Time', 'ASC']
        ]
    });

    if (!knownRates || !knownRates.length) {
        await sql.query("UPDATE snapshots AS s SET s.Split = 'NO', s.updatedAt = NOW() WHERE s.ID = @snapshotId", {
            "@snapshotId": snapshotId
        });
        return;
    }

    const newSources = ratesProvider.sources.slice();

    // ignore old source
    const knownSourceIndex = newSources.indexOf(knownSource);
    if (knownSourceIndex >= 0) {
        newSources.splice(knownSourceIndex, 1);
    }

    // keep only configured sources
    for (let i = 0; i < newSources.length; ++i) {
        const newSource = newSources[i];
        if (config.job_split_sources.indexOf(newSource) == -1) {
            newSources.splice(i, 1);
            --i;
        }
    }

    const sources = await model.source.findAll({
        where: {
            Instrument_ID: instrumentId
        }
    });

    // keep only available sources
    const availableSources = sources.map(x => x.SourceType);
    for (let i = 0; i < newSources.length; ++i) {
        const newSource = newSources[i];
        if (availableSources.indexOf(newSource) == -1) {
            newSources.splice(i, 1);
            --i;
        }
    }

    if (newSources.length == 0) {
        await sql.query("UPDATE snapshots AS s SET s.Split = 'NOSOURCE', s.updatedAt = NOW() WHERE s.ID = @snapshotId", {
            "@snapshotId": snapshotId
        });
        return;
    }

    let status = "NOSOURCE";
    for (let i = 0; i < newSources.length; ++i) {
        const newSource = newSources[i];

        async function checkRatesCallback(rates) {
            let problem = newSnapshotController.checkRates(rates, startTime, endTime, newSource);
            return problem == null;
        }

        const sourceInfo = sources.filter(x => x.SourceType == newSource)[0];
        try {
            const ratesResponse = await ratesProvider.getRates(sourceInfo.SourceType, sourceInfo.SourceId, sourceInfo.MarketId, startTime, endTime, checkRatesCallback);
            if (ratesResponse && ratesResponse.Rates) {
                const newRates = ratesResponse.Rates;

                status = "NODIFF";

                const diffs = [];
                for (let k = 0, n = 0; k < knownRates.length && n < newRates.length; ++k) {
                    const knownRate = knownRates[k];
                    while (n < newRates.length && getDay(newRates[n].Time) < getDay(parseDate(knownRate.Time)))++n;
                    if (n < newRates.length) {
                        const newRate = newRates[n];
                        const diff = (newRate.Close - knownRate.Close) / knownRate.Close;
                        if (Math.abs(diff) > config.job_split_min_diff_ratio) {
                            diffs.push(diff);
                        }
                    }
                }

                if (diffs.length > config.job_split_min_diff_days) {
                    status = "FIXED";
                    await snapshotController.setRates(snapshotId, ratesResponse.Source, ratesResponse.MarketId, newRates, endTime);
                    break;
                }
            }
        }
        catch (e) {
            if (e && e.message == ratesProvider.market_not_found) {
                // expected
            }
            else if (e && e.message == ratesProvider.invalid_response) {
                // expected
            }
            else {
                await sql.query("UPDATE snapshots AS s SET s.Split = @status, s.updatedAt = NOW() WHERE s.ID = @snapshotId", {
                    "@status": "NOSOURCE",
                    "@snapshotId": snapshotId
                });
                throw e;
            }
        }
    }

    await sql.query("UPDATE snapshots AS s SET s.Split = @status, s.updatedAt = NOW() WHERE s.ID = @snapshotId", {
        "@status": status,
        "@snapshotId": snapshotId
    });
}

exports.fixInstrumentSplit = async function (instrumentId) {

    const instrument = await model.instrument.findOne({ where: { ID: instrumentId } });
    if (!instrument) {
        return;
    }

    if (instrument.SplitUpdatedAt != null && daysBetween(parseDate(instrument.SplitUpdatedAt), new Date()) < config.job_split_hunch_min_days_since_refresh) {
        return;
    }

    const rateTimes = await sql.query("SELECT MIN(r.Time) AS startTime, MAX(r.Time) AS endTime FROM instrumentrates r WHERE r.Instrument_ID = @instrumentId GROUP BY r.Instrument_ID", {
        "@instrumentId": instrumentId
    });

    if (!rateTimes || !rateTimes.length) {
        return;
    }

    const oldRates = await model.instrumentrate.findAll({ where: { Instrument_ID: instrumentId }, orderBy: [["Time", "ASC"]] }).map(x => x.get({ plain: true }));

    const startTime = parseDate(rateTimes[0].startTime);
    const endTime = parseDate(rateTimes[0].endTime);

    const getStartTime = new Date(endTime.getTime() - config.chart_period_seconds * 1000);

    const sources = await model.source.findAll({
        where: {
            Instrument_ID: instrumentId
        }
    });

    let status = "NOSOURCE";

    if (sources && sources.length) {
        for (let sourceInfo of sources) {

            async function checkRatesCallback(rates) {
                if (rates.length < newSnapshotController.minDays) {
                    return false;
                }

                const firstRate = parseDate(rates[0].Time);
                const lastRate = parseDate(rates[rates.length - 1].Time);

                if (lastRate < endTime) {
                    return false;
                }

                if (firstRate > getStartTime) {
                    return false;
                }

                return true;
            }

            let ratesResponse;
            try {
                ratesResponse = await ratesProvider.getRates(sourceInfo.SourceType, sourceInfo.SourceId, sourceInfo.MarketId, addDays(startTime, -1), addDays(endTime, 1), checkRatesCallback);
            }
            catch (e) {
                if (e.message == ratesProvider.market_not_found) {
                    // expected
                }
                else if (e.message == ratesProvider.invalid_response) {
                    // expected
                }
                else {
                    throw e;
                }
            }

            if (ratesResponse && ratesResponse.Rates) {
                const newRates = ratesResponse.Rates;

                const firstRate = parseDate(newRates[0].Time);
                const lastRate = parseDate(newRates[newRates.length - 1].Time);

                if (lastRate < endTime) {
                    continue;
                }

                if (firstRate > getStartTime) {
                    continue;
                }

                const error = exports.getError(oldRates, newRates, firstRate > startTime);
                if (error.count < newSnapshotController.minDays * config.job_consolidate_min_match) {
                    continue;
                }

                if (error.errorAvg < config.job_consolidate_max_error) {
                    status = "NODIFF";
                    break;
                }

                let rates;
                if (firstRate > startTime) {
                    // modify old rates and replace new rates

                    let factor = error.factorMedian;
                    if (Math.abs(factor - Math.round(factor)) < 0.01) {
                        factor = Math.round(factor);
                    }

                    for (let rate of oldRates) {
                        if (rate.Open) {
                            rate.Open *= error.errorMedian;
                        }
                        if (rate.Close) {
                            rate.Close *= error.errorMedian;
                        }
                        if (rate.High) {
                            rate.High *= error.errorMedian;
                        }
                        if (rate.Low) {
                            rate.Low *= error.errorMedian;
                        }
                    }

                    rates = oldRates.filter(x => parseDate(x.Time) < firstRate).concat(newRates);
                }
                else {
                    // use new rates
                    rates = newRates;
                }

                await instrumentController.setInstrumentRates(instrumentId, rates);
            }
        }
    }

    await model.instrument.update(
        {
            Split: status,
            SplitUpdatedAt: new Date()
        },
        {
            where: {
                ID: instrumentId
            }
        });
};

exports.run = async function () {
    try {

        while (consolidateJob.isRunning || cleanupJob.isRunning) {
            await sleep(1000);
        }

        exports.isRunning = true;

        await getSnapshotHunches();
        await fixSnapshotHunches();

        await fixPriceDifferences();

        await getInstrumentHunches();
        await fixInstrumentHunchesAndDiffs();

    }
    catch (error) {
        console.log("error in split job: " + error.message + "\n" + error.stack);
    }
    finally {
        exports.isRunning = false;
    }

    setTimeout(exports.run, config.job_split_interval_seconds * 1000);
};
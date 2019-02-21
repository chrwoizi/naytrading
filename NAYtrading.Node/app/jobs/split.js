var exports = module.exports = {}
var fs = require('fs');
var model = require('../models/index');
var sequelize = require('sequelize');
var sql = require('../sql/sql');
var config = require('../config/envconfig');
var ratesProvider = require('../providers/rates_provider');
var newSnapshotController = require('../controllers/new_snapshot_controller');
var snapshotController = require('../controllers/snapshot_controller');

var split_adjust_sql = "";
try {
    split_adjust_sql = fs.readFileSync(__dirname + '/../sql/split_adjust_newest.sql', 'utf8');
} catch (e) {
    console.log('Error:', e.stack);
}


var previousTime = new Date();
function logVerbose(message) {
    if (config.env == "development") {
        var now = new Date();
        if (now.getTime() - previousTime.getTime() > 1000) {
            previousTime = now;
            console.log(message);
        }
    }
}

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

function isBigChange(ratio) {
    if (ratio > 1.9 || (1 / ratio) > 1.9) {
        return true;
    }
    return false;
}

function getCandidates(prePre, pre, rate) {
    var candidates = [];

    //candidates.push({ preTime: rate.Time, curTime: rate.Time, preOpen: true, curOpen: false, preRate: rate.Open, curRate: rate.Close });
    //candidates.push({ preTime: pre.Time, curTime: rate.Time, preOpen: false, curOpen: true, preRate: pre.Close, curRate: rate.Open });
    candidates.push({ preTime: pre.Time, curTime: rate.Time, preOpen: false, curOpen: false, preRate: pre.Close, curRate: rate.Close });
    //candidates.push({ preTime: pre.Time, curTime: rate.Time, preOpen: true, curOpen: true, preRate: pre.Open, curRate: rate.Open });
    //candidates.push({ preTime: pre.Time, curTime: rate.Time, preOpen: true, curOpen: false, preRate: pre.Open, curRate: rate.Close });
    //candidates.push({ preTime: prePre.Time, curTime: rate.Time, preOpen: false, curOpen: true, preRate: prePre.Close, curRate: rate.Open });
    candidates.push({ preTime: prePre.Time, curTime: rate.Time, preOpen: false, curOpen: false, preRate: prePre.Close, curRate: rate.Close });
    //candidates.push({ preTime: prePre.Time, curTime: rate.Time, preOpen: true, curOpen: true, preRate: prePre.Open, curRate: rate.Open });
    //candidates.push({ preTime: prePre.Time, curTime: rate.Time, preOpen: true, curOpen: false, preRate: prePre.Open, curRate: rate.Close });

    for (var c = 0; c < candidates.length; ++c) {
        var candidate = candidates[c];
        candidate.ratio = candidate.curRate / candidate.preRate;
    }

    return candidates;
}

function getDistinctFindings(findings, days) {
    var prevFinding = null;
    var distinct = [];
    for (var f = 0; f < findings.length; ++f) {
        var finding = findings[f];
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

async function getHunch(snapshotId) {
    var rates = await sql.query("SELECT r.Time, r.Open, r.Close FROM snapshotrates AS r WHERE r.Snapshot_ID = @snapshotId", {
        "@snapshotId": snapshotId
    });

    var status = "NO";
    var findings = [];

    var prePre = rates[0];
    var pre = rates[0];
    for (var r = 0; r < rates.length; ++r) {
        var rate = rates[r];
        rate.Time = parseDate(rate.Time);

        var candidates = getCandidates(prePre, pre, rate);
        for (var c = 0; c < candidates.length; ++c) {
            var candidate = candidates[c];
            if (isBigChange(candidate.ratio)) {
                findings.push(candidate);
                break;
            }
        }

        var prePre = pre;
        var pre = rate;
    }

    var detections = getDistinctFindings(findings, 5);
    if (detections.length > 0) {
        status = "HUNCH";
        //console.log("split job HUNCH at " + snapshotId + ": " + JSON.stringify(detections));
    }

    await sql.query("UPDATE snapshots AS s SET s.Split = @status, s.updatedAt = NOW() WHERE s.ID = @snapshotId", {
        "@snapshotId": snapshotId,
        "@status": status
    });
}

async function getHunches() {
    var ids = await sql.query("SELECT s.ID FROM snapshots AS s WHERE s.Split IS NULL OR (s.Split IN ('NODIFF', 'NOSOURCE', 'FIXED') AND s.updatedAt < NOW() - INTERVAL @minDaysSinceRefresh DAY)", {
        "@minDaysSinceRefresh": config.job_split_hunch_min_days_since_refresh
    });

    for (var i = 0; i < ids.length; ++i) {
        var id = ids[i].ID;

        try {
            await getHunch(id);
        }
        catch (error) {
            console.log("error in split job getHunches for " + JSON.stringify(ids[i]) + ": " + error);
        }

        logVerbose("split job getHunches: " + (100 * i / ids.length).toFixed(2) + "%");
    }
}

function getDay(date) {
    var day = new Date(date.getTime());
    day.setHours(0, 0, 0, 0);
    return day;
}

async function fixHunch(snapshotId, knownSource, instrumentId, startTime, endTime) {
    var knownRates = await model.snapshotrate.findAll({
        where: {
            Snapshot_ID: snapshotId
        },
        orderBy: [
            ['Time', 'ASC']
        ]
    });

    var newSources = ratesProvider.sources.slice();

    // ignore old source
    var knownSourceIndex = newSources.indexOf(knownSource);
    if (knownSourceIndex >= 0) {
        newSources.splice(knownSourceIndex, 1);
    }

    // keep only configured sources
    for (var i = 0; i < newSources.length; ++i) {
        var newSource = newSources[i];
        if (config.job_split_sources.indexOf(newSource) == -1) {
            newSources.splice(i, 1);
            --i;
        }
    }

    var sources = await model.source.findAll({
        where: {
            Instrument_ID: instrumentId
        }
    });

    // keep only available sources
    var availableSources = sources.map(x => x.SourceType);
    for (var i = 0; i < newSources.length; ++i) {
        var newSource = newSources[i];
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

    var status = "NOSOURCE";
    for (var i = 0; i < newSources.length; ++i) {
        var newSource = newSources[i];

        async function checkRatesCallback(rates) {
            problem = newSnapshotController.checkRates(rates, startTime, endTime, newSource);
            return problem == null;
        }

        var sourceInfo = sources.filter(x => x.SourceType == newSource)[0];
        try {
            var ratesResponse = await ratesProvider.getRates(sourceInfo.SourceType, sourceInfo.SourceId, sourceInfo.MarketId, startTime, endTime, checkRatesCallback);
            if (ratesResponse && ratesResponse.Rates) {
                var newRates = ratesResponse.Rates;

                status = "NODIFF";

                var diffs = [];
                for (var k = 0, n = 0; k < knownRates.length && n < newRates.length; ++k) {
                    var knownRate = knownRates[k];
                    while (n < newRates.length && getDay(newRates[n].Time) < getDay(parseDate(knownRate.Time)))++n;
                    if (n < newRates.length) {
                        var newRate = newRates[n];
                        var diff = (newRate.Close - knownRate.Close) / knownRate.Close;
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
            if (e == ratesProvider.market_not_found) {
                // expected
            }
            else if (e == ratesProvider.invalid_response) {
                // expected
            }
            else {
                throw e;
            }
        }
    }

    await sql.query("UPDATE snapshots AS s SET s.Split = @status, s.updatedAt = NOW() WHERE s.ID = @snapshotId", {
        "@status": status,
        "@snapshotId": snapshotId
    });
}

async function fixHunches() {
    var items = await sql.query("SELECT s.ID, s.SourceType, s.Instrument_ID, s.StartTime, s.Time FROM snapshots AS s WHERE s.Split = 'HUNCH' ORDER BY s.Time DESC");

    for (var i = 0; i < items.length; ++i) {
        try {
            await fixHunch(items[i].ID, items[i].SourceType, items[i].Instrument_ID, parseDate(items[i].StartTime), parseDate(items[i].Time));
        }
        catch (error) {
            console.log("error in split job fixHunches for " + JSON.stringify(items[i]) + ": " + error);
        }

        logVerbose("split job fixHunches: " + (100 * i / items.length).toFixed(2) + "%");
    }
}

async function refreshRates(snapshotId, newSource, newMarketId, instrumentId, startTime, endTime) {

    async function checkRatesCallback(rates) {
        problem = newSnapshotController.checkRates(rates, startTime, endTime, newSource);
        return problem == null;
    }

    var sources = await model.source.findAll({
        where: {
            Instrument_ID: instrumentId,
            SourceType: newSource
        }
    });

    var sourceInfo = sources[0];

    var status = "NOSOURCE";

    try {
        var ratesResponse = await ratesProvider.getRates(newSource, sourceInfo.SourceId, newMarketId, startTime, endTime, checkRatesCallback);
        if (ratesResponse && ratesResponse.Rates) {
            var newRates = ratesResponse.Rates;

            status = "FIXED";
            await snapshotController.setRates(snapshotId, ratesResponse.Source, ratesResponse.MarketId, newRates, endTime);
        }
    }
    catch (e) {
        if (e == ratesProvider.market_not_found) {
            // expected
        }
        else if (e == ratesProvider.invalid_response) {
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
    var items = await sql.query(split_adjust_sql, {
        "@minDiffRatio": config.job_split_min_diff_ratio,
        "@minDaysSinceRefresh": config.job_split_diff_min_days_since_refresh
    });

    for (var i = 0; i < items.length; ++i) {

        var item = items[i];

        try {
            var snapshots = await sql.query("SELECT s.ID, s.StartTime, s.Time FROM snapshots AS s WHERE s.Instrument_ID = @instrumentId", {
                "@instrumentId": item.Instrument_ID
            });

            for (var s = 0; s < snapshots.length; ++s) {
                try {
                    await refreshRates(snapshots[s].ID, item.NewSourceType, item.NewMarketId, item.Instrument_ID, parseDate(snapshots[s].StartTime), parseDate(snapshots[s].Time));
                }
                catch (error) {
                    console.log("error in split job fixPriceDifferences for " + JSON.stringify([item, snapshots[s]]) + ": " + error);
                }

                logVerbose("split job fixPriceDifferences: " + (100 * (i + s / snapshots.length) / items.length).toFixed(2) + "%");
            }
        }
        catch (error) {
            console.log("error in split job fixPriceDifferences for " + JSON.stringify(item) + ": " + error);
        }

        logVerbose("split job fixPriceDifferences: " + (100 * i / items.length).toFixed(2) + "%");
    }
}

exports.run = async function () {
    try {

        await getHunches();
        await fixHunches();
        await fixPriceDifferences();

    }
    catch (error) {
        console.log("error in split job: " + error);
    }

    setTimeout(exports.run, config.job_split_interval_seconds * 1000);
};
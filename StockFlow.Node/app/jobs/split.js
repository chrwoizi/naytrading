var exports = module.exports = {}
var model = require('../models/index');
var sequelize = require('sequelize');
var sql = require('../sql/sql');
var config = require('../config/envconfig');
var ratesProvider = require('../providers/rates_provider');
var newSnapshotController = require('../controllers/new_snapshot_controller');


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
    }

    await sql.query("UPDATE snapshots AS s SET s.Split = @status WHERE s.ID = @snapshotId", {
        "@snapshotId": snapshotId,
        "@status": status
    });
}

async function getHunches() {
    var ids = await sql.query("SELECT s.ID FROM snapshots AS s WHERE s.Split IS NULL");

    for (var i = 0; i < ids.length; ++i) {
        var id = ids[i].ID;

        await getHunch(id);

        logVerbose("split job getHunches: " + (100 * i / ids.length).toFixed(2) + "%");
    }
}

function getNearInteger(ratio) {
    var round = Math.round(ratio);
    if (round >= 2 && round < 100) {
        var frac = ratio - round;
        if (Math.abs(frac) < 0.1) {
            return round;
        }
    }
    return 1;
}

async function detectByFraction(snapshotId) {
    var rates = await sql.query("SELECT r.Time, r.Open, r.Close FROM snapshotrates AS r WHERE r.Snapshot_ID = @snapshotId", {
        "@snapshotId": snapshotId
    });

    var findings = [];

    var prePre = rates[0];
    var pre = rates[0];
    for (var r = 0; r < rates.length; ++r) {
        var rate = rates[r];

        var candidates = getCandidates(prePre, pre, rate);
        for (var c = 0; c < candidates.length; ++c) {
            var candidate = candidates[c];
            if (getNearInteger(candidate.ratio) != 1 || getNearInteger(1 / candidate.ratio) != 1) {
                findings.push(candidate);
            }
        }

        var prePre = pre;
        var pre = rate;
    }

    var detections = getDistinctFindings(findings, 5);
    if (detections.length > 0) {
        await sql.query("UPDATE snapshots AS s SET s.Split = 'PROBABLY' WHERE s.ID = @snapshotId", {
            "@snapshotId": snapshotId
        });
    }
}

async function detectByFractions() {
    var ids = await sql.query("SELECT s.ID FROM snapshots AS s WHERE s.Split = 'HUNCH'");

    for (var i = 0; i < ids.length; ++i) {
        var id = ids[i].ID;

        await detectByFraction(id);

        logVerbose("split job detectByFractions: " + (100 * i / ids.length).toFixed(2) + "%");
    }
}

function getDay(date) {
    var day = new Date(date.getTime());
    day.setHours(0, 0, 0, 0);
    return day;
}

async function resetStats(snapshotId) {
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

async function refreshRates(snapshotId, source, marketId, rates) {

    await model.snapshotrate.destroy({
        where: {
            Snapshot_ID: snapshotId
        }
    });

    await model.snapshot.update(
        {
            snapshotrates: rates,
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
            include: [{
                model: model.snapshotrate
            }]
        });

    await resetStats(snapshotId);
}

async function fixWithDifferentSource(snapshotId, knownSource, instrumentId, startTime, endTime) {
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
        await sql.query("UPDATE snapshots AS s SET s.Split = 'NOSOURCE' WHERE s.ID = @snapshotId", {
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
        var ratesResponse = await ratesProvider.getRates(sourceInfo.SourceType, sourceInfo.SourceId, sourceInfo.MarketId, startTime, endTime, checkRatesCallback);
        if (ratesResponse && ratesResponse.Rates) {
            var newRates = ratesResponse.Rates;

            status = "NODIFF-" + newSource;

            var diffs = [];
            for (var k = 0, n = 0; k < knownRates.length && n < newRates.length; ++k) {
                var knownRate = knownRates[k];
                while (n < newRates.length && getDay(newRates[n].Time) < getDay(parseDate(knownRate.Time)))++n;
                if (n < newRates.length) {
                    var newRate = newRates[n];
                    var diff = (newRate.Close - knownRate.Close) / knownRate.Close;
                    if (diff > config.job_split_min_diff_ratio) {
                        diffs.push(diff);
                    }
                }
            }

            if (diffs.length > config.job_split_min_diff_days) {
                status = "FIXABLE-" + newSource;
                //await refreshRates(snapshotId, ratesResponse.Source, ratesResponse.MarketId, newRates);
                break;
            }
        }
    }

    await sql.query("UPDATE snapshots AS s SET s.Split = '" + status + "' WHERE s.ID = @snapshotId", {
        "@snapshotId": snapshotId
    });
}

async function fixWithDifferentSources() {
    var items = await model.snapshot.findAll({
        where: {
            [sequelize.Op.or]: [
                { Split: "HUNCH" },
                { Split: "PROBABLY" }
            ]
        }
    });

    for (var i = 0; i < items.length; ++i) {
        await fixWithDifferentSource(items[i].ID, items[i].SourceType, items[i].Instrument_ID, parseDate(items[i].StartTime), parseDate(items[i].Time));

        logVerbose("split job fixWithDifferentSources: " + (100 * i / items.length).toFixed(2) + "%");
    }
}

async function changePreviousSource(snapshotId, newSource, instrumentId, startTime, endTime) {

    async function checkRatesCallback(rates) {
        problem = newSnapshotController.checkRates(rates, startTime, endTime, newSource);
        return problem == null;
    }

    var marketIds = await sql.query("SELECT s.MarketId FROM snapshots AS s WHERE s.Time > @endTime AND s.SourceType = @newSource ORDER BY s.Time ASC", {
        "@endTime": endTime,
        "@newSource": newSource
    });

    var sources = await model.source.findAll({
        where: {
            Instrument_ID: instrumentId,
            SourceType: newSource
        }
    });

    var sourceInfo = sources[0];

    var marketId = sourceInfo.MarketId;
    if (marketIds.length > 0) {
        marketId = marketIds[0];
    }

    var status = "NOSOURCE";

    var ratesResponse = await ratesProvider.getRates(sourceInfo.SourceType, sourceInfo.SourceId, marketId, startTime, endTime, checkRatesCallback);
    if (ratesResponse && ratesResponse.Rates) {
        var newRates = ratesResponse.Rates;

        status = "FIXABLE-" + newSource;
        //await refreshRates(snapshotId, ratesResponse.Source, ratesResponse.MarketId, newRates);
    }

    await sql.query("UPDATE snapshots AS s SET s.Split = '" + status + "' WHERE s.ID = @snapshotId", {
        "@snapshotId": snapshotId
    });
}

async function changePreviousSources() {
    for (var c = 0; c < ratesProvider.sources; ++c) {
        var newSource = ratesProvider.sources[c];

        var items = await sql.query("SELECT s.ID FROM snapshots AS s \
            WHERE s.SourceType <> '" + newSource + "' AND s.Split <> 'FIXED-" + newSource + "' AND EXISTS (\
            SELECT 1 FROM snapshots AS n WHERE n.Instrument_ID = s.Instrument_ID and n.Split = 'FIXED-" + newSource + "' AND n.Time < s.Time)");

        for (var i = 0; i < items.length; ++i) {
            var snapshot = await model.snapshot.findOne({
                where: {
                    ID: items[i].ID
                }
            });

            await changePreviousSource(snapshot.ID, newSource, snapshot.Instrument_ID, parseDate(snapshot.StartTime), parseDate(snapshot.Time));

            logVerbose("split job changePreviousSources " + newSource + ": " + (100 * i / items.length).toFixed(2) + "%");
        }
    }
}

exports.run = async function () {
    try {

        await getHunches();
        await detectByFractions();
        await fixWithDifferentSources();
        await changePreviousSources();

    }
    catch (error) {
        console.log("error in split job: " + error);
    }

    setTimeout(exports.run, config.job_split_interval_seconds * 1000);
};
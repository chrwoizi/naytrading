var exports = module.exports = {}
var model = require('../models/index');
var sequelize = require('sequelize');
var sql = require('../sql/sql');
var config = require('../config/envconfig');


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
    return Date.UTC(
        dateString.substr(0, 4),
        dateString.substr(5, 2) - 1,
        dateString.substr(8, 2),
        dateString.substr(11, 2),
        dateString.substr(14, 2),
        dateString.substr(17, 2)
    );
}

function isBigChange(ratio) {
    if (ratio > 1.9 || (1 / ratio) > 1.9) {
        return true;
    }
    return false;
}

function getCandidates(prePre, pre, rate) {
    var candidates = [];

    candidates.push({ preTime: rate.Time, curTime: rate.Time, preOpen: true, curOpen: false, preRate: rate.Open, curRate: rate.Close });
    candidates.push({ preTime: pre.Time, curTime: rate.Time, preOpen: false, curOpen: true, preRate: pre.Close, curRate: rate.Open });
    candidates.push({ preTime: pre.Time, curTime: rate.Time, preOpen: false, curOpen: false, preRate: pre.Close, curRate: rate.Close });
    candidates.push({ preTime: pre.Time, curTime: rate.Time, preOpen: true, curOpen: true, preRate: pre.Open, curRate: rate.Open });
    candidates.push({ preTime: pre.Time, curTime: rate.Time, preOpen: true, curOpen: false, preRate: pre.Open, curRate: rate.Close });
    candidates.push({ preTime: prePre.Time, curTime: rate.Time, preOpen: false, curOpen: true, preRate: prePre.Close, curRate: rate.Open });
    candidates.push({ preTime: prePre.Time, curTime: rate.Time, preOpen: false, curOpen: false, preRate: prePre.Close, curRate: rate.Close });
    candidates.push({ preTime: prePre.Time, curTime: rate.Time, preOpen: true, curOpen: true, preRate: prePre.Open, curRate: rate.Open });
    candidates.push({ preTime: prePre.Time, curTime: rate.Time, preOpen: true, curOpen: false, preRate: prePre.Open, curRate: rate.Close });

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

exports.run = async function () {
    try {

        await getHunches();
        await detectByFractions();

    }
    catch (error) {
        console.log("error in split job: " + error);
    }

    setTimeout(exports.run, config.job_split_interval_seconds * 1000);
};
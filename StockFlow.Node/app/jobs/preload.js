var exports = module.exports = {}
var model = require('../models/index');
var sequelize = require('sequelize');
var sql = require('../sql/sql');
var fs = require('fs');
var snapshotController = require('../controllers/snapshot_controller');
var newSnapshotController = require('../controllers/new_snapshot_controller');
var config = require('../config/envconfig');

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

exports.run = async function () {
    try {

        await sleep(3000 + Math.floor(Math.random() * 7000));

        var openSnapshots = await sql.query("SELECT COUNT(1) AS Count FROM snapshots AS s WHERE NOT EXISTS (SELECT 1 FROM usersnapshots AS u WHERE u.Snapshot_ID = s.ID)", {});

        if (openSnapshots[0].Count < config.job_preload_max_open_snapshots) {
            var endTime = new Date();
            endTime.setHours(0, 0, 0, 0);

            var instrumentIds = await newSnapshotController.getNewSnapshotInstruments(endTime);

            var newSnapshot = await newSnapshotController.createNewSnapshotFromRandomInstrument(instrumentIds);
            if (newSnapshot != null) {

                if (await newSnapshotController.isGlobalAutoIgnore(newSnapshot.snapshotrates)) {
                    await sql.query("INSERT INTO usersnapshots (Snapshot_ID, User, Decision, ModifiedTime, createdAt, updatedAt) SELECT @snapshotId, u.User, 'ignore', NOW(), NOW(), NOW() FROM userinstruments AS u WHERE u.Instrument_ID = @instrumentId",
                        {
                            "@snapshotId": newSnapshot.ID,
                            "@instrumentId": newSnapshot.Instrument_ID
                        });
                }
                else {
                    var users = await sql.query("SELECT DISTINCT(u.User) FROM snapshots AS s INNER JOIN usersnapshots AS u ON u.Snapshot_ID = s.ID WHERE s.Instrument_ID = @instrumentId",
                        {
                            "@instrumentId": newSnapshot.Instrument_ID
                        });
                    for (var i = 0; i < users.length; ++i) {
                        var previous = await snapshotController.getPreviousDecision(newSnapshot, users[i].User);
                        var viewModel = snapshotController.getSnapshotViewModel(newSnapshot, previous);

                        if (await newSnapshotController.isUserAutoIgnore(viewModel)) {
                            await model.usersnapshot.create({
                                Snapshot_ID: newSnapshot.ID,
                                User: users[i].User,
                                Decision: "ignore",
                                ModifiedTime: new Date()
                            });
                        }
                    }
                }
            }
        }

    }
    catch (error) {
        console.log("error in preload: " + error);
    }

    setTimeout(exports.run, config.job_preload_interval_seconds * 1000);
};
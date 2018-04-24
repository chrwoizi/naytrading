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
        setTimeout(resolve, ms);
    });
}

exports.run = async function () {
    try {

        var users = await sql.query('SELECT DISTINCT instrument.User FROM instruments AS instrument');

        for(var i = 0; i < users.length; ++i) {
            var userName = users[i].User;

            var openSnapshots = await model.snapshot.count({
                where: {
                    User: userName,
                    Decision: null
                }
            })

            if (openSnapshots < config.job_preload_max_open_snapshots)
            {
                await sleep(3000 + Math.floor(Math.random() * 7000));

                var endTime = new Date();
                endTime.setHours(0,0,0,0);

                var instrumentIds = await newSnapshotController.getNewSnapshotInstruments(endTime, userName);

                var newSnapshot = await newSnapshotController.createNewSnapshotFromRandomInstrument(instrumentIds);
                if (newSnapshot != null)
                {
                    var previous = await snapshotController.getPreviousDecision(newSnapshot);
                    var viewModel = snapshotController.getSnapshotViewModel(newSnapshot, previous);

                    if (await newSnapshotController.isAutoIgnore(viewModel)) {
                        await model.snapshot.update(
                            {
                                Decision: "ignore",
                                ModifiedTime: new Date()
                            },
                            {
                                where: {
                                    Id: newSnapshot.ID
                                }
                            }
                        );
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
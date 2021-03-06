const model = require('../models/index');
const sql = require('../sql/sql');
const snapshotController = require('../controllers/snapshot_controller');
const newSnapshotController = require('../controllers/new_snapshot_controller');
const config = require('../config/envconfig');

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

        const openSnapshots = await sql.query("SELECT COUNT(1) AS Count FROM snapshots AS s WHERE NOT EXISTS (SELECT 1 FROM usersnapshots AS u WHERE u.Snapshot_ID = s.ID)", {});

        if (openSnapshots[0].Count < config.job_preload_max_open_snapshots) {
            const endTime = new Date();
            endTime.setHours(0, 0, 0, 0);

            const instrumentIds = await newSnapshotController.getNewSnapshotInstruments(endTime);

            const newSnapshot = await newSnapshotController.createNewSnapshotFromRandomInstrument(instrumentIds);
            if (newSnapshot != null) {

                const users = await sql.query("SELECT DISTINCT(u.User) FROM userinstruments AS u WHERE u.Instrument_ID = @instrumentId AND EXISTS (SELECT 1 FROM usersnapshots AS us WHERE us.User = u.User AND us.Decision <> 'autowait' AND us.ModifiedTime > NOW() - INTERVAL @days DAY)",
                    {
                        "@instrumentId": newSnapshot.Instrument_ID,
                        "@days": config.job_preload_autowait_active_user_days
                    });
                for (let i = 0; i < users.length; ++i) {
                    const isLongWait = await snapshotController.isLongWait(newSnapshot.ID, users[i].User);
                    if (isLongWait) {
                        await model.usersnapshot.create({
                            Snapshot_ID: newSnapshot.ID,
                            User: users[i].User,
                            Decision: "autowait",
                            ModifiedTime: new Date()
                        });
                    }
                    else {
                        const previous = await snapshotController.getPreviousDecisionAndBuyRate(newSnapshot.ID, users[i].User);
                        const viewModel = snapshotController.getSnapshotViewModel(newSnapshot, previous);

                        if (await newSnapshotController.isAutoWait(viewModel)) {
                            await model.usersnapshot.create({
                                Snapshot_ID: newSnapshot.ID,
                                User: users[i].User,
                                Decision: "autowait",
                                ModifiedTime: new Date()
                            });
                        }
                    }
                }
            }
        }

    }
    catch (error) {
        console.log("error in preload: " + error.message + "\n" + error.stack);
    }

    setTimeout(exports.run, config.job_preload_interval_seconds * 1000);
};
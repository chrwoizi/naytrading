const model = require('../models/index');
const sql = require('../sql/sql');
const config = require('../config/envconfig');
const newSnapshotController = require('../controllers/new_snapshot_controller');
const splitJob = require('./split');
const cleanupJob = require('./cleanup');

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

function parseDate(dateString) {
    if (dateString instanceof Date) {
        return dateString;
    }
    return new Date(Date.UTC(
        dateString.substr(0, 4),
        dateString.substr(5, 2) - 1,
        dateString.substr(8, 2),
        dateString.substr(11, 2),
        dateString.substr(14, 2),
        dateString.substr(17, 2)
    ));
}

async function processSnapshots() {
    const rows = await sql.query("SELECT s.ID, s.Instrument_ID, s.Time FROM snapshots s WHERE EXISTS (SELECT 1 FROM snapshotrates r WHERE r.Snapshot_ID = s.ID) ORDER BY s.Time", {});
    console.log("consolidate job will process " + rows.length + " snapshots.");

    const splitCandidates = [];

    for (const row of rows) {
        let snapshotRates = await model.snapshotrate.findAll({
            where: {
                Snapshot_ID: row.ID
            },
            orderBy: [
                ["Time", 'ASC']
            ]
        });
        snapshotRates = snapshotRates.map(x => x.get({ plain: true }));

        let instrumentRates = await model.instrumentrate.findAll({
            where: {
                Instrument_ID: row.Instrument_ID
            },
            orderBy: [
                ["Time", 'ASC']
            ]
        });
        instrumentRates = instrumentRates.map(x => x.get({ plain: true }));

        let newRates = [];
        if (instrumentRates.length) {

            const error = splitJob.getError(snapshotRates, instrumentRates);
            if (error.count < newSnapshotController.minDays * config.job_consolidate_min_match) {
                continue;
            }

            if (error.errorAvg > config.job_consolidate_max_error) {
                if (splitCandidates.indexOf(row.Instrument_ID) == -1) {
                    splitCandidates.push(row.Instrument_ID);
                }
                continue;
            }

            const firstTime = parseDate(instrumentRates[0].Time);
            const lastTime = parseDate(instrumentRates[instrumentRates.length - 1].Time);
            const rates = [];
            for (let s = 0; s < snapshotRates.length; ++s) {
                const snapshotRate = snapshotRates[s];
                const snapshotRateTime = parseDate(snapshotRate.Time);
                if (snapshotRateTime > lastTime || snapshotRateTime < firstTime) {
                    delete snapshotRate.createdAt;
                    delete snapshotRate.updatedAt;
                    delete snapshotRate.ID;
                    delete snapshotRate.Snapshot_ID;
                    snapshotRate.Instrument_ID = row.Instrument_ID;
                    rates.push(snapshotRate);
                }
            }
            newRates = rates;
        }
        else {
            for (let s = 0; s < snapshotRates.length; ++s) {
                const snapshotRate = snapshotRates[s];
                delete snapshotRate.createdAt;
                delete snapshotRate.updatedAt;
                delete snapshotRate.ID;
                delete snapshotRate.Snapshot_ID;
                snapshotRate.Instrument_ID = row.Instrument_ID;
            }
            newRates = snapshotRates;
        }

        let transaction;

        try {
            transaction = await model.sequelize.transaction();

            if (newRates.length) {
                await model.instrumentrate.bulkCreate(newRates, {
                    transaction: transaction
                });

                let firstRateDate = parseDate(newRates[0].Time);
                let lastRateDate = parseDate(newRates[newRates.length - 1].Time);

                const rateTimes = await sql.query("SELECT MIN(r.Time) AS startTime, MAX(r.Time) AS endTime FROM instrumentrates r WHERE r.Instrument_ID = @instrumentId GROUP BY r.Instrument_ID", {
                    "@instrumentId": row.Instrument_ID
                });
                if (rateTimes && rateTimes.length) {
                    const existingFirst = parseDate(rateTimes[0].startTime);
                    const existingLast = parseDate(rateTimes[0].endTime);

                    firstRateDate = firstRateDate < existingFirst ? firstRateDate : existingFirst;
                    lastRateDate = lastRateDate < existingLast ? lastRateDate : existingLast;
                }

                await model.instrument.update({
                    FirstRateDate: firstRateDate,
                    LastRateDate: lastRateDate
                }, {
                        where: {
                            ID: row.Instrument_ID
                        },
                        transaction: transaction
                    });
            }

            await model.snapshotrate.destroy({
                where: {
                    Snapshot_ID: row.ID
                }
            });

            await transaction.commit();
        }
        catch (error) {
            transaction.rollback();
            throw error;
        }
    }

    return splitCandidates;
}

exports.run = async function () {
    try {
        while (splitJob.isRunning || cleanupJob.isRunning) {
            await sleep(1000);
        }

        exports.isRunning = true;

        const splitCandidates = await processSnapshots();

        for (const instrumentId of splitCandidates) {
            await model.instrument.update({
                Split: "DIFF"
            }, {
                    where: {
                        ID: instrumentId
                    }
                });
        }
    }
    catch (error) {
        console.log("error in consolidate: " + error.message + "\n" + error.stack);
    }
    finally {
        console.log("consolidate job finished");
        exports.isRunning = false;
    }

    setTimeout(exports.run, config.job_consolidate_interval_seconds * 1000);
};
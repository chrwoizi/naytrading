import model from '../models/index';
import { query } from '../sql/sql';
import envconfig from '../config/envconfig';
import { minDays } from '../controllers/new_snapshot_controller';
import { getError, status as split } from './split';
import { status as cleanup } from './cleanup';
import { parseDate } from '../tools';

function sleep(ms) {
  return new Promise((resolve, reject) => {
    try {
      setTimeout(resolve, ms);
    } catch (e) {
      reject(e);
    }
  });
}

async function processSnapshots() {
  const rows = await query(
    'SELECT s.ID, s.Instrument_ID, s.Time FROM snapshots s WHERE EXISTS (SELECT 1 FROM snapshotrates r WHERE r.Snapshot_ID = s.ID) ORDER BY s.Time',
    {}
  );
  console.log('consolidate job will process ' + rows.length + ' snapshots.');

  const splitCandidates: any[] = [];

  for (const row of rows) {
    const snapshotRatesModel = await model.snapshotrate.findAll({
      where: {
        Snapshot_ID: row.ID,
      },
      order: [['Time', 'ASC']],
    });
    const snapshotRates = snapshotRatesModel.map((x) => x.get({ plain: true }));

    const instrumentRatesModel = await model.instrumentrate.findAll({
      where: {
        Instrument_ID: row.Instrument_ID,
      },
      order: [['Time', 'ASC']],
    });
    const instrumentRates = instrumentRatesModel.map((x) =>
      x.get({ plain: true })
    );

    let newRates: any[] = [];
    if (instrumentRates.length) {
      const error = getError(snapshotRates, instrumentRates);
      if (error.count < minDays * envconfig.job_consolidate_min_match) {
        continue;
      }

      if (error.errorAvg > envconfig.job_consolidate_max_error) {
        if (splitCandidates.indexOf(row.Instrument_ID) == -1) {
          splitCandidates.push(row.Instrument_ID);
        }
        continue;
      }

      const firstTime = parseDate(instrumentRates[0].Time);
      const lastTime = parseDate(
        instrumentRates[instrumentRates.length - 1].Time
      );
      const rates: any[] = [];
      for (let s = 0; s < snapshotRates.length; ++s) {
        const snapshotRate = snapshotRates[s];
        const snapshotRateTime = parseDate(snapshotRate.Time);
        if (snapshotRateTime > lastTime || snapshotRateTime < firstTime) {
          delete snapshotRate.createdAt;
          delete snapshotRate.updatedAt;
          delete snapshotRate.ID;
          delete snapshotRate.Snapshot_ID;
          rates.push({
            ...snapshotRate,
            Instrument_ID: row.Instrument_ID,
          });
        }
      }
      newRates = rates;
    } else {
      const rates: any[] = [];
      for (let s = 0; s < snapshotRates.length; ++s) {
        const snapshotRate = snapshotRates[s];
        delete snapshotRate.createdAt;
        delete snapshotRate.updatedAt;
        delete snapshotRate.ID;
        delete snapshotRate.Snapshot_ID;
        rates.push({
          ...snapshotRate,
          Instrument_ID: row.Instrument_ID,
        });
      }
      newRates = rates;
    }

    let transaction;

    try {
      transaction = await model.sequelize.transaction();

      if (newRates.length) {
        await model.instrumentrate.bulkCreate(newRates, {
          transaction: transaction,
        });

        let firstRateDate = parseDate(newRates[0].Time);
        let lastRateDate = parseDate(newRates[newRates.length - 1].Time);

        const rateTimes = await query(
          'SELECT MIN(r.Time) AS startTime, MAX(r.Time) AS endTime FROM instrumentrates r WHERE r.Instrument_ID = @instrumentId GROUP BY r.Instrument_ID',
          {
            '@instrumentId': row.Instrument_ID,
          }
        );
        if (rateTimes && rateTimes.length) {
          const existingFirst = parseDate(rateTimes[0].startTime);
          const existingLast = parseDate(rateTimes[0].endTime);

          firstRateDate =
            firstRateDate < existingFirst ? firstRateDate : existingFirst;
          lastRateDate =
            lastRateDate < existingLast ? lastRateDate : existingLast;
        }

        await model.instrument.update(
          {
            FirstRateDate: firstRateDate,
            LastRateDate: lastRateDate,
          },
          {
            where: {
              ID: row.Instrument_ID,
            },
            transaction: transaction,
          }
        );
      }

      await model.snapshotrate.destroy({
        where: {
          Snapshot_ID: row.ID,
        },
      });

      await transaction.commit();
    } catch (error) {
      transaction.rollback();
      throw error;
    }
  }

  return splitCandidates;
}

export const status = {
  isRunning: false,
};

export async function run() {
  try {
    while (split.isRunning || cleanup.isRunning) {
      await sleep(1000);
    }

    status.isRunning = true;

    const splitCandidates = await processSnapshots();

    for (const instrumentId of splitCandidates) {
      await model.instrument.update(
        {
          Split: 'DIFF',
        },
        {
          where: {
            ID: instrumentId,
          },
        }
      );
    }
  } catch (e) {
    const error = e as Error;
    console.log('error in consolidate: ' + error.message + '\n' + error.stack);
  } finally {
    console.log('consolidate job finished');
    status.isRunning = false;
  }

  setTimeout(run, envconfig.job_consolidate_interval_seconds * 1000);
}

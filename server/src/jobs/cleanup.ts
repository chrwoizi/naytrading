import model from '../models/index';
import { query } from '../sql/sql';
import { readFileSync } from 'fs';
import envconfig from '../config/envconfig';
import { status as split } from './split';
import { status as consolidate } from './consolidate';
import { minDays } from '../controllers/new_snapshot_controller';

let duplicates_sql = '';
try {
  duplicates_sql = readFileSync(__dirname + '/../sql/duplicates.sql', 'utf8');
} catch (e) {
  const error = e as Error;
  console.log('Error:', error.stack);
}

let missing_rates_sql = '';
try {
  missing_rates_sql = readFileSync(
    __dirname + '/../sql/missing_rates.sql',
    'utf8'
  );
} catch (e) {
  const error = e as Error;
  console.log('Error:', error.stack);
}

let late_rates_sql = '';
try {
  late_rates_sql = readFileSync(__dirname + '/../sql/late_rates.sql', 'utf8');
} catch (e) {
  const error = e as Error;
  console.log('Error:', error.stack);
}

function sleep(ms) {
  return new Promise((resolve, reject) => {
    try {
      setTimeout(resolve, ms);
    } catch (e) {
      reject(e);
    }
  });
}

function groupBy(xs, key, equals) {
  return xs.reduce(function (rv, x) {
    const v = key(x);
    const el = rv.find((r) => r && equals(r.key, v));
    if (el) {
      el.values.push(x);
    } else {
      rv.push({ key: v, values: [x] });
    }
    return rv;
  }, []);
}

async function cleanupDuplicates() {
  const rows = await query(duplicates_sql, {});

  const groups = groupBy(
    rows,
    (x) => {
      return {
        Instrument_ID: x.Instrument_ID,
        Time: x.Time,
      };
    },
    (a, b) => {
      return (
        a.Instrument_ID == b.Instrument_ID &&
        a.Time.substr(0, 10) == b.Time.substr(0, 10)
      );
    }
  );

  for (let i = 0; i < groups.length; ++i) {
    const snapshots = groups[i].values;

    for (let i = 1; i < snapshots.length; ++i) {
      console.log(
        'deleting duplicate snapshot ' +
          snapshots[i].ID +
          ' for instrument ' +
          snapshots[i].Instrument_ID
      );
      await model.usersnapshot.update(
        {
          Snapshot_ID: snapshots[0].ID,
        },
        {
          where: {
            Snapshot_ID: snapshots[i].ID,
          },
        }
      );
      await model.trade.update(
        {
          Snapshot_ID: snapshots[0].ID,
        },
        {
          where: {
            Snapshot_ID: snapshots[i].ID,
          },
        }
      );
      await model.snapshot.destroy({
        where: {
          ID: snapshots[i].ID,
        },
      });
    }
  }
}

async function cleanupMissingRates() {
  return;
  const rows = await query(missing_rates_sql, {
    '@minRates': minDays - 1,
  });

  for (let i = 0; i < rows.length; ++i) {
    console.log(
      'snapshot ' +
        rows[i].ID +
        ' for instrument ' +
        rows[i].Instrument_ID +
        ' has missing rates in time span'
    );
    /*await model.snapshot.destroy({
            where: {
                ID: rows[i].ID
            }
        });*/
  }
}

async function cleanupLateBegin() {
  return;
  const rows = await query(late_rates_sql, {
    '@minDays':
      (envconfig.chart_period_seconds - envconfig.discard_threshold_seconds) /
        60 /
        60 /
        24 -
      1,
  });

  for (let i = 0; i < rows.length; ++i) {
    console.log(
      'snapshot ' +
        rows[i].ID +
        ' for instrument ' +
        rows[i].Instrument_ID +
        ' first rate is late'
    );
    /*await model.snapshot.destroy({
            where: {
                ID: rows[i].ID
            }
        });*/
  }
}

async function cleanupOldUnseen() {
  const result = await query(
    'DELETE FROM s USING snapshots AS s WHERE NOT EXISTS (SELECT 1 FROM usersnapshots AS u WHERE u.Snapshot_ID = s.ID) AND s.Time < NOW() - INTERVAL @hours HOUR',
    {
      '@hours': envconfig.max_unused_snapshot_age_hours + 1,
    }
  );

  if (result.affectedRows > 0) {
    console.log('Deleted ' + result.affectedRows + ' unused snapshots');
  }
}

async function cleanupDuplicateInstruments() {
  const items = await query(
    "select i.ID as dup, i2.ID as orig \
        from instruments i \
        inner join instruments i2 on i2.ID<i.ID \
        inner join sources s on s.Instrument_ID=i.ID and s.SourceType='w' \
        inner join sources s2 on s2.Instrument_ID=i2.ID and s2.SourceType='w' \
        and i2.InstrumentName=i.InstrumentName \
        and s.SourceId=s2.SourceId"
  );

  if (items.length > 0) {
    console.log(
      'Cleanup job will delete ' + items.length + ' duplicate instruments...'
    );

    for (const item of items) {
      await query('delete from userinstruments where Instrument_ID = @oldId', {
        '@oldId': item.dup,
      });

      await query(
        'update snapshots s set s.Instrument_ID = @newId where s.Instrument_ID = @oldId',
        {
          '@newId': item.orig,
          '@oldId': item.dup,
        }
      );

      await query(
        'update instrumentrates r \
            left outer join instrumentrates r2 on r2.Time=r.Time and r2.Instrument_ID=@newId \
            set r.Instrument_ID=@newId where r.Instrument_ID=@oldId and r2.ID is null;',
        {
          '@newId': item.orig,
          '@oldId': item.dup,
        }
      );

      await query('delete from instrumentrates where Instrument_ID = @oldId', {
        '@oldId': item.dup,
      });

      await query('delete from sources where Instrument_ID = @oldId', {
        '@oldId': item.dup,
      });

      await query('delete from weights where Instrument_ID = @oldId', {
        '@oldId': item.dup,
      });

      await query('delete from instruments where ID = @oldId', {
        '@oldId': item.dup,
      });
    }

    console.log(
      'Cleanup job deleted ' + items.length + ' duplicate instruments.'
    );
  }
}

export const status = {
  isRunning: false,
};

export async function run() {
  try {
    while (consolidate.isRunning || split.isRunning) {
      await sleep(1000);
    }

    status.isRunning = true;
    await cleanupDuplicateInstruments();
    await cleanupDuplicates();
    await cleanupMissingRates();
    await cleanupLateBegin();
    await cleanupOldUnseen();
  } catch (e) {
    const error = e as Error;
    console.log('error in cleanup: ' + error.message + '\n' + error.stack);
  } finally {
    status.isRunning = false;
  }

  setTimeout(run, envconfig.job_cleanup_interval_seconds * 1000);
}

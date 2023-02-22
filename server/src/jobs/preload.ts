import model from '../models/index';
import { query } from '../sql/sql';
import {
  isLongWait as _isLongWait,
  getPreviousDecisionAndBuyRate,
  getSnapshotViewModel,
} from '../controllers/snapshot_controller';
import {
  getNewSnapshotInstruments,
  createNewSnapshotFromRandomInstrument,
  isAutoWait,
} from '../controllers/new_snapshot_controller';
import envconfig from '../config/envconfig';

function sleep(ms) {
  return new Promise((resolve, reject) => {
    try {
      setTimeout(resolve, ms);
    } catch (e) {
      reject(e);
    }
  });
}

export async function run() {
  try {
    await sleep(3000 + Math.floor(Math.random() * 7000));

    const openSnapshots = await query(
      'SELECT COUNT(1) AS Count FROM snapshots AS s WHERE NOT EXISTS (SELECT 1 FROM usersnapshots AS u WHERE u.Snapshot_ID = s.ID)',
      {}
    );

    if (openSnapshots[0].Count < envconfig.job_preload_max_open_snapshots) {
      const endTime = new Date();
      endTime.setHours(0, 0, 0, 0);

      const instrumentIds = await getNewSnapshotInstruments(endTime);

      const newSnapshot = await createNewSnapshotFromRandomInstrument(
        instrumentIds
      );
      if (newSnapshot != null) {
        const users = await query(
          "SELECT DISTINCT(u.User) FROM userinstruments AS u WHERE u.Instrument_ID = @instrumentId AND EXISTS (SELECT 1 FROM usersnapshots AS us WHERE us.User = u.User AND us.Decision <> 'autowait' AND us.ModifiedTime > NOW() - INTERVAL @days DAY)",
          {
            '@instrumentId': newSnapshot.Instrument_ID,
            '@days': envconfig.job_preload_autowait_active_user_days,
          }
        );
        for (let i = 0; i < users.length; ++i) {
          const isLongWait = await _isLongWait(newSnapshot.ID, users[i].User);
          if (isLongWait) {
            await model.usersnapshot.create({
              Snapshot_ID: newSnapshot.ID,
              User: users[i].User,
              Decision: 'autowait',
              ModifiedTime: new Date(),
            });
          } else {
            const previous = await getPreviousDecisionAndBuyRate(
              newSnapshot.ID,
              users[i].User
            );
            const viewModel = getSnapshotViewModel(newSnapshot, previous);

            if (await isAutoWait(viewModel)) {
              await model.usersnapshot.create({
                Snapshot_ID: newSnapshot.ID,
                User: users[i].User,
                Decision: 'autowait',
                ModifiedTime: new Date(),
              });
            }
          }
        }
      }
    }
  } catch (e) {
    const error = e as Error;
    console.log('error in preload: ' + error.message + '\n' + error.stack);
  }

  setTimeout(run, envconfig.job_preload_interval_seconds * 1000);
}

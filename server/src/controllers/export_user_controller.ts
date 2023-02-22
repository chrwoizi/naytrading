import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import model from '../models/index';
import { query } from '../sql/sql';
import envconfig from '../config/envconfig';
import { ensureRates } from './snapshot_controller';
import { getTokenUser } from './auth_controller';

let trades_sql = '';
try {
  trades_sql = readFileSync(__dirname + '/../sql/trades.sql', 'utf8');
} catch (e) {
  const error = e as Error;
  console.log('Error:', error.stack);
}

function return500(res, e) {
  try {
    res.status(500);
    res.json({ error: e.message });
  } catch (e2) {
    res.write(JSON.stringify({ error: e.message }));
    res.end();
  }
}

function parseDateUTC(str) {
  return new Date(
    Date.UTC(str.substr(0, 4), parseInt(str.substr(4, 2)) - 1, str.substr(6, 2))
  );
}

function parseTimeUTC(str) {
  return new Date(
    Date.UTC(
      str.substr(0, 4),
      parseInt(str.substr(4, 2)) - 1,
      str.substr(6, 2),
      str.substr(8, 2),
      parseInt(str.substr(10, 2)),
      str.substr(12, 2)
    )
  );
}

export async function exportUserSnapshotsGeneric(
  fromTimeUTC,
  user,
  stream,
  cancel,
  reportProgress
) {
  reportProgress(0);

  const ids = await query(
    'SELECT userSnapshot.ID FROM usersnapshots AS userSnapshot WHERE userSnapshot.User = @userName AND userSnapshot.ModifiedTime >= @fromTime ORDER BY userSnapshot.ModifiedTime',
    {
      '@userName': user,
      '@fromTime': fromTimeUTC,
    }
  );

  stream.write('[');

  for (let i = 0; i < ids.length && !cancel(); ++i) {
    reportProgress(i / ids.length);

    const usersnapshot = await model.usersnapshot.findOne({
      where: {
        ID: ids[i].ID,
      },
    });

    const snapshotModel = await model.snapshot.findOne({
      include: [
        {
          model: model.instrument,
        },
        {
          model: model.snapshotrate,
        },
        {
          model: model.tradelog,
        },
      ],
      where: {
        ID: usersnapshot.Snapshot_ID,
      },
      order: [
        [model.snapshotrate, 'Time', 'ASC'],
        [model.tradelog, 'Time', 'ASC'],
      ],
    });
    const snapshot = snapshotModel.get({ plain: true });

    await ensureRates(snapshot);

    for (let r = 0; r < snapshot.snapshotrates.length; ++r) {
      const rate = snapshot.snapshotrates[r];
      delete rate.ID;
      delete rate.createdAt;
      delete rate.updatedAt;
      delete rate.Snapshot_ID;
    }

    delete snapshot.instrument.createdAt;
    delete snapshot.instrument.updatedAt;

    delete snapshot.createdAt;
    delete snapshot.updatedAt;

    const viewModel = {
      ...snapshot,
      DecisionId: usersnapshot.ID,
      Decision: usersnapshot.Decision,
      DecisionTime: usersnapshot.ModifiedTime,
      Confirmed: usersnapshot.Confirmed,
    };

    if (i > 0) {
      stream.write(',');
    }

    stream.write(JSON.stringify(viewModel));
  }

  stream.write(']');
  stream.end();

  reportProgress(1);

  if (cancel()) {
    throw new Error('cancelled');
  }

  return ids.length;
}

export async function exportUserTrades(req, res) {
  try {
    if (typeof req.query.token !== 'string') throw new Error('bad request');

    const tokenUser = getTokenUser(req.query.token);
    if (tokenUser) {
      if (
        typeof req.params.fromDate !== 'string' ||
        !(req.params.fromDate.length == 8 || req.params.fromDate.length == 14)
      ) {
        return500(res, { message: 'invalid date format' });
        return;
      }

      let fromDate = new Date(Date.UTC(1970, 0, 1));
      if (req.params.fromDate.length == 8) {
        fromDate = parseDateUTC(req.params.fromDate);
      } else if (req.params.fromDate.length == 14) {
        fromDate = parseTimeUTC(req.params.fromDate);
      }

      let cancel = false;

      req.on('close', function () {
        cancel = true;
      });

      req.on('end', function () {
        cancel = true;
      });

      const trades = await query(trades_sql, {
        '@userName': tokenUser,
        '@fromDate': fromDate,
      });

      res.header('Content-disposition', 'attachment; filename=trades.json');
      res.header('Content-type', 'application/json');

      res.write('[');

      for (let i = 0; i < trades.length && !cancel; ++i) {
        const trade = trades[i];
        trade.tradelogs = await query(
          'SELECT * FROM tradelogs l WHERE l.User = @user AND l.Snapshot_ID = @snapshotId ORDER BY l.Time ASC',
          {
            '@user': tokenUser,
            '@snapshotId': trade.SnapshotId,
          }
        );

        if (i > 0) {
          res.write(',');
        }

        res.write(JSON.stringify(trade));
      }

      res.write(']');
      res.end();

      if (cancel) {
        throw new Error('client disconnected');
      }
    } else {
      res.status(401);
      res.json({ error: 'unauthorized' });
    }
  } catch (error) {
    return500(res, error);
  }
}

export async function exportUserTradelogs(req, res) {
  try {
    if (typeof req.query.token !== 'string') throw new Error('bad request');

    const tokenUser = getTokenUser(req.query.token);
    if (tokenUser) {
      if (
        typeof req.params.fromDate !== 'string' ||
        !(req.params.fromDate.length == 8 || req.params.fromDate.length == 14)
      ) {
        return500(res, { message: 'invalid date format' });
        return;
      }

      let fromDate = new Date(Date.UTC(1970, 0, 1));
      if (req.params.fromDate.length == 8) {
        fromDate = parseDateUTC(req.params.fromDate);
      } else if (req.params.fromDate.length == 14) {
        fromDate = parseTimeUTC(req.params.fromDate);
      }

      let cancel = false;

      req.on('close', function () {
        cancel = true;
      });

      req.on('end', function () {
        cancel = true;
      });

      const tradelogs = await query(
        'SELECT l.*, i.Isin, i.Wkn, s.Time AS SnapshotTime FROM tradelogs l INNER JOIN snapshots s ON s.ID = l.Snapshot_ID INNER JOIN instruments i ON i.ID = s.Instrument_ID \
                WHERE l.User = @user AND l.Time >= @fromDate ORDER BY l.Time ASC',
        {
          '@user': tokenUser,
          '@fromDate': fromDate,
        }
      );

      res.header('Content-disposition', 'attachment; filename=tradelogs.json');
      res.header('Content-type', 'application/json');

      res.write('[');

      for (let i = 0; i < tradelogs.length && !cancel; ++i) {
        const tradelog = tradelogs[i];

        if (i > 0) {
          res.write(',');
        }

        res.write(JSON.stringify(tradelog));
      }

      res.write(']');
      res.end();

      if (cancel) {
        throw new Error('client disconnected');
      }
    } else {
      res.status(401);
      res.json({ error: 'unauthorized' });
    }
  } catch (error) {
    return500(res, error);
  }
}

function downloadFile(req, res, filename) {
  try {
    if (typeof req.query.token !== 'string') throw new Error('bad request');

    const tokenUser = getTokenUser(req.query.token);
    if (tokenUser) {
      const filePath = resolve(
        envconfig.processing_dir +
          '/' +
          tokenUser +
          '/' +
          filename +
          '_norm.csv'
      );

      if (existsSync(filePath)) {
        if (
          typeof req.params.time === 'string' &&
          req.params.time.length == 14
        ) {
          if (existsSync(filePath + '.meta')) {
            const meta = JSON.parse(readFileSync(filePath + '.meta', 'utf8'));
            if (req.params.time != meta.time) {
              res.redirect('/manage');
              return;
            }
          }
        }

        res.download(filePath, filename + '.csv');
      } else {
        res.status(404);
        res.json({ error: 'file does not exist' });
      }
    } else {
      res.status(401);
      res.json({ error: 'unauthorized' });
    }
  } catch (error) {
    return500(res, error);
  }
}

export async function downloadBuyingTrain(req, res) {
  downloadFile(req, res, 'buying_train');
}

export async function downloadBuyingTest(req, res) {
  downloadFile(req, res, 'buying_test');
}

export async function downloadSellingTrain(req, res) {
  downloadFile(req, res, 'selling_train');
}

export async function downloadSellingTest(req, res) {
  downloadFile(req, res, 'selling_test');
}

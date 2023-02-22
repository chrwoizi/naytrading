import model from '../models/index';
import { query } from '../sql/sql';
import envconfig from '../config/envconfig';
import * as moment from 'moment';

export async function getOpenSuggestions(req, res) {
  try {
    if (req.isAuthenticated()) {
      const oldestSuggestionTime = new Date(
        new Date().getTime() -
          envconfig.trader_max_suggestion_age_seconds * 1000
      );

      const suggestions = await query(
        "SELECT s.ID, u.Decision AS Action, i.InstrumentName, i.Isin, i.Wkn, s.Price FROM snapshots s \
                INNER JOIN usersnapshots u ON u.Snapshot_ID = s.ID \
                INNER JOIN instruments i ON i.ID = s.Instrument_ID \
                WHERE u.User = @user AND (u.Decision = 'buy' OR u.Decision = 'sell') \
                AND (u.Decision = 'sell' OR s.Time >= @oldestSuggestionTime) \
                AND NOT EXISTS (SELECT 1 FROM tradelogs l WHERE l.Snapshot_ID = s.ID AND l.Status = 'Complete') \
                AND (u.Decision = 'sell' OR (SELECT COUNT(1) FROM tradelogs l WHERE l.Snapshot_ID = s.ID) < @maxRetryCount) \
                AND (NOT EXISTS (SELECT 1 FROM tradelogs l WHERE l.Snapshot_ID = s.ID) \
                    OR (SELECT l.Status FROM tradelogs l WHERE l.Snapshot_ID = s.ID ORDER BY l.Time DESC LIMIT 1) IN ('Initial', 'TemporaryError')) \
                ORDER BY s.Time DESC",
        {
          '@user': req.user.email,
          '@oldestSuggestionTime': oldestSuggestionTime,
          '@maxRetryCount': envconfig.trader_max_retry_count,
        }
      );

      const viewModels = suggestions;
      res.json(viewModels);
    } else {
      res.status(401);
      res.json({ error: 'unauthorized' });
    }
  } catch (e) {
    const error = e as Error;
    res.status(500);
    res.json({ error: error.message });
  }
}

export async function hasNewerSuggestion(req, res) {
  try {
    if (req.isAuthenticated()) {
      const snapshotId = parseInt(req.params.id);
      if (Number.isNaN(snapshotId)) throw new Error('bad request');

      const suggestions = await query(
        'SELECT s.Instrument_ID, s.Time FROM snapshots s \
                INNER JOIN usersnapshots u ON s.ID = u.Snapshot_ID \
                WHERE u.User = @user AND s.ID = @id',
        {
          '@user': req.user.email,
          '@id': snapshotId,
        }
      );

      if (suggestions && suggestions.length) {
        const suggestion = suggestions[0];

        const newerSuggestions = await query(
          "SELECT count(1) AS c FROM snapshots s \
                    INNER JOIN usersnapshots u ON s.ID = u.Snapshot_ID \
                    WHERE s.Instrument_ID = @instrumentId \
                    AND s.Time > @time AND s.ID <> @id \
                    AND u.User = @user AND (u.Decision = 'buy' OR u.Decision = 'sell')",
          {
            '@instrumentId': suggestion.Instrument_ID,
            '@time': suggestion.Time,
            '@id': snapshotId,
            '@user': req.user.email,
          }
        );

        const viewModel: any = {};
        viewModel.hasNewerSuggestion =
          newerSuggestions && newerSuggestions.length && newerSuggestions[0].c
            ? true
            : false;

        res.json(viewModel);
      } else {
        res.status(404);
        res.json({ message: 'not found' });
      }
    } else {
      res.status(401);
      res.json({ error: 'unauthorized' });
    }
  } catch (e) {
    const error = e as Error;
    res.status(500);
    res.json({ error: error.message });
  }
}

export async function saveTradeLog(req, res) {
  try {
    if (req.isAuthenticated()) {
      const log = req.body;

      if (log.Snapshot_ID && typeof log.Snapshot_ID !== 'number')
        throw new Error('bad request');
      if (log.Quantity && typeof log.Quantity !== 'number')
        throw new Error('bad request');
      if (log.Price && typeof log.Price !== 'number')
        throw new Error('bad request');
      if (log.Time && typeof log.Time !== 'string')
        throw new Error('bad request');
      if (log.Status && typeof log.Status !== 'string')
        throw new Error('bad request');
      if (log.Message && typeof log.Message !== 'string')
        throw new Error('bad request');

      const suggestions = await query(
        'SELECT s.ID FROM snapshots s \
                INNER JOIN usersnapshots u ON u.Snapshot_ID = s.ID \
                WHERE u.User = @user AND s.ID = @id',
        {
          '@user': req.user.email,
          '@id': log.Snapshot_ID,
        }
      );

      if (suggestions && suggestions.length) {
        if (log.ID >= 0) {
          if (typeof log.ID !== 'number') throw new Error('bad request');

          await model.tradelog.update(
            {
              Snapshot_ID: log.Snapshot_ID,
              Time: new Date(log.Time),
              Quantity: log.Quantity,
              Price: log.Price,
              Status: log.Status,
              Message: log.Message,
              User: req.user.email,
            },
            {
              where: {
                ID: log.ID,
              },
            }
          );

          const viewModel = {
            ID: log.ID,
          };
          res.json(viewModel);
        } else {
          const newLog = await model.tradelog.create({
            Snapshot_ID: log.Snapshot_ID,
            Time: new Date(log.Time),
            Quantity: log.Quantity,
            Price: log.Price,
            Status: log.Status,
            Message: log.Message,
            User: req.user.email,
          });

          const viewModel = {
            ID: newLog.ID,
          };
          res.json(viewModel);
        }
      } else {
        res.status(404);
        res.json({ message: 'not found' });
      }
    } else {
      res.status(401);
      res.json({ error: 'unauthorized' });
    }
  } catch (e) {
    const error = e as Error;
    res.status(500);
    res.json({ error: error.message });
    console.log(error.message + '\n' + error.stack);
  }
}

export async function getSuggestions(req, res) {
  try {
    if (req.isAuthenticated()) {
      const rows = await query(
        "SELECT s.ID, s.Time, i.InstrumentName, u.Decision AS Action, s.Price, \
                (SELECT l.Status FROM tradelogs AS l WHERE l.Snapshot_ID = s.ID ORDER BY l.Time DESC LIMIT 1) AS Status \
                FROM snapshots s \
                INNER JOIN usersnapshots u ON s.ID = u.Snapshot_ID \
                INNER JOIN instruments i ON i.ID = s.Instrument_ID \
                WHERE u.User = @user AND (u.Decision = 'buy' OR u.Decision = 'sell')",
        {
          '@user': req.user.email,
        }
      );

      const result = rows.map((item) => {
        return {
          id: item.ID,
          T: moment(item.Time).format('DD.MM.YYYY'),
          TS: moment(item.Time).format('YYMMDD'),
          I: item.InstrumentName,
          A: item.Action,
          P: item.Price,
          S: (function (status) {
            switch (status) {
              case 'Processing':
                return 'p';
              case 'TemporaryError':
                return 't';
              case 'FatalError':
                return 'f';
              case 'Complete':
                return 'c';
              default:
                return 'i';
            }
          })(item.Status),
        };
      });

      res.status(200);
      res.json({ suggestions: result });
    } else {
      res.status(401);
      res.json({ error: 'unauthorized' });
    }
  } catch (e) {
    const error = e as Error;
    res.status(500);
    res.json({ error: error.message });
  }
}

export async function getSuggestion(req, res) {
  try {
    if (req.isAuthenticated()) {
      const rows = await query(
        'SELECT s.ID, s.Time, i.InstrumentName, i.Isin, i.Wkn, u.Decision AS Action, s.Price, \
                (SELECT l.Status FROM tradelogs AS l WHERE l.Snapshot_ID = s.ID ORDER BY l.Time DESC LIMIT 1) AS Status \
                FROM snapshots s \
                INNER JOIN usersnapshots u ON s.ID = u.Snapshot_ID \
                INNER JOIN instruments i ON i.ID = s.Instrument_ID \
                WHERE s.ID = @id AND u.User = @user',
        {
          '@user': req.user.email,
          '@id': req.params.id,
        }
      );
      if (rows && rows.length) {
        const suggestion = rows[0];

        const logs = await model.tradelog.findAll({
          where: {
            Snapshot_ID: suggestion.ID,
            User: req.user.email,
          },
        });

        suggestion.logs = logs.map((x) => x.get({ plain: true }));

        const t = moment(suggestion.Time).format('DD.MM.YY');
        suggestion.Time = t;

        res.status(200);
        res.json({ suggestion: suggestion });
      } else {
        res.status(404);
        res.json({ error: 'not found' });
      }
    } else {
      res.status(401);
      res.json({ error: 'unauthorized' });
    }
  } catch (e) {
    const error = e as Error;
    res.status(500);
    res.json({ error: error.message });
  }
}

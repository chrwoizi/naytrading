import model from '../models/index';
import { Op } from 'sequelize';
import { query } from '../sql/sql';
import * as moment from 'moment';
import envconfig from '../config/envconfig';
import { checkRates } from './new_snapshot_controller';
import {
  sources as _sources,
  getRates,
  market_not_found,
  invalid_response,
} from '../providers/rates_provider';
import { parseDate } from '../tools';

function return500(res, e) {
  res.status(500);
  res.json({ error: e.message });
}

function formatRateDate(d) {
  const year = d.getFullYear();
  const month = d.getMonth();
  const day = d.getDate();
  return (
    year.toString().substr(2) +
    (month + 101).toString().substr(1) +
    (day + 100).toString().substr(1)
  );
}

export function getSnapshotViewModel(snapshot, previous) {
  function getSnapshotRateViewModel(snapshotRate) {
    return {
      T: formatRateDate(snapshotRate.Time),
      C: snapshotRate.Close,
    };
  }

  return {
    ID: snapshot.ID,
    Instrument: {
      ID: snapshot.Instrument_ID,
      InstrumentName: snapshot.InstrumentName,
    },
    Date: moment(snapshot.Time).format('DD.MM.YY'),
    DateSortable: moment(snapshot.Time).format('YYMMDD'),
    Rates: snapshot.snapshotrates
      ? snapshot.snapshotrates.map(getSnapshotRateViewModel)
      : undefined,
    PreviousDecision: previous ? previous.PreviousDecision : undefined,
    PreviousBuyRate: previous ? previous.PreviousBuyRate : undefined,
    PreviousTime: previous ? previous.PreviousTime : undefined,
  };
}

export function getSnapshotListViewModel(snapshot) {
  return {
    ID: snapshot.ID,
    Instrument: {
      InstrumentName: snapshot.InstrumentName,
    },
    Date: moment(snapshot.Time).format('DD.MM.YY'),
    DateSortable: moment(snapshot.Time).format('YYMMDD'),
    ModifiedDateSortable: moment(snapshot.ModifiedTime).format('YYMMDDHHmmss'),
    Decision: snapshot.Decision,
  };
}

export async function ensureRates(snapshot) {
  if (!snapshot.snapshotrates || !snapshot.snapshotrates.length) {
    snapshot.snapshotrates = await model.instrumentrate.findAll({
      where: {
        Instrument_ID: snapshot.Instrument_ID,
        [Op.and]: [
          {
            Time: {
              [Op.gte]: snapshot.FirstPriceTime,
            },
          },
          {
            Time: {
              [Op.lte]: snapshot.PriceTime,
            },
          },
        ],
      },
      order: [['Time', 'ASC']],
    });
    snapshot.snapshotrates = snapshot.snapshotrates.map((x) =>
      x.get({ plain: true })
    );
  }
}

export async function countSnapshots(req, res) {
  try {
    if (req.isAuthenticated()) {
      if (
        typeof req.params.fromDate !== 'string' ||
        !(req.params.fromDate.length == 8 || req.params.fromDate.length == 14)
      ) {
        return500(res, { message: 'invalid date format' });
        return;
      }

      let fromDate = new Date(Date.UTC(1970, 0, 1));
      if (req.params.fromDate.length == 8) {
        fromDate = new Date(
          Date.UTC(
            req.params.fromDate.substr(0, 4),
            parseInt(req.params.fromDate.substr(4, 2)) - 1,
            req.params.fromDate.substr(6, 2)
          )
        );
      } else if (req.params.fromDate.length == 14) {
        fromDate = new Date(
          Date.UTC(
            req.params.fromDate.substr(0, 4),
            parseInt(req.params.fromDate.substr(4, 2)) - 1,
            req.params.fromDate.substr(6, 2),
            req.params.fromDate.substr(8, 2),
            parseInt(req.params.fromDate.substr(10, 2)),
            req.params.fromDate.substr(12, 2)
          )
        );
      }

      const result = await model.usersnapshot.count({
        where: {
          User: req.user.email,
          ModifiedTime: {
            [Op.gte]: fromDate,
          },
        },
      });

      res.json(result);
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

export async function snapshots(req, res) {
  try {
    if (req.isAuthenticated()) {
      let snapshots;

      if (typeof req.params.instrument === 'string') {
        const instrumentId = parseInt(req.params.instrument);
        if (Number.isNaN(instrumentId)) throw new Error('bad request');

        snapshots = await query(
          'SELECT s.ID, s.Time, i.InstrumentName, u.Decision, u.ModifiedTime FROM snapshots AS s \
                        INNER JOIN instruments AS i ON i.ID = s.Instrument_ID INNER JOIN usersnapshots AS u ON u.Snapshot_ID = s.ID WHERE u.User = @user AND s.Instrument_ID = @instrument',
          {
            '@user': req.user.email,
            '@instrument': instrumentId,
          }
        );
      } else {
        snapshots = await query(
          'SELECT s.ID, s.Time, i.InstrumentName, u.Decision, u.ModifiedTime FROM snapshots AS s \
                    INNER JOIN instruments AS i ON i.ID = s.Instrument_ID INNER JOIN usersnapshots AS u ON u.Snapshot_ID = s.ID WHERE u.User = @user',
          {
            '@user': req.user.email,
          }
        );
      }

      const viewModels = snapshots.map((snapshot) =>
        getSnapshotListViewModel(snapshot)
      );
      res.json({ snapshots: viewModels });
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

export async function getSnapshot(id, user) {
  const snapshots = await query(
    'SELECT s.ID, s.Time, s.Instrument_ID, i.InstrumentName, s.FirstPriceTime, s.PriceTime FROM snapshots AS s INNER JOIN instruments AS i ON i.ID = s.Instrument_ID WHERE s.ID = @id',
    {
      '@id': id,
      '@user': user,
    }
  );

  if (snapshots && snapshots.length == 1) {
    const snapshot = snapshots[0];

    snapshot.instrument = {
      ID: snapshot.Instrument_ID,
      InstrumentName: snapshot.InstrumentName,
    };

    snapshot.snapshotrates = await query(
      'SELECT r.Time, r.Close FROM snapshotrates AS r WHERE r.Snapshot_ID = @id ORDER BY r.Time ASC',
      {
        '@id': id,
      }
    );

    if (!snapshot.snapshotrates || !snapshot.snapshotrates.length) {
      snapshot.snapshotrates = await query(
        'SELECT r.Time, r.Close FROM instrumentrates AS r WHERE r.Instrument_ID = @id AND r.Time >= @fromTime AND r.Time <= @toTime ORDER BY r.Time ASC',
        {
          '@id': snapshot.Instrument_ID,
          '@fromTime': snapshot.FirstPriceTime,
          '@toTime': snapshot.PriceTime,
        }
      );
    }

    const previous = await getPreviousDecisionAndBuyRate(snapshot.ID, user);
    const viewModel = getSnapshotViewModel(snapshot, previous);
    return viewModel;
  } else {
    return null;
  }
}

export async function snapshot(req, res) {
  try {
    if (req.isAuthenticated()) {
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) throw new Error('bad request');

      const viewModel: any = await getSnapshot(id, req.user.email);

      if (req.params.decision && req.params.decision > 0) {
        if (typeof req.params.decision !== 'string')
          throw new Error('bad request');

        const confirmed = parseInt(req.params.confirmed);
        if (Number.isNaN(confirmed)) throw new Error('bad request');

        viewModel.ConfirmDecision = req.params.decision;
        viewModel.Confirmed = confirmed;
      }

      if (viewModel != null) {
        res.json({ snapshot: viewModel });
      } else {
        res.status(404);
        res.json({ error: 'snapshot not found' });
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

export async function getPreviousDecision(snapshotId, user) {
  const previous = await query(
    "SELECT s.ID, u.Decision \
        FROM usersnapshots AS u\
        INNER JOIN snapshots AS s ON u.Snapshot_ID = s.ID\
        INNER JOIN snapshots AS cs ON cs.ID = @snapshotId\
        WHERE u.User = @userName \
        AND s.Time < cs.Time AND s.Instrument_ID = cs.Instrument_ID \
        AND (u.Decision = 'buy' OR u.Decision = 'sell')\
        ORDER BY s.Time DESC LIMIT 1",
    {
      '@userName': user,
      '@snapshotId': snapshotId,
    }
  );

  const result: any = {};

  if (previous && previous.length == 1) {
    result.PreviousDecision = previous[0].Decision;
  }

  return result;
}

export async function getPreviousDecisionAndBuyRate(snapshotId, user) {
  const previous = await query(
    "SELECT s.ID, u.Decision, s.Price, s.PriceTime \
        FROM usersnapshots AS u\
        INNER JOIN snapshots AS s ON u.Snapshot_ID = s.ID\
        INNER JOIN snapshots AS cs ON cs.ID = @snapshotId\
        WHERE u.User = @userName \
        AND s.Time < cs.Time AND s.Instrument_ID = cs.Instrument_ID \
        AND (u.Decision = 'buy' OR u.Decision = 'sell')\
        ORDER BY s.Time DESC LIMIT 1",
    {
      '@userName': user,
      '@snapshotId': snapshotId,
    }
  );

  const result: any = {};

  if (previous && previous.length == 1) {
    result.PreviousDecision = previous[0].Decision;
    if (result.PreviousDecision == 'buy') {
      result.PreviousBuyRate = previous[0].Price;
      result.PreviousTime = moment(previous[0].PriceTime).format('YYMMDD');
    }
  }

  return result;
}

export async function isLongWait(snapshotId, user) {
  const previous = await query(
    "SELECT s.ID, u.Decision, s.Price, s.PriceTime \
        FROM usersnapshots AS u\
        INNER JOIN snapshots AS s ON u.Snapshot_ID = s.ID\
        INNER JOIN snapshots AS cs ON cs.ID = @snapshotId\
        WHERE u.User = @userName \
        AND s.Time < cs.Time AND s.Instrument_ID = cs.Instrument_ID \
        AND ((u.Decision = 'wait1yr' AND s.Time > cs.Time - INTERVAL 1 YEAR) OR \
             (u.Decision = 'wait2mo' AND s.Time > cs.Time - INTERVAL 2 MONTH))",
    {
      '@userName': user,
      '@snapshotId': snapshotId,
    }
  );

  if (previous && previous.length > 0) {
    return true;
  } else {
    return false;
  }
}

export async function getNextDecision(snapshotId, user) {
  const next = await query(
    "SELECT s.ID, u.Decision \
        FROM usersnapshots AS u\
        INNER JOIN snapshots AS s ON u.Snapshot_ID = s.ID\
        INNER JOIN snapshots AS cs ON cs.ID = @snapshotId\
        WHERE u.User = @userName \
        AND s.Time > cs.Time AND s.Instrument_ID = cs.Instrument_ID \
        AND (u.Decision = 'buy' OR u.Decision = 'sell')\
        ORDER BY s.Time DESC LIMIT 1",
    {
      '@userName': user,
      '@snapshotId': snapshotId,
    }
  );

  const result: any = {};

  if (next && next.length == 1) {
    result.NextDecision = next[0].Decision;
  }

  return result;
}

export async function setDecision(req, res) {
  try {
    if (req.isAuthenticated()) {
      const snapshotId = req.body.id;
      if (typeof snapshotId !== 'number') throw new Error('bad request');

      const confirm =
        typeof req.body.confirm === 'string' && req.body.confirm
          ? parseInt(req.body.confirm)
          : undefined;
      if (confirm && Number.isNaN(confirm)) throw new Error('bad request');

      const confirmed = req.body.confirmed;
      if (confirmed && typeof confirmed !== 'number')
        throw new Error('bad request');

      const decision = req.body.decision;
      if (typeof decision !== 'string') throw new Error('bad request');

      if (confirm && confirm >= 1) {
        const toCheck = await query(
          'SELECT ID, Decision, Confirmed FROM usersnapshots WHERE User = @userName AND ID = @id AND Snapshot_ID = @snapshotId',
          {
            '@userName': req.user.email,
            '@id': confirm,
            '@snapshotId': snapshotId,
          }
        );

        if (toCheck && toCheck.length > 0) {
          const confirmation = toCheck[0].Decision == decision ? 1 : -1;

          await model.usersnapshot.update(
            {
              Confirmed: parseInt(confirmed) + confirmation,
              ModifiedTime: new Date(),
            },
            {
              where: {
                User: req.user.email,
                ID: toCheck[0].ID,
              },
            }
          );

          res.json({ status: 'ok' });
          return;
        }
      }

      if (decision == 'buy' || decision == 'sell') {
        const previous = await getPreviousDecision(snapshotId, req.user.email);
        if (previous.PreviousDecision) {
          if (previous.PreviousDecision == 'buy') {
            if (decision == 'buy') {
              throw new Error('Conflicting buy decision in the past');
            }
          } else if (previous.PreviousDecision == 'sell') {
            if (decision == 'sell') {
              throw new Error('Conflicting sell decision in the past');
            }
          }
        }

        const next = await getNextDecision(snapshotId, req.user.email);
        if (next.NextDecision) {
          if (next.NextDecision == 'buy') {
            if (decision == 'buy') {
              throw new Error('Conflicting buy decision in the future');
            }
          } else if (next.NextDecision == 'sell') {
            if (decision == 'sell') {
              throw new Error('Conflicting sell decision in the future');
            }
          }
        }
      }

      const usersnapshot = await model.usersnapshot.findOne({
        where: {
          User: req.user.email,
          Snapshot_ID: snapshotId,
        },
      });

      let deletePortfolio = false;

      if (usersnapshot) {
        if (usersnapshot.Decision != decision) {
          deletePortfolio = true;

          await model.usersnapshot.update(
            {
              Decision: decision,
              ModifiedTime: new Date(),
            },
            {
              where: {
                User: req.user.email,
                Snapshot_ID: snapshotId,
              },
            }
          );
        }

        if (deletePortfolio) {
          const snapshot = await model.snapshot.findOne({
            where: {
              ID: snapshotId,
            },
          });

          let fromTime = new Date(snapshot.Time);

          await model.portfolio.destroy({
            where: {
              User: req.user.email,
              Time: {
                [Op.gte]: fromTime,
              },
            },
          });

          const latest = await model.portfolio.findOne({
            where: {
              User: req.user.email,
            },
            order: [['Time', 'DESC']],
            limit: 1,
          });

          if (latest) {
            fromTime = new Date(latest.Time);
          }

          await model.trade.destroy({
            where: {
              User: req.user.email,
              Time: {
                [Op.gte]: fromTime,
              },
            },
          });
        }
      } else {
        await model.usersnapshot.create({
          Snapshot_ID: snapshotId,
          User: req.user.email,
          Decision: decision,
          ModifiedTime: new Date(),
        });
      }

      res.json({ status: 'ok' });
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

export async function resetStats(snapshotId, endTime) {
  const users = await query(
    'SELECT u.User FROM usersnapshots AS u WHERE u.Snapshot_ID = @snapshotId',
    {
      '@snapshotId': snapshotId,
    }
  );

  for (let u = 0; u < users.length; ++u) {
    let fromTime = new Date(endTime);

    await model.portfolio.destroy({
      where: {
        User: users[u].User,
        Time: {
          [Op.gte]: fromTime,
        },
      },
    });

    const latest = await model.portfolio.findOne({
      where: {
        User: users[u].User,
      },
      order: [['Time', 'DESC']],
      limit: 1,
    });

    if (latest) {
      fromTime = new Date(latest.Time);
    }

    await model.trade.destroy({
      where: {
        User: users[u].User,
        Time: {
          [Op.gte]: fromTime,
        },
      },
    });
  }
}

export async function setRates(snapshotId, source, marketId, rates, endTime) {
  let transaction;

  try {
    transaction = await model.sequelize.transaction();

    await model.snapshotrate.destroy({
      where: {
        Snapshot_ID: snapshotId,
      },
      transaction: transaction,
    });

    await model.snapshotrate.bulkCreate(
      rates.map(function (r) {
        return {
          Snapshot_ID: snapshotId,
          Open: r.Open,
          Close: r.Close,
          High: r.High,
          Low: r.Low,
          Time: r.Time,
        };
      }),
      {
        transaction: transaction,
      }
    );

    await model.snapshot.update(
      {
        SourceType: source,
        Price: rates[rates.length - 1].Close,
        PriceTime: rates[rates.length - 1].Time,
        FirstPriceTime: rates[0].Time,
        MarketId: marketId,
      },
      {
        where: {
          ID: snapshotId,
        },
        transaction: transaction,
      }
    );

    await model.usersnapshot.update(
      {
        ModifiedTime: new Date(),
      },
      {
        where: {
          Snapshot_ID: snapshotId,
        },
        transaction: transaction,
      }
    );

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
  }

  await resetStats(snapshotId, endTime);
}

export async function refreshSnapshotRates(req, res) {
  try {
    if (req.isAuthenticated() && req.user.email == envconfig.admin_user) {
      const snapshotId = req.body.id;
      let newSource = req.body.source;
      let newMarketId = req.body.market;

      if (typeof snapshotId !== 'number') throw new Error('bad request');
      if (typeof newSource !== 'string') throw new Error('bad request');
      if (typeof newMarketId !== 'string') throw new Error('bad request');

      const snapshots = await query(
        'SELECT s.StartTime, s.Time, s.Instrument_ID, s.SourceType, s.MarketId FROM snapshots AS s WHERE s.ID = @id',
        {
          '@id': snapshotId,
        }
      );

      if (snapshots.length == 0) {
        res.json({ error: 'snapshot not found' });
        return;
      }

      const startTime = parseDate(snapshots[0].StartTime);
      const endTime = parseDate(snapshots[0].Time);
      const instrumentId = snapshots[0].Instrument_ID;

      if (!newSource) {
        newSource = snapshots[0].SourceType;
        if (!newMarketId) {
          newMarketId = snapshots[0].MarketId;
        }
      }

      if (!newSource) {
        res.json({ error: 'source not found' });
        return;
      }

      let sources = await model.source.findAll({
        where: {
          Instrument_ID: instrumentId,
          SourceType: newSource,
        },
      });

      if (sources.length == 0) {
        sources = await model.source.findAll({
          where: {
            Instrument_ID: instrumentId,
          },
        });

        sources = sources.filter((x) => _sources.indexOf(x.SourceType) >= 0);
        sources.sort((x) => _sources.indexOf(x.SourceType));

        if (sources.length == 0) {
          res.json({ error: 'source not found' });
          return;
        }
      }

      const sourceInfo = sources[0];

      if (!newMarketId) {
        newMarketId = sourceInfo.MarketId;
      }

      async function checkRatesCallback(rates) {
        const problem = checkRates(rates, startTime, endTime, newSource);
        return problem == null;
      }

      try {
        const ratesResponse = await getRates(
          newSource,
          sourceInfo.SourceId,
          newMarketId,
          startTime,
          endTime,
          checkRatesCallback
        );
        if (ratesResponse && ratesResponse.Rates) {
          const newRates = ratesResponse.Rates;

          await setRates(
            snapshotId,
            ratesResponse.Source,
            ratesResponse.MarketId,
            newRates,
            endTime
          );

          res.json({ status: 'ok' });
        } else {
          res.json({ error: 'no rates' });
        }
      } catch (e) {
        const error = e as Error;
        if (error.message == market_not_found) {
          res.json({ error: 'market not found' });
        } else if (error.message == invalid_response) {
          res.json({ error: 'invalid provider response' });
        } else {
          res.json({ error: error.message });
        }
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

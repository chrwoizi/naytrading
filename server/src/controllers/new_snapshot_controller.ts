import model from '../models/index';
import { query } from '../sql/sql';
import {
  market_not_found,
  invalid_response,
  sources,
  getRates,
} from '../providers/rates_provider';
import {
  ensureRates,
  getSnapshot,
  getPreviousDecisionAndBuyRate,
  getSnapshotViewModel,
} from './snapshot_controller';
import { Op } from 'sequelize';
import { readFileSync } from 'fs';
import envconfig from '../config/envconfig';
import { get } from '../config/settings';
import * as moment from 'moment';

const env = envconfig.env;
const snapshot_valid_seconds = envconfig.snapshot_valid_seconds;
const max_strikes = envconfig.max_strikes;
const strikes_order_weight = envconfig.strikes_order_weight;
const bought_order_weight = envconfig.bought_order_weight;
const capitalization_order_weight = envconfig.capitalization_order_weight;
const snapshot_count_order_weight = envconfig.snapshot_count_order_weight;
const static_weight = envconfig.static_weight;
const chart_period_seconds = envconfig.chart_period_seconds;
const discard_threshold_missing_workdays =
  envconfig.discard_threshold_missing_workdays;
const discard_threshold_seconds = envconfig.discard_threshold_seconds;
const job_alive_interval_seconds = envconfig.job_alive_interval_seconds;
const random_order_weight = envconfig.random_order_weight;
const max_unused_snapshot_age_hours = envconfig.max_unused_snapshot_age_hours;
const check_rate = envconfig.check_rate;

function logVerbose(message) {
  if (env == 'development') {
    console.log(message);
  }
}

let rank_instruments = '';
try {
  rank_instruments = readFileSync(
    __dirname + '/../sql/rank_instruments.sql',
    'utf8'
  );
} catch (e) {
  const error = e as Error;
  console.log('Error:', error.stack);
}

let rank_open_snapshots_new = '';
try {
  rank_open_snapshots_new = readFileSync(
    __dirname + '/../sql/rank_open_snapshots_new.sql',
    'utf8'
  );
} catch (e) {
  const error = e as Error;
  console.log('Error:', error.stack);
}

let rank_open_snapshots_old = '';
try {
  rank_open_snapshots_old = readFileSync(
    __dirname + '/../sql/rank_open_snapshots_old.sql',
    'utf8'
  );
} catch (e) {
  const error = e as Error;
  console.log('Error:', error.stack);
}

let get_open_snapshots = '';
try {
  get_open_snapshots = readFileSync(
    __dirname + '/../sql/get_open_snapshots.sql',
    'utf8'
  );
} catch (e) {
  const error = e as Error;
  console.log('Error:', error.stack);
}

const lockFlag = 0;

function isEmpty(str) {
  return typeof str === 'undefined' || str == null || !str.length;
}

function parseDate(str) {
  return new Date(
    parseInt('20' + str.substr(0, 2)),
    parseInt(str.substr(2, 2)) - 1,
    str.substr(4, 2)
  );
}

export async function getNewSnapshotInstruments(endTime) {
  const upToDateFrom = new Date(
    endTime.getTime() - snapshot_valid_seconds * 1000
  );

  if ((await model.instrument.count({})) == 0) {
    return [];
  }

  let maxCapitalization: number = await model.instrument.max('Capitalization');
  maxCapitalization = Math.max(maxCapitalization, 1);

  const args = {
    '@validFromDateTime': upToDateFrom,
    '@maxCapitalization': maxCapitalization,
    '@maxStrikes': max_strikes,
    '@strikesOrderWeight': strikes_order_weight,
    '@boughtOrderWeight': bought_order_weight,
    '@capitalizationOrderWeight': capitalization_order_weight,
    '@snapshotCountOrderWeight': snapshot_count_order_weight,
    '@staticWeight': static_weight,
  };

  const rows = await query(rank_instruments, args);

  const instrumentIds = rows.sort((a, b) => b.Order - a.Order);
  return instrumentIds;
}

/**
Gets an index from gaussian normal distribution
@param count number of list items.
@param randomRange range within the list from which to pick items. e.g. 0.33 means picking from the first third of the list.
@return An index within [0..count-1].
*/
function getRandomIndex(count, randomRange) {
  const u1 = 1.0 - Math.random();
  const u2 = 1.0 - Math.random();

  // gaussian normal distribution around 0 with standard deviation of 1
  const randStdNormal =
    Math.sqrt(-2.0 * Math.log(u1)) * Math.sin(2.0 * Math.PI * u2);

  // roughly within [0..1] where 0 has the highest probability and 1+ the lowest.
  // values are <1 with probability 99,73% but can be larger
  const randNormal = Math.abs(randStdNormal) / 3.0;

  const index = Math.floor(randNormal * count * randomRange) % count;
  return index;
}

export const minDays =
  5 * (chart_period_seconds / 60 / 60 / 24 / 7) -
  discard_threshold_missing_workdays;

export async function isAutoWait(newSnapshot) {
  if (newSnapshot.PreviousDecision == 'buy') {
    if (
      newSnapshot.Rates &&
      newSnapshot.Rates.length > 0 &&
      newSnapshot.PreviousBuyRate != null
    ) {
      const lastRate = newSnapshot.Rates[newSnapshot.Rates.length - 1];
      if (
        lastRate.C < newSnapshot.PreviousBuyRate &&
        lastRate.C > 0.9 * newSnapshot.PreviousBuyRate
      ) {
        return true;
      }
    }

    return false;
  }

  const endTime = new Date();
  endTime.setHours(0, 0, 0, 0);
  const startTime = new Date(endTime.getTime() - chart_period_seconds * 1000);

  const firstRatesUntil = new Date(
    startTime.getTime() + 1000 * (chart_period_seconds * 0.2)
  );
  const lastRatesFrom = new Date(
    endTime.getTime() - 1000 * (chart_period_seconds * 0.2)
  );

  const firstRates = newSnapshot.Rates.filter((x) => x.Time < firstRatesUntil);
  const lastRates = newSnapshot.Rates.filter((x) => x.Time > lastRatesFrom);

  if (firstRates.length == 0 || lastRates.length == 0) {
    return false;
  }

  const firstAverage =
    firstRates.map((x) => x.Close).reduce((a, b) => a + b) / firstRates.length;
  const lastAverage =
    lastRates.map((x) => x.Close).reduce((a, b) => a + b) / lastRates.length;

  // overall bearish trend
  return lastAverage < firstAverage;
}

async function handleRateProviderError(instrument, source, error) {
  if (error && error.message && error.message == market_not_found) {
    const strikes = max_strikes + 12;
    const reason = 'the market id ' + source.MarketId + ' does not exist';
    logVerbose(
      'Setting ' +
        strikes +
        ' strikes on instrument ' +
        instrument.InstrumentName +
        ' (' +
        source.SourceId +
        ' on ' +
        source.SourceType +
        ') because ' +
        reason
    );
    await source.update({
      Strikes: strikes,
      LastStrikeTime: new Date(),
      StrikeReason: (reason || '').substr(0, 200),
    });

    await increaseMonitor(
      'preload_missing',
      source.SourceType,
      source.MarketId || 'null'
    );
  } else if (error && error.message && error.message == invalid_response) {
    const reason =
      'the server returned an unexpected response for market id ' +
      source.MarketId;
    logVerbose(
      'Adding 5 strikes to instrument ' +
        instrument.InstrumentName +
        ' (' +
        source.SourceId +
        ' on ' +
        source.SourceType +
        ') because ' +
        reason
    );
    await source.update({
      Strikes: source.Strikes + 5,
      LastStrikeTime: new Date(),
      StrikeReason: (reason || '').substr(0, 200),
    });

    await increaseMonitor(
      'preload_invalid',
      source.SourceType,
      source.MarketId || 'null'
    );
  } else {
    if (error && error.message) {
      console.log(error.message + '\n' + error.stack);
    } else {
      console.log('unknown error type: ' + error);
    }
    const reason = 'it caused an exception: ' + error;
    let inc = 1;
    if (
      error &&
      error.message &&
      error.message.contains &&
      error.message.contains('HTTP 410')
    ) {
      inc = 5;
    }
    logVerbose(
      'Adding ' +
        inc +
        ' strike to instrument ' +
        instrument.InstrumentName +
        ' (' +
        source.SourceId +
        ' on ' +
        source.SourceType +
        ') because ' +
        reason
    );
    await source.update({
      Strikes: source.Strikes + inc,
      LastStrikeTime: new Date(),
      StrikeReason: (reason || '').substr(0, 200),
    });

    await increaseMonitor('preload_exception', source.SourceType, undefined);
  }
}

async function updateIsinWkn(instrument, isin, wkn) {
  let updated = false;
  const fields: any = {};
  if (isEmpty(instrument.Isin) && !isEmpty(isin)) {
    fields.Isin = isin;
    updated = true;
  }
  if (isEmpty(instrument.Wkn) && !isEmpty(wkn)) {
    fields.Wkn = wkn;
    updated = true;
  }
  if (updated) {
    await instrument.update(fields);
    instrument.Isin = isin;
    instrument.Wkn = wkn;
  }
}

export function checkRates(rates, startTime, endTime, source) {
  const minRateTime = new Date(
    startTime.getTime() + 1000 * discard_threshold_seconds
  );
  const maxRateTime = new Date(
    endTime.getTime() - 1000 * discard_threshold_seconds
  );

  if (rates == null || rates.length == 0) {
    return {
      Strikes: source.Strikes + 5,
      Reason: 'there are no rates',
    };
  } else if (
    rates[0].Time > minRateTime ||
    rates[rates.length - 1].Time < maxRateTime
  ) {
    return {
      Strikes: max_strikes + 6,
      Reason:
        'the rates are not available for the full time span. min: ' +
        rates[0].Time +
        ', max: ' +
        rates[rates.length - 1].Time,
    };
  } else if (rates.length < minDays) {
    return {
      Strikes: max_strikes + 6,
      Reason:
        'too many rates are missing within time span. length: ' + rates.length,
    };
  }

  return null;
}

async function updateMarket(source, marketId) {
  if (marketId != source.MarketId) {
    // change preferred market id for source
    source.MarketId = marketId;
    await source.update({
      MarketId: marketId,
    });
  }
}

async function findSimilarSnapshot(instrumentId, startTime, endDate) {
  const snapshot = await model.snapshot.findOne({
    include: [
      {
        model: model.instrument,
      },
      {
        model: model.snapshotrate,
      },
    ],
    where: {
      Instrument_ID: instrumentId,
      StartTime: startTime,
      Time: {
        [Op.gte]: endDate,
      },
    },
    order: [
      ['Time', 'ASC'],
      ['ID', 'ASC'],
      [model.snapshotrate, 'Time', 'ASC'],
    ],
    limit: 1,
  });

  if (snapshot) {
    await ensureRates(snapshot);
  }

  return snapshot;
}

function isAlive(sourceType) {
  const alive = get('alive_failure_' + sourceType);
  if (alive && alive.length > 0) {
    const date = moment(alive);
    if (date.isValid()) {
      const seconds = moment(new Date()).diff(date, 'seconds');
      if (seconds < 2 * job_alive_interval_seconds) {
        console.log(
          'Skipping source type ' +
            sourceType +
            ' because the alive test failed'
        );
        return false;
      }
    }
  }
  return true;
}

export async function createNewSnapshotFromRandomInstrument(instrumentIds) {
  const endTime = new Date();
  const endDate = new Date(endTime.getTime());
  endDate.setHours(0, 0, 0, 0);
  const startTime = new Date(endDate.getTime() - chart_period_seconds * 1000);

  // try to load rates of a random instrument.
  // if rates can not be loaded, try another random instrument.
  // try for a fixed number of times to avoid infinite loop.
  for (let i = 0; i < Math.min(instrumentIds.length, 10); ++i) {
    const index = getRandomIndex(instrumentIds.length, random_order_weight);

    const instrument = await model.instrument.findOne({
      where: {
        ID: instrumentIds[index].ID,
      },
      include: [
        {
          model: model.source,
        },
      ],
    });

    try {
      const sortedSources = instrument.sources
        .filter((x) => x.Status == 'ACTIVE')
        .filter((x) => x.Strikes < max_strikes)
        .filter((x) => sources.indexOf(x.SourceType) >= 0)
        .filter((x) => isAlive(x.SourceType));
      sortedSources.sort(function (a, b) {
        const aIndex = sources.indexOf(a.SourceType);
        const bIndex = sources.indexOf(b.SourceType);
        return aIndex - bIndex;
      });

      for (let s = 0; s < sortedSources.length; ++s) {
        const source = sortedSources[s];
        try {
          let problem: any = null;
          async function checkRatesCallback(rates) {
            problem = checkRates(rates, startTime, endTime, source);
            return problem == null;
          }

          const ratesResponse = await getRates(
            source.SourceType,
            source.SourceId,
            source.MarketId,
            startTime,
            endTime,
            checkRatesCallback
          );

          if (
            ratesResponse &&
            ratesResponse.Rates &&
            ratesResponse.Rates.length > 0
          ) {
            const rates = ratesResponse.Rates;

            await updateIsinWkn(
              instrument,
              ratesResponse.Isin,
              ratesResponse.Wkn
            );

            await updateMarket(source, ratesResponse.MarketId);

            const similar = await findSimilarSnapshot(
              instrument.ID,
              startTime,
              endDate
            );

            if (similar) {
              return similar;
            }

            await increaseMonitor(
              'preload_ok',
              source.SourceType,
              ratesResponse.MarketId || 'null'
            );

            const snapshot = await model.snapshot.create(
              {
                StartTime: startTime,
                Time: endTime,
                snapshotrates: rates,
                Price: rates[rates.length - 1].Close,
                PriceTime: rates[rates.length - 1].Time,
                FirstPriceTime: rates[0].Time,
                Instrument_ID: instrument.ID,
                SourceType: source.SourceType,
                MarketId: ratesResponse.MarketId,
              },
              {
                include: [
                  {
                    model: model.instrument,
                  },
                  {
                    model: model.snapshotrate,
                  },
                ],
              }
            );

            snapshot.instrument = instrument;
            return snapshot;
          } else if (problem != null) {
            //console.log("Changing strikes on instrument " + instrument.InstrumentName + " from " + source.Strikes + " to " + problem.Strikes + " because " + problem.Reason);
            await source.update({
              Strikes: problem.Strikes,
              LastStrikeTime: new Date(),
              StrikeReason: (problem.Reason || '').substr(0, 200),
            });

            await increaseMonitor(
              'preload_rates',
              source.SourceType,
              source.MarketId || 'null'
            );
          } else {
            await handleRateProviderError(
              instrument,
              source,
              new Error(market_not_found)
            );
          }
        } catch (error) {
          await handleRateProviderError(instrument, source, error);
        }
      }
    } catch (e) {
      const error = e as Error;
      console.log(error.message + '\n' + error.stack);
    }

    if (lockFlag > 0) {
      break;
    }
  }

  return null;
}

async function increaseMonitor(name, sourceType, marketId) {
  const monitors = await query(
    'select id, value from monitors as m where m.`key` = @key and m.createdAt > CURDATE()',
    {
      '@key': name,
    }
  );

  let monitor;
  if (monitors.length > 0) {
    monitor = JSON.parse(monitors[0].value || '{}');
  } else {
    monitor = {};
  }

  if (!monitor.sources) {
    monitor.sources = {};
  }

  if (typeof marketId !== 'undefined') {
    if (!monitor.sources[sourceType]) {
      monitor.sources[sourceType] = {};
    }

    if (!monitor.sources[sourceType].markets) {
      monitor.sources[sourceType].markets = {};
    }

    if (!monitor.sources[sourceType].markets[marketId]) {
      monitor.sources[sourceType].markets[marketId] = 0;
    }

    monitor.sources[sourceType].markets[marketId]++;
  } else {
    if (!monitor.sources[sourceType]) {
      monitor.sources[sourceType] = 0;
    }

    monitor.sources[sourceType]++;
  }

  if (monitors.length == 0) {
    await model.monitor.create({
      key: name,
      value: JSON.stringify(monitor),
    });
  } else {
    await model.monitor.update(
      {
        value: JSON.stringify(monitor),
      },
      {
        where: {
          id: monitors[0].id,
        },
      }
    );
  }
}

async function handleNewRandomSnapshot(req, res, allowConfirm) {
  try {
    if (req.isAuthenticated()) {
      const endTime = new Date();
      endTime.setHours(0, 0, 0, 0);

      let hours = max_unused_snapshot_age_hours;
      if (typeof req.query.max_age === 'string') {
        hours = parseFloat(req.query.max_age);
        if (Number.isNaN(hours)) throw new Error('bad request');
      }

      let forgotten = await query(rank_open_snapshots_new, {
        '@userName': req.user.email,
        '@hours': hours,
      });

      if (!(forgotten && forgotten.length > 0)) {
        forgotten = await query(rank_open_snapshots_old, {
          '@userName': req.user.email,
          '@hours': hours,
        });
      }

      const confirm = Math.random() < check_rate;
      if ((allowConfirm && confirm) || !(forgotten && forgotten.length > 0)) {
        const toCheck = await query(
          "SELECT ID, Snapshot_ID, Confirmed FROM usersnapshots WHERE User = @userName AND Decision = 'buy' ORDER BY ABS(Confirmed), ModifiedTime",
          {
            '@userName': req.user.email,
          }
        );

        if (toCheck && toCheck.length > 0) {
          const index = getRandomIndex(toCheck.length, random_order_weight);
          const viewModel: any = await getSnapshot(
            toCheck[index].Snapshot_ID,
            req.user.email
          );
          viewModel.ConfirmDecision = toCheck[index].ID;
          viewModel.Confirmed = toCheck[index].Confirmed;
          res.json({ snapshot: viewModel });
          return;
        }
      }

      if (forgotten && forgotten.length > 0) {
        const index = getRandomIndex(forgotten.length, random_order_weight);
        const viewModel = await getSnapshot(
          forgotten[index].ID,
          req.user.email
        );
        res.json({ snapshot: viewModel });
        return;
      }

      res.status(404);
      res.json({ error: 'no instrument available' });
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

async function handleGetOpenSnapshots(req, res) {
  try {
    if (req.isAuthenticated()) {
      const endTime = new Date();
      endTime.setHours(0, 0, 0, 0);

      let count = 1;
      if (typeof req.query.count === 'string') {
        count = parseInt(req.query.count);
        if (Number.isNaN(count)) throw new Error('bad request');
      }

      const forgotten = await query(get_open_snapshots, {
        '@userName': req.user.email,
        '@maxCount': count,
      });

      if (forgotten && forgotten.length > 0) {
        const results: any[] = [];
        for (let i = 0; i < count && i < forgotten.length; ++i) {
          const viewModel = await getSnapshot(forgotten[i].ID, req.user.email);
          results.push(viewModel);
        }
        res.json(results);
        return;
      }

      res.status(404);
      res.json({ error: 'no snapshot available' });
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

export async function createNewRandomSnapshot(req, res) {
  await handleNewRandomSnapshot(req, res, false);
}

export async function createNewRandomOrConfirmSnapshot(req, res) {
  await handleNewRandomSnapshot(req, res, true);
}

export async function getOpenSnapshots(req, res) {
  await handleGetOpenSnapshots(req, res);
}

export async function createNewSnapshotByInstrumentId(req, res) {
  try {
    if (req.isAuthenticated()) {
      const instrumentId = parseInt(req.params.instrumentId);
      if (Number.isNaN(instrumentId)) throw new Error('bad request');

      const upToDateFrom = new Date(
        new Date().getTime() - snapshot_valid_seconds * 1000
      );
      const existing = await query(
        'SELECT s.ID FROM snapshots AS s \
                WHERE s.Instrument_ID = @instrumentId AND s.Time >= @time \
                AND NOT EXISTS (SELECT 1 FROM usersnapshots AS nu WHERE nu.Snapshot_ID = s.ID AND nu.User = @user) \
                ORDER BY s.Time ASC',
        {
          '@instrumentId': instrumentId,
          '@time': upToDateFrom,
          '@user': req.user.email,
        }
      );

      if (existing && existing.length > 0) {
        const viewModel = await getSnapshot(existing[0].ID, req.user.email);
        res.json({ snapshot: viewModel });
        return;
      }

      const instrumentIds = [{ ID: instrumentId, Order: 1 }];

      const newSnapshot = await createNewSnapshotFromRandomInstrument(
        instrumentIds
      );
      if (newSnapshot != null) {
        const previous = await getPreviousDecisionAndBuyRate(
          newSnapshot.ID,
          req.user.email
        );
        const viewModel = getSnapshotViewModel(newSnapshot, previous);
        res.json({ snapshot: viewModel });
        return;
      } else {
        res.status(404);
        res.json({ error: 'instrument not available' });
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

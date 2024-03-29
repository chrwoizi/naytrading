import model from '../models/index';
import { Op } from 'sequelize';
import { query } from '../sql/sql';
import { readFileSync } from 'fs';
import envconfig from '../config/envconfig';

let trades_sql = '';
try {
  trades_sql = readFileSync(__dirname + '/../sql/trades.sql', 'utf8');
} catch (e) {
  const error = e as Error;
  console.log('Error:', error.stack);
}

let previous_trade_sql = '';
try {
  previous_trade_sql = readFileSync(
    __dirname + '/../sql/previous_trade.sql',
    'utf8'
  );
} catch (e) {
  const error = e as Error;
  console.log('Error:', error.stack);
}

let open_trade_values_sum_sql = '';
try {
  open_trade_values_sum_sql = readFileSync(
    __dirname + '/../sql/open_trade_values_sum.sql',
    'utf8'
  );
} catch (e) {
  const error = e as Error;
  console.log('Error:', error.stack);
}

async function getOpenValues(user, fromTime) {
  const openTradeValuesSum = await query(open_trade_values_sum_sql, {
    '@userName': user,
    '@toDate': fromTime,
  });
  return openTradeValuesSum[0].Value;
}

export const status = {
  isRunning: false,
  updatingUser: null,
};

export async function updateUser(user) {
  status.updatingUser = user;

  let latest = await model.portfolio.findOne({
    where: {
      User: user,
    },
    order: [['Time', 'DESC']],
    limit: 1,
  });

  let fromTime = new Date(1970, 0, 1);
  if (latest) {
    fromTime = new Date(latest.Time);
    fromTime.setHours(0, 0, 0, 0);
  }

  await model.portfolio.destroy({
    where: {
      User: user,
      Time: {
        [Op.gte]: fromTime,
      },
    },
  });

  latest = await model.portfolio.findOne({
    where: {
      User: user,
    },
    order: [['Time', 'DESC']],
    limit: 1,
  });

  let deposit = 0;
  let balance = 0;
  let open = 0;
  let complete = 0;
  if (latest) {
    deposit = latest.Deposit;
    balance = latest.Balance;
    open = latest.OpenCount;
    complete = latest.CompleteCount;

    fromTime = new Date(latest.Time);
  }

  await model.trade.destroy({
    where: {
      User: user,
      Time: {
        [Op.gte]: fromTime,
      },
    },
  });

  const trades = await query(trades_sql, {
    '@userName': user,
    '@fromDate': fromTime,
  });

  for (let t = 0; t < trades.length; ++t) {
    const trade = trades[t];

    const tradeDay = new Date(trade.DecisionTime);
    tradeDay.setHours(0, 0, 0, 0);
    if (tradeDay > fromTime) {
      if (open + complete > 0) {
        fromTime.setHours(23, 59, 59);

        const fromDay = new Date(fromTime.getTime());
        fromDay.setHours(0, 0, 0, 0);
        await model.portfolio.destroy({
          where: {
            User: user,
            Time: {
              [Op.gte]: fromDay,
            },
          },
        });

        const value = balance + (await getOpenValues(user, fromTime));
        await model.portfolio.create({
          User: user,
          Time: fromTime,
          Deposit: deposit,
          Balance: balance,
          Value: value,
          OpenCount: open,
          CompleteCount: complete,
        });
      }
    }

    fromTime = tradeDay;

    let quantity = 0;
    if (trade.Decision == 'buy') {
      quantity = Math.floor(
        envconfig.job_portfolios_trade_volume / trade.Price
      );
      balance -= quantity * trade.Price;
      balance -= envconfig.job_portfolios_trade_fee;
      if (balance < 0) {
        deposit -= balance;
        balance = 0;
      }
      open++;
    }

    if (trade.Decision == 'sell') {
      const previousTrades = await query(previous_trade_sql, {
        '@refSnapshotId': trade.SnapshotId,
        '@refTime': trade.DecisionTime,
        '@userName': user,
      });

      if (!previousTrades || !previousTrades.length) {
        throw new Error(
          'could not find previous buy trade for snapshot ' + trade.SnapshotId
        );
      }

      quantity = -previousTrades[0].Quantity;
      balance -= quantity * trade.Price;
      balance -= envconfig.job_portfolios_trade_fee;
      if (balance < 0) {
        deposit -= balance;
        balance = 0;
      }
      open--;
      complete++;
    }

    await model.trade.create({
      User: user,
      Time: trade.DecisionTime,
      Price: trade.Price,
      Quantity: quantity,
      Snapshot_ID: trade.SnapshotId,
    });
  }

  fromTime.setHours(23, 59, 59);

  const value = balance + (await getOpenValues(user, fromTime));
  await model.portfolio.create({
    User: user,
    Time: fromTime,
    Deposit: deposit,
    Balance: balance,
    Value: value,
    OpenCount: open,
    CompleteCount: complete,
  });

  status.updatingUser = null;
}

export async function run() {
  try {
    const users = await query(
      'SELECT DISTINCT(u.User) FROM usersnapshots AS u'
    );

    for (let i = 0; i < users.length; ++i) {
      const user = users[i].User;

      try {
        await updateUser(user);
      } catch (e2) {
        const userError = e2 as Error;
        console.log(
          'error in portfolios job for user ' +
            user +
            ': ' +
            userError.message +
            '\n' +
            userError.stack
        );
      }
    }
  } catch (e) {
    const error = e as Error;
    console.log(
      'error in portfolios job: ' + error.message + '\n' + error.stack
    );
  }

  setTimeout(run, envconfig.job_portfolios_interval_seconds * 1000);
}

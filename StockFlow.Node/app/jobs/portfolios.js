var exports = module.exports = {}
var model = require('../models/index');
var sequelize = require('sequelize');
var sql = require('../sql/sql');
var fs = require('fs');
var config = require('../config/envconfig');

var trades_sql = "";
try {
    trades_sql = fs.readFileSync(__dirname + '/../sql/trades.sql', 'utf8');
} catch (e) {
    console.log('Error:', e.stack);
}

var previous_trade_sql = "";
try {
    previous_trade_sql = fs.readFileSync(__dirname + '/../sql/previous_trade.sql', 'utf8');
} catch (e) {
    console.log('Error:', e.stack);
}

var open_trade_values_sum_sql = "";
try {
    open_trade_values_sum_sql = fs.readFileSync(__dirname + '/../sql/open_trade_values_sum.sql', 'utf8');
} catch (e) {
    console.log('Error:', e.stack);
}


async function getOpenValues(user, currentDay) {
    var openTradeValuesSum = await sql.query(open_trade_values_sum_sql, {
        "@userName": user,
        "@toDate": currentDay
    });
    return openTradeValuesSum[0].Value;
}

exports.run = async function () {
    try {

        var users = await sql.query('SELECT DISTINCT(snapshot.User) FROM snapshots AS snapshot');

        for (var i = 0; i < users.length; ++i) {
            var user = users[i].User;

            var latest = await model.portfolio.find({
                where: {
                    User: user
                },
                order: [["Time", "DESC"]],
                limit: 1
            });

            var fromTime = new Date(1970, 0, 1);
            if (latest) {
                fromTime = new Date(latest.Time);
                fromTime.setHours(0, 0, 0, 0);
            }

            var currentDay = fromTime;

            await model.portfolio.destroy({
                where: {
                    User: user,
                    Time: {
                        [sequelize.Op.gte]: currentDay
                    }
                }
            });

            await model.trade.destroy({
                where: {
                    User: user,
                    Time: {
                        [sequelize.Op.gte]: currentDay
                    }
                }
            });

            latest = await model.portfolio.find({
                where: {
                    User: user
                },
                order: [["Time", "DESC"]],
                limit: 1
            });

            var deposit = 0;
            var balance = 0;
            var open = 0;
            var complete = 0;
            if (latest) {
                deposit = latest.Deposit;
                balance = latest.Balance;
                open = latest.OpenCount;
                complete = latest.CompleteCount;
            }

            var now = new Date();

            var trades = await sql.query(trades_sql, {
                "@userName": user,
                "@fromDate": currentDay
            });

            for (var t = 0; t < trades.length; ++t) {
                var trade = trades[t];

                var tradeDay = new Date(trade.DecisionTime);
                tradeDay.setHours(0, 0, 0, 0);
                if (tradeDay > currentDay) {
                    if (open + complete > 0) {
                        currentDay.setHours(23, 59, 59);
                        var value = balance + deposit + await getOpenValues(user, currentDay);
                        await model.portfolio.create({
                            User: user,
                            Time: currentDay,
                            Deposit: deposit,
                            Balance: balance,
                            Value: value,
                            OpenCount: open,
                            CompleteCount: complete
                        });
                    }
                }

                currentDay = tradeDay;

                var quantity = 0;
                if (trade.Decision == "buy") {
                    quantity = Math.floor(config.job_portfolios_trade_volume / trade.Price);
                    balance -= quantity * trade.Price;
                    if (balance < 0) {
                        deposit -= balance;
                        balance = 0;
                    }
                    open++;
                }

                if (trade.Decision == "sell") {
                    var previousTrades = await sql.query(previous_trade_sql, {
                        "@refSnapshotId": trade.SnapshotId,
                        "@refTime": trade.DecisionTime
                    });

                    if (!previousTrades || !previousTrades.length) {
                        throw { message: "could not find previous trade for snapshot " + trade.SnapshotId };
                    }

                    quantity = -previousTrades[0].Quantity;
                    balance -= quantity * trade.Price;
                    open--;
                    complete++;
                }

                await model.trade.create({
                    User: user,
                    Time: trade.DecisionTime,
                    Price: trade.Price,
                    Quantity: quantity,
                    Snapshot_ID: trade.SnapshotId
                });

            }

            currentDay.setHours(23, 59, 59);
            var value = balance + deposit + await getOpenValues(user, currentDay);
            await model.portfolio.create({
                User: user,
                Time: currentDay,
                Deposit: deposit,
                Balance: balance,
                Value: value,
                OpenCount: open,
                CompleteCount: complete
            });
        }

    }
    catch (error) {
        console.log("error in portfolios job: " + error.message);
    }

    setTimeout(exports.run, config.job_portfolios_interval_seconds * 1000);
};
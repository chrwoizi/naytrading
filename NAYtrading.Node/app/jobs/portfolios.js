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


async function getOpenValues(user, fromTime) {
    var openTradeValuesSum = await sql.query(open_trade_values_sum_sql, {
        "@userName": user,
        "@toDate": fromTime
    });
    return openTradeValuesSum[0].Value;
}

exports.updateUser = async function(user) {
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

    await model.portfolio.destroy({
        where: {
            User: user,
            Time: {
                [sequelize.Op.gte]: fromTime
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

        fromTime = new Date(latest.Time);
    }

    await model.trade.destroy({
        where: {
            User: user,
            Time: {
                [sequelize.Op.gte]: fromTime
            }
        }
    });

    var trades = await sql.query(trades_sql, {
        "@userName": user,
        "@fromDate": fromTime
    });

    for (var t = 0; t < trades.length; ++t) {
        var trade = trades[t];

        var tradeDay = new Date(trade.DecisionTime);
        tradeDay.setHours(0, 0, 0, 0);
        if (tradeDay > fromTime) {
            if (open + complete > 0) {
                fromTime.setHours(23, 59, 59);

                var fromDay = new Date(fromTime.getTime());
                fromDay.setHours(0, 0, 0, 0);
                await model.portfolio.destroy({
                    where: {
                        User: user,
                        Time: {
                            [sequelize.Op.gte]: fromDay
                        }
                    }
                });

                var value = balance + await getOpenValues(user, fromTime);
                await model.portfolio.create({
                    User: user,
                    Time: fromTime,
                    Deposit: deposit,
                    Balance: balance,
                    Value: value,
                    OpenCount: open,
                    CompleteCount: complete
                });
            }
        }

        fromTime = tradeDay;

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
                throw { message: "could not find previous buy trade for snapshot " + trade.SnapshotId };
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

    fromTime.setHours(23, 59, 59);

    var value = balance + await getOpenValues(user, fromTime);
    await model.portfolio.create({
        User: user,
        Time: fromTime,
        Deposit: deposit,
        Balance: balance,
        Value: value,
        OpenCount: open,
        CompleteCount: complete
    });
};

exports.run = async function () {
    try {

        var users = await sql.query('SELECT DISTINCT(u.User) FROM usersnapshots AS u');

        for (var i = 0; i < users.length; ++i) {
            var user = users[i].User;

            try {
                await exports.updateUser(user);
            }
            catch (userError) {
                console.log("error in portfolios job for user " + user + ": " + userError.message);
            }
        }

    }
    catch (error) {
        console.log("error in portfolios job: " + error.message);
    }

    setTimeout(exports.run, config.job_portfolios_interval_seconds * 1000);
};

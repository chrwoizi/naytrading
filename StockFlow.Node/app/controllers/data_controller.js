var exports = module.exports = {}
var model = require('../models/index');
var sql = require('../sql/sql');
var dateFormat = require('dateformat');
var fs = require('fs');
var viewsController = require('./views_controller.js');
var portfolioJob = require('../jobs/portfolios.js');

var stats_sql = "";
try {
    stats_sql = fs.readFileSync(__dirname + '/../sql/stats.sql', 'utf8');
} catch (e) {
    console.log('Error:', e.stack);
}

var open_trade_values_sql = "";
try {
    open_trade_values_sql = fs.readFileSync(__dirname + '/../sql/open_trade_values.sql', 'utf8');
} catch (e) {
    console.log('Error:', e.stack);
}

var next_sell_trade_sql = "";
try {
    next_sell_trade_sql = fs.readFileSync(__dirname + '/../sql/next_sell_trade.sql', 'utf8');
} catch (e) {
    console.log('Error:', e.stack);
}


function return500(res, e) {
    res.status(500);
    res.json({ error: e.message });
}

function getStatsViewModel(model) {
    function getSaleViewModel(model) {
        return {
            D: dateFormat(model.Time, 'dd.mm.yy'),
            DS: dateFormat(model.Time, 'yymmdd'),
            S: model.IsComplete == 1 ? 'c' : 'o',
            R: (Math.floor(model.Return * 10000)) / 10000.0,
            I: model.InstrumentName
        };
    }

    var valueHistory = [];
    if (model.portfolios && model.portfolios.length > 0) {
        var history = model.portfolios.map(x => {
            return {
                Time: dateFormat(x.Time, 'dd.mm.yyyy'),
                Return: (x.Value - x.Deposit) / x.Deposit
            };
        });
        valueHistory = history.concat(valueHistory);
    }

    return {
        Value: model.portfolio ? model.portfolio.Value : 0,
        Deposit: model.portfolio ? model.portfolio.Deposit : 0,
        ValueHistory: valueHistory,
        OpenCount: model.portfolio ? model.portfolio.OpenCount : 0,
        CompleteCount: model.portfolio ? model.portfolio.CompleteCount : 0,
        Sales: model.Sales.map(getSaleViewModel)
    };
}

async function getStatsForUser(user) {
    var stats = {};
    stats.Sales = [];

    stats.portfolios = await model.portfolio.findAll({
        where: {
            User: user
        },
        order: [["Time", "ASC"]]
    });

    if (stats.portfolios && stats.portfolios.length > 0) {
        stats.portfolio = stats.portfolios[stats.portfolios.length - 1];
    }

    var trades = await sql.query(stats_sql, {
        "@userName": user
    });

    var openTradeValues = await sql.query(open_trade_values_sql, {
        "@userName": user
    });

    var openCount = 0;
    var completeCount = 0;

    var buyTrades = {};
    for (var i = 0; i < trades.length; ++i) {
        var trade = trades[i];

        if (trade.Decision == "buy") {

            var open = openTradeValues.filter(x => x.ID == trade.ID);
            if (open.length == 1) {
                stats.Sales.push({
                    Time: trade.Time,
                    IsComplete: false,
                    Return: (open[0].LatestPrice - trade.Price) / trade.Price,
                    InstrumentName: trade.InstrumentName
                });
                openCount++;
            }
            else {
                buyTrades[trade.InstrumentId] = trade;
            }
        }
        else {

            var buyTrade = buyTrades[trade.InstrumentId];
            if (typeof (buyTrade) === 'undefined') {
                throw { message: "could not find buy trade for user " + user + " and instrument " + trade.InstrumentId };
            }

            delete buyTrades[trade.InstrumentId];

            stats.Sales.push({
                Time: buyTrade.Time,
                IsComplete: true,
                Return: (trade.Price - buyTrade.Price) / buyTrade.Price,
                InstrumentName: trade.InstrumentName
            });
            completeCount++;
        }
    }

    var missing = Object.keys(buyTrades);
    for (var i = 0; i < missing.length; ++i) {
        var buyTrade = buyTrades[missing[i]];
        var sellTrades = await sql.query(next_sell_trade_sql, {
            "@userName": user,
            "@instrumentId": buyTrade.InstrumentId,
            "@fromTime": buyTrade.Time,
        });
        if (sellTrades.length == 0) {
            throw { message: "could not determine sell price for buy trade " + buyTrade.ID };
        }
        else {
            var sellTrade = sellTrades[0];
            stats.Sales.push({
                Time: buyTrade.Time,
                IsComplete: true,
                Return: (sellTrade.Price - buyTrade.Price) / buyTrade.Price,
                InstrumentName: buyTrade.InstrumentName
            });
            completeCount++;
        }
    }

    stats.openCount = openCount;
    stats.completeCount = completeCount;

    return stats;
}

function getErrors(stats) {

    var errors = "";

    if (stats.portfolio) {

        if (stats.openCount != stats.portfolio.OpenCount) {
            errors = "Open trade count mismatch: expected " + stats.portfolio.OpenCount + ", actual " + stats.openCount + ".";
        }

        if (stats.completeCount != stats.portfolio.CompleteCount) {
            if (errors.length > 0) {
                errors += " ";
            }
            errors += "Complete trade count mismatch: expected " + stats.portfolio.CompleteCount + ", actual " + stats.completeCount + ".";
        }
    }

    return errors;
}

exports.getStats = async function (req, res) {
    try {
        if (req.isAuthenticated()) {

            var stats = await getStatsForUser(req.user.email);

            var errors = getErrors(stats);
            
            if (errors.length > 0) {

                if (portfolioJob.getUserLock(req.user.email)) {

                    try {
                        await model.portfolio.destroy({
                            where: {
                                User: req.user.email
                            }
                        });

                        await model.trade.destroy({
                            where: {
                                User: req.user.email
                            }
                        });

                        await portfolioJob.updateUser(req.user.email);

                        stats = await getStatsForUser(req.user.email);

                        var errors = getErrors(stats);                        
                        if (errors.length > 0) {
                            throw { message: errors };
                        }
                    }
                    catch (error) {
                        errors += " ";
                        errors += error.message;
                        throw { message: errors };
                    }
                    finally {
                        portfolioJob.releaseUserLock(req.user.email);
                    }

                }
                else {
                    errors += " Please wait a few minutes for the stats to be rebuild.";
                    throw { message: errors };
                }
            }

            var viewModel = getStatsViewModel(stats);
            res.json(viewModel);

        }
        else {
            res.status(401);
            res.json({ error: "unauthorized" });
        }
    }
    catch (error) {
        return500(res, error);
    }
};

exports.clearDecisions = async function (req, res) {
    try {
        if (req.isAuthenticated()) {

            if (req.user.email.endsWith('.ai')) {

                await model.snapshot.update({
                    Decision: null,
                    ModifiedTime: new Date()
                }, {
                        where: {
                            User: req.user.email
                        }
                    }
                );

                await model.portfolio.destroy({
                    where: {
                        User: req.user.email
                    }
                });

                res.render('clear', viewsController.get_default_args(req));

            }
            else {
                res.status(404);
                res.json({ error: "action not applicable" });
            }

        }
        else {
            res.status(401);
            res.json({ error: "unauthorized" });
        }
    }
    catch (error) {
        return500(res, error);
    }
}

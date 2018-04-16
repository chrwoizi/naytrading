var exports = module.exports = {}
var model = require('../models/index');
var sql = require('../sql/sql');
var sequelize = require('sequelize');
var dateFormat = require('dateformat');
var fs = require('fs');
var viewsController = require('./views_controller.js');

var env = process.env.NODE_ENV || 'development';
var config = require(__dirname + '/../config/config.json')[env];

var stats_sql = "";
try {
    stats_sql = fs.readFileSync(__dirname + '/../sql/stats.sql', 'utf8');
} catch (e) {
    console.log('Error:', e.stack);
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

    return {
        Sales: model.Sales.map(getSaleViewModel)
    };
}

exports.getStats = async function (req, res) {
    try {
        if (req.isAuthenticated()) {

            var stats = {};
            stats.Sales = await sql.query(stats_sql, {
                "@userName": req.user.email
            });

            var viewModel = getStatsViewModel(stats);
            res.json(viewModel);

        }
        else {
            res.status(401);
        }
    }
    catch (error) {
        res.json(JSON.stringify({ error: error.message }));
        res.status(500);
    }
};

exports.clearDecisions = async function (req, res) {
    try {
        if (req.isAuthenticated()) {

            if (req.user.email.endsWith('.ai')) {

                await model.snapshot.update(
                    { Decision: null },
                    { where: { User: req.user.email } }
                );

                res.render('clear', viewsController.get_default_args(req));

            }
            else {
                res.status(404);
            }

        }
        else {
            res.status(401);
        }
    }
    catch (error) {
        res.json(JSON.stringify({ error: error.message }));
        res.status(500);
    }
}

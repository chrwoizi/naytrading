var exports = module.exports = {}
var fs = require('fs');
var path = require('path');
var dateFormat = require('dateformat');
var config = require('../config/envconfig');
var ratesProvider = require('../providers/rates_provider');

function get_default_args(req) {
    return {
        isAuthenticated: req.isAuthenticated(),
        username: req.isAuthenticated() ? req.user.email : undefined,
        isAi: req.isAuthenticated() ? req.user.email.endsWith('.ai') : false,
        isAdmin: req.isAuthenticated() ? req.user.email == config.admin_user : false
    }
}

exports.get_default_args = get_default_args;

exports.home = function (req, res) {

    res.render('about', get_default_args(req));

}

exports.about = function (req, res) {

    res.render('about', get_default_args(req));

}

exports.contact = function (req, res) {

    res.render('contact', get_default_args(req));

}

exports.terms = function (req, res) {

    res.render('terms', get_default_args(req));

}

exports.cookies = function (req, res) {

    res.render('cookies', get_default_args(req));

}

exports.privacy = function (req, res) {

    res.render('privacy', get_default_args(req));

}

exports.disclaimer = function (req, res) {

    res.render('disclaimer', get_default_args(req));

}

exports.faq = function (req, res) {

    res.render('faq', get_default_args(req));

}

function formatTime(obj) {
    var str = obj.time;
    var date = new Date(str.substr(0, 4), parseInt(str.substr(4, 2)) - 1, str.substr(6, 2), str.substr(8, 2), parseInt(str.substr(10, 2)), str.substr(12, 2));
    obj.timeStr = dateFormat(date, 'dd.mm.yyyy HH:mm:ss');
}

function formatTrainDataRatio(obj) {
    obj.dataRatioPercent = ((1 - obj.test_data_ratio) * 100).toFixed(2);
}

function formatTestDataRatio(obj) {
    obj.dataRatioPercent = (obj.test_data_ratio * 100).toFixed(2);
}

exports.manage = function (req, res) {

    var args = get_default_args(req);

    var filePath = path.resolve(config.processing_dir + "/" + req.user.email + "/buying_train_norm.csv");
    if (fs.existsSync(filePath) && fs.existsSync(filePath + ".meta")) {
        args.buyingTrain = JSON.parse(fs.readFileSync(filePath + ".meta", 'utf8'));
        formatTime(args.buyingTrain);
        formatTrainDataRatio(args.buyingTrain);
    }
    else {
        args.buyingTrain = null;
    }

    filePath = path.resolve(config.processing_dir + "/" + req.user.email + "/buying_test_norm.csv");
    if (fs.existsSync(filePath) && fs.existsSync(filePath + ".meta")) {
        args.buyingTest = JSON.parse(fs.readFileSync(filePath + ".meta", 'utf8'));
        formatTime(args.buyingTest);
        formatTestDataRatio(args.buyingTest);
    }
    else {
        args.buyingTest = null;
    }

    filePath = path.resolve(config.processing_dir + "/" + req.user.email + "/selling_train_norm.csv");
    if (fs.existsSync(filePath) && fs.existsSync(filePath + ".meta")) {
        args.sellingTrain = JSON.parse(fs.readFileSync(filePath + ".meta", 'utf8'));
        formatTime(args.sellingTrain);
        formatTrainDataRatio(args.sellingTrain);
    }
    else {
        args.sellingTrain = null;
    }

    filePath = path.resolve(config.processing_dir + "/" + req.user.email + "/selling_test_norm.csv");
    if (fs.existsSync(filePath) && fs.existsSync(filePath + ".meta")) {
        args.sellingTest = JSON.parse(fs.readFileSync(filePath + ".meta", 'utf8'));
        formatTime(args.sellingTest);
        formatTestDataRatio(args.sellingTest);
    }
    else {
        args.sellingTest = null;
    }

    args.hasProcessedData = args.buyingTrain != null || args.buyingTest != null || args.sellingTrain != null || args.sellingTest != null;

    res.render('manage', args);
}

exports.admin = function (req, res) {

    var args = get_default_args(req);
    if (args.isAdmin) {
        args.export_secret = config.export_secret;
        args.import_secret = config.import_secret;
        args.sources = ratesProvider.sources.map(function (x) { return { source: x } });
        args.markets = [];
        for (var i = 0; i < ratesProvider.sources.length; ++i) {
            var markets = ratesProvider.providers[ratesProvider.sources[i]].markets.map(function (x) { return { market: x } });
            args.markets = args.markets.concat(markets);
        }
    }
    res.render('admin', args);

}

exports.clear = function (req, res) {

    res.render('clear', get_default_args(req));

}

exports.app = function (req, res) {

    res.render('app', get_default_args(req));

}

var exports = module.exports = {}
var config = require('../config/envconfig');

function get_default_args(req, title) {
    var fullTitle = "N.A.Y.trading Trader";
    if (title) {
        fullTitle = title + " - N.A.Y.trading Trader";
    }

    return {
        title: fullTitle,
        isAuthenticated: req.isAuthenticated(),
        username: req.isAuthenticated() ? req.user.email : undefined,
        isAdmin: req.isAuthenticated() ? req.user.email == config.admin_user : false
    }
}

exports.get_default_args = get_default_args;

exports.home = function (req, res) {

    return exports.about(req, res);

}

exports.about = function (req, res) {

    var args = get_default_args(req, "About");
    args.naytrading = config.naytrading_url;
    res.render('about', args);

}

exports.faq = function (req, res) {

    res.render('faq', get_default_args(req, "FAQ"));

}

exports.manage = function (req, res) {

    var args = get_default_args(req, "My Account");

    res.render('manage', args);
}

exports.app = function (req, res) {

    res.render('app', get_default_args(req));

}

exports.setTan = function (req, res) {

    res.render('app', get_default_args(req));

}

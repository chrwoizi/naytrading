var exports = module.exports = {}
var config = require('../config/envconfig');

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

exports.manage = function (req, res) {

    res.render('manage', get_default_args(req));

}

exports.admin = function (req, res) {

    var args = get_default_args(req);
    if (args.isAdmin) {
        args.export_secret = config.export_secret;
        args.import_secret = config.import_secret;
    }
    res.render('admin', args);

}

exports.clear = function (req, res) {

    res.render('clear', get_default_args(req));

}

exports.app = function (req, res) {

    res.render('app', get_default_args(req));

}

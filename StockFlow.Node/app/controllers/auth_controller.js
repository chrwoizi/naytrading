var exports = module.exports = {}

var config = require('../config/envconfig');
var model = require('../models/index');
var sql = require('../sql/sql');

function getDefaultArgs(req) {
    return {
        isAuthenticated: req.isAuthenticated(),
        username: req.isAuthenticated() ? req.user.email : undefined,
        isAi: req.isAuthenticated() ? req.user.email.endsWith('.ai') : false
    }
}

exports.setLastLogin = async function (userName) {
    await sql.query("UPDATE users SET last_login = NOW() WHERE email = @userName", {
        "@userName": userName
    });
}

exports.signup = function (req, res) {

    var args = getDefaultArgs(req);
    args.hasError = res.hasError;
    args.hasMessage = res.hasMessage;
    args.message = res.message;
    res.render('signup', args);

}

exports.signin = function (req, res) {

    var args = getDefaultArgs(req);
    args.hasError = res.hasError;
    args.hasMessage = res.hasMessage;
    args.message = res.message;
    res.render('signin', args);

}

exports.password = function (req, res) {

    var args = getDefaultArgs(req);
    args.hasError = res.hasError;
    args.hasMessage = res.hasMessage;
    args.message = res.message;
    res.render('password', args);

}

exports.logout = function (req, res) {

    req.session.destroy(function (err) {

        res.redirect('/');

    });

}

exports.whitelist = async function (req, res) {
    try {
        if (req.isAuthenticated() && req.user.email == config.admin_user) {

            var whitelists = await model.whitelist.findAll({});

            var args = getDefaultArgs(req);
            args.whitelists = whitelists;
            res.render('whitelist', args);

        }
        else {
            res.status(401);
            res.json({ error: "unauthorized" });
        }
    }
    catch (error) {
        res.status(500);
        res.json({ error: error.message });
    }
}

exports.addWhitelist = async function (req, res) {
    try {
        if (req.isAuthenticated() && req.user.email == config.admin_user) {

            await model.whitelist.create({
                email: req.body.email
            });

            res.redirect('/whitelist');

        }
        else {
            res.status(401);
            res.json({ error: "unauthorized" });
        }
    }
    catch (error) {
        res.status(500);
        res.json({ error: error.message });
    }
}

exports.removeWhitelist = async function (req, res) {
    try {
        if (req.isAuthenticated() && req.user.email == config.admin_user) {

            await model.whitelist.destroy({
                where: {
                    email: req.body.email
                }
            });

            res.redirect('/whitelist');

        }
        else {
            res.status(401);
            res.json({ error: "unauthorized" });
        }
    }
    catch (error) {
        res.status(500);
        res.json({ error: error.message });
    }
}

exports.deleteAccount = async function (req, res) {
    try {
        if (req.isAuthenticated() && req.user.email) {
            if (req.body.token && req.user.email == req.body.token) {
                await sql.query("DELETE FROM users where email = @user", { "@user": req.user.email });
                await sql.query("DELETE FROM userinstruments where User = @user", { "@user": req.user.email });
                await sql.query("DELETE FROM usersnapshots where User = @user", { "@user": req.user.email });
                await sql.query("DELETE FROM portfolios where User = @user", { "@user": req.user.email });
                await sql.query("DELETE FROM trades where User = @user", { "@user": req.user.email });
                await sql.query("DELETE FROM weights where User = @user", { "@user": req.user.email });
                res.redirect("/signup");
            }
            else {
                res.status(500);
                res.json({ error: "unexpected user input" });
            }
        }
        else {
            res.status(401);
            res.json({ error: "unauthorized" });
        }
    }
    catch (error) {
        res.status(500);
        res.json({ error: error.message });
    }
}
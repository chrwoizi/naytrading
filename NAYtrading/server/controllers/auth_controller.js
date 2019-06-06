var exports = module.exports = {}

const config = require('../config/envconfig');
const model = require('../models/index');
const sql = require('../sql/sql');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const instrumentController = require('../controllers/instrument_controller');

var tokensByUser = {};
var tokensByValue = {};

exports.setLastLogin = async function (userName) {
    await sql.query("UPDATE users SET last_login = NOW() WHERE email = @userName", {
        "@userName": userName
    });
};

function getUserView(user) {
    return {
        id: user.id,
        username: user.email,
        isAdmin: user.email == config.admin_user,
        token: user.jwt
    };
}

function createJwt(user) {
    user.jwt = jwt.sign({ email: user.email }, config.jwt_secret);
}

exports.createToken = async function (req, res) {
    try {
        if (req.isAuthenticated()) {
            var time = new Date().getTime();

            var token = tokensByUser[req.user.email];
            if (token) {
                token.validFrom = new Date();
            }
            else {
                token = {
                    user: req.user.email,
                    value: crypto.randomBytes(48).toString('hex'),
                    validFrom: time
                };
                tokensByUser[token.user] = token;
                tokensByValue[token.value] = token;
            }

            for (var user of Object.getOwnPropertyNames(tokensByUser)) {
                var token = tokensByUser[user];
                if (time - token.validFrom > config.max_token_age_milliseconds) {
                    delete tokensByUser[token.user];
                    delete tokensByValue[token.value];
                }
            }

            res.json({ token: token.value });
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

exports.getTokenUser = function (value) {
    var token = tokensByValue[value];
    if (token) {
        return tokensByValue[value].user;
    }
    return null;
}

exports.register = function (req, res, next, passport) {
    passport.authenticate('local-signup', function (err, user, info) {
        if (info && info.hasError) {
            res.json({
                error: info.message
            });
            return;
        }

        req.login(user, {}, async function (err) {
            if (err) {
                res.json({
                    error: err
                });
            }
            else {
                await instrumentController.addAllInstruments(user.email);
                await exports.setLastLogin(user.email);
                createJwt(user);
                res.json(getUserView(user));
            }
        });
    })(req, res, next);
};

exports.login = function (req, res, next, passport) {
    passport.authenticate('local-signin', function (err, user, info) {
        if (info && info.hasError) {
            res.json({
                error: info.message
            });
            return;
        }

        req.login(user, {}, async function (err) {
            if (err) {
                res.json({
                    error: err
                });
            }
            else {
                await instrumentController.addAllInstruments(user.email);
                await exports.setLastLogin(user.email);
                createJwt(user);
                res.json(getUserView(user));
            }
        });
    })(req, res, next);
};

exports.password = function (req, res, next, passport) {
    if (!req.isAuthenticated()) {
        res.status(401);
        res.json({ error: "unauthorized" });
        return;
    }
    passport.authenticate('local-change', function (err, user, info) {
        if (info && info.hasError) {
            res.json({
                error: info.message
            });
            return;
        }

        if (req.isAuthenticated()) {
            res.status(200);
            res.json({});
        }
        else {
            res.status(401);
            res.json({ error: "unauthorized" });
        }
    })(req, res, next);
};

exports.getUser = async function (req, res, next, passport) {
    try {
        passport.authenticate('jwt', async function (err, user, info) {
            try {
                if (user) {
                    createJwt(user);
                    res.json(getUserView(user));
                }
                else {
                    res.json({});
                }
            }
            catch (error) {
                res.status(500);
                res.json({ error: error.message });
            }
        })(req, res);
    }
    catch (error) {
        res.status(500);
        res.json({ error: error.message });
    }
};

exports.getUsers = async function (req, res) {
    try {
        if (req.isAuthenticated() && req.user.email == config.admin_user) {
            var users = await sql.query("SELECT email, last_login FROM users ORDER BY last_login DESC");
            res.json(users.map(user => { return { username: user.email, last_login: user.last_login }; }));
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
};

exports.whitelist = async function (req, res) {
    try {
        if (req.isAuthenticated() && req.user.email == config.admin_user) {
            var whitelists = await model.whitelist.findAll({});
            res.json(whitelists.map(whitelist => { return { username: whitelist.email }; }));
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
};

exports.addWhitelist = async function (req, res) {
    try {
        if (req.isAuthenticated() && req.user.email == config.admin_user) {
            await model.whitelist.create({
                email: req.body.username
            });
            res.status(200);
            res.json({});
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
};

exports.removeWhitelist = async function (req, res) {
    try {
        if (req.isAuthenticated() && req.user.email == config.admin_user) {
            await model.whitelist.destroy({
                where: {
                    email: req.body.username
                }
            });
            res.status(200);
            res.json({});
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
};

exports.deleteAccount = async function (req, res) {
    try {
        if (req.isAuthenticated() && req.user.email) {
            if (req.body.email && req.user.email == req.body.email) {
                await sql.query("DELETE FROM users where email = @user", { "@user": req.user.email });
                await sql.query("DELETE FROM userinstruments where User = @user", { "@user": req.user.email });
                await sql.query("DELETE FROM usersnapshots where User = @user", { "@user": req.user.email });
                await sql.query("DELETE FROM portfolios where User = @user", { "@user": req.user.email });
                await sql.query("DELETE FROM trades where User = @user", { "@user": req.user.email });
                await sql.query("DELETE FROM weights where User = @user", { "@user": req.user.email });
                res.status(200);
                res.json({});
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
};
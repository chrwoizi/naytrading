var exports = module.exports = {}

var config = require('../config/envconfig');
var tanStore = require('../stores/tan_store');
var brokerStore = require('../stores/broker_store');
var Cryptr = require('cryptr');
var mainJob = require('../jobs/main');
var tanStore = require('../stores/tan_store');
var dateFormat = require('dateformat');

function return500(res, e) {
    res.status(500);
    res.json({ error: e.message });
}

exports.getUserStatus = async function (req, res) {

    try {
        if (req.isAuthenticated()) {

            var result = {};

            result.isRunning = mainJob.isRunning;
            result.nextRun = dateFormat(new Date(mainJob.lastRun.getTime() + 1000 * config.job_main_interval_seconds), 'HH:MM:ss');

            if (brokerStore.isPasswordSet(req.user.email)) {
                result.isUnlocked = true;
            }
            else {
                result.isUnlocked = false;
            }

            if (tanStore.isTanListSet(req.user.email)) {
                result.isTanListUnlocked = true;
            }
            else {
                result.isTanListUnlocked = false;
            }

            result.isTanListSet = (await tanStore.getEncryptedTanList(req.user.email)) ? true : false;

            result.rows = config.tan_rows || 1;
            result.columns = config.tan_columns || 1;

            res.status(200);
            res.json(result);
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

exports.setTanList = async function (req, res) {

    try {
        if (req.isAuthenticated()) {

            await tanStore.validateTanList(req.body.tanList);

            if (!(req.body.password) || req.body.password.length < 8) {
                throw new Error("password must be at least 8 characters");
            }

            var cipher = new Cryptr(req.body.password).encrypt(req.body.tanList);
            await tanStore.setEncryptedTanList(req.user.email, cipher);

            await tanStore.setTanList(req.user.email, req.body.tanList);

            res.status(200);
            res.json({ status: "ok" });
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

exports.unlockTanList = async function (req, res) {

    try {
        if (req.isAuthenticated()) {
            await tanStore.setPassword(req.user.email, req.body.password);

            res.status(200);
            res.json({ status: "ok" });
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

exports.unlockBroker = async function (req, res) {

    try {
        if (req.isAuthenticated()) {

            brokerStore.setBrokerUser(req.user.email, req.body.user);
            brokerStore.setPassword(req.user.email, req.body.password);

            res.status(200);
            res.json({ status: "ok" });
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

exports.runJob = async function (req, res) {

    try {
        if (req.isAuthenticated() && req.user.email == config.admin_user) {

            result = {};
            result.started = mainJob.runManually();

            res.status(200);
            res.json(result);
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

exports.cancelJob = async function (req, res) {

    try {
        if (req.isAuthenticated() && req.user.email == config.admin_user) {

            result = {};

            if (mainJob.isRunning) {
                mainJob.cancel = true;
                result.stopped = true;
            }
            else {
                result.stopped = false;
            }

            res.status(200);
            res.json(result);
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

exports.suspendJob = async function (req, res) {

    try {
        if (req.isAuthenticated() && req.user.email == config.admin_user) {

            result = {};

            mainJob.isSuspended = true;
            result.suspended = true;
            
            if (mainJob.isRunning) {
                mainJob.cancel = true;
                result.stopped = true;
            }
            else {
                result.stopped = false;
            }

            res.status(200);
            res.json(result);
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

exports.continueJob = async function (req, res) {

    try {
        if (req.isAuthenticated() && req.user.email == config.admin_user) {

            result = {};

            mainJob.isSuspended = false;
            result.suspended = false;
            
            res.status(200);
            res.json(result);
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

exports.getJobStatus = async function (req, res) {

    try {
        if (req.isAuthenticated() && req.user.email == config.admin_user) {

            result = {};

            result.isRunning = mainJob.isRunning;
            result.isSuspended = mainJob.isSuspended;
            result.log = mainJob.log;
            
            res.status(200);
            res.json(result);
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

exports.reloadConfig = async function (req, res) {

    try {
        if (req.isAuthenticated() && req.user.email == config.admin_user) {

            config.reload();

            res.status(200);
            res.json({});
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

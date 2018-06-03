var exports = module.exports = {}
var fs = require('fs');
var path = require('path');
var process = require('process');
var { spawn } = require('child_process');
var dateFormat = require('dateformat');
var glob = require("glob");
var model = require('../models/index');
var sequelize = require('sequelize');
var sql = require('../sql/sql');
var config = require('../config/envconfig');
var exportUserController = require('../controllers/export_user_controller')


class IntervalCall {
    constructor(seconds) {
        this.seconds = seconds;
        this.last_time = new Date()
    }

    maybeCall(callback) {
        if ((new Date().getTime() - this.last_time.getTime()) / 1000 > this.seconds) {
            var now = new Date();
            var duration = now - this.last_time;
            this.last_time = now;
            callback(duration);
        }
    }
}


async function download(user, fromDate, filePath, cancel) {
    var stream = fs.createWriteStream(filePath + ".incomplete");

    var intervalCall = new IntervalCall(1);
    function reportProgress(progress) {
        intervalCall.maybeCall(() => {
            console.log("" + (100 * progress).toFixed(2) + "% of snapshots exported to " + filePath + ".incomplete");
        });
    }

    var count = await exportUserController.exportUserSnapshotsGeneric(fromDate, user, stream, cancel, reportProgress);

    if (count > 0) {
        return new Promise((resolve, reject) => {
            fs.rename(filePath + ".incomplete", filePath, err => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }
    else {
        await new Promise((resolve, reject) => {
            fs.unlink(filePath + ".incomplete", err => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }
}


function runProcess(executable, cwd, args) {
    return new Promise((resolve, reject) => {
        try {
            var process = spawn(executable, args, { cwd: cwd });

            process.stdout.on('data', (data) => {
                var message = "" + data;
                console.log(message.substr(0, data.length - 2));
            });

            process.stderr.on('data', (data) => {
                var message = "" + data;
                console.log(message.substr(0, data.length - 2));
            });

            process.on('close', (code) => {
                if (code == 0) {
                    resolve();
                }
                else {
                    reject("child process exited with code " + code);
                }
            });

            process.on('error', function (e) {
                reject("child process crashed with " + e);
            });
        }
        catch (e) {
            reject(e);
        }
    });
}


function writeMeta(filePath, now, days, maxMissingDays, testDataRatio, preserveTestIds, augmentFactor) {
    var meta = {
        time: dateFormat(now, "yyyymmddHHMMss"),
        days: days,
        max_missing_days: maxMissingDays,
        test_data_ratio: testDataRatio,
        preserve_test_ids: preserveTestIds ? "True" : "False",
        augment_factor: augmentFactor
    };

    return new Promise((resolve, reject) => {
        try {
            fs.writeFile(filePath, JSON.stringify(meta), function (err) {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        }
        catch (e) {
            reject(e);
        }
    });
}


function getFiles(mask, regex) {
    return new Promise((resolve, reject) => {
        try {
            glob(mask, {}, function (er, files) {
                if (er == null) {
                    var result = []
                    for (var i = 0; i < files.length; ++i) {
                        var file = files[i];
                        var regex = /[^\d]+(\d+).json$/;
                        var match = regex.exec(file);
                        if (match) {
                            result.push(file);
                        }
                    }
                    resolve(result);
                }
                else {
                    reject();
                }
            });
        }
        catch (e) {
            reject(e);
        }
    });
}


function getMaxDate(files) {
    var regex = /[^\d]+(\d+).json$/;

    var maxDate = new Date(1970, 0, 1);
    for (var i = 0; i < files.length; ++i) {
        var file = files[i];
        var match = regex.exec(file);
        if (match) {
            var str = match[1];
            var date = new Date(Date.UTC(str.substr(0, 4), parseInt(str.substr(4, 2)) - 1, str.substr(6, 2),
                str.substr(8, 2), parseInt(str.substr(10, 2)), str.substr(12, 2)));
            if (date.getTime() > maxDate.getTime()) {
                maxDate = date;
            }
        }
    }
    return maxDate;
}


async function processUser(user) {
    var processingDir = path.resolve(config.processing_dir + "/" + user);

    if (!fs.existsSync(processingDir)) {
        fs.mkdirSync(processingDir);
    }

    function cancel() {
        return false;
    }

    var files = await getFiles(processingDir + "/*.json", /[^\d]+(\d+).json$/);
    var fromDate = getMaxDate(files);

    var now = new Date();
    var filePath = processingDir + "/" + dateFormat(now, "yyyymmddHHMMss") + ".json";

    await download(user, fromDate, filePath, cancel);

    files = await getFiles(processingDir + "/*.json", /[^\d]+(\d+).json$/);

    var processorsDir = path.resolve(config.processors_dir);

    var days = config.chart_period_seconds / 60 / 60 / 24;
    var maxMissingDays = config.discard_threshold_missing_workdays;

    for (var i = 0; i < files.length; ++i) {
        if (!fs.existsSync(files[i] + ".csv")) {
            await runProcess(config.python, processorsDir, [
                "flatten.py",
                "--input_path=" + files[i],
                "--output_path=" + files[i] + ".csv",
                "--days=" + days,
                "--max_missing_days=" + maxMissingDays
            ]);
        }
    }

    await runProcess(config.python, processorsDir, [
        "distinct.py",
        "--input_dir=" + processingDir,
        "--input_exp=^\\d+.json.csv$",
        "--output_path=" + processingDir + "/flat.csv"
    ]);

    await runProcess(config.python, processorsDir, [
        "split_by_decision.py",
        "--input_path=" + processingDir + "/flat.csv",
        "--output_path_buy=" + processingDir + "/buy.csv",
        "--output_path_no_buy=" + processingDir + "/no_buy.csv",
        "--output_path_sell=" + processingDir + "/sell.csv",
        "--output_path_no_sell=" + processingDir + "/no_sell.csv"
    ]);

    var testDataRatio = 0.2;
    var preserveTestIds = true;

    await runProcess(config.python, processorsDir, [
        "split_train_test.py",
        "--input_path=" + processingDir + "/buy.csv",
        "--output_path_train=" + processingDir + "/buy_train.csv",
        "--output_path_test=" + processingDir + "/buy_test.csv",
        "--factor=" + testDataRatio,
        "--preserve_test_ids=" + (preserveTestIds ? "True" : "False")
    ]);

    await runProcess(config.python, processorsDir, [
        "split_train_test.py",
        "--input_path=" + processingDir + "/no_buy.csv",
        "--output_path_train=" + processingDir + "/no_buy_train.csv",
        "--output_path_test=" + processingDir + "/no_buy_test.csv",
        "--factor=" + testDataRatio,
        "--preserve_test_ids=" + (preserveTestIds ? "True" : "False")
    ]);

    await runProcess(config.python, processorsDir, [
        "split_train_test.py",
        "--input_path=" + processingDir + "/sell.csv",
        "--output_path_train=" + processingDir + "/sell_train.csv",
        "--output_path_test=" + processingDir + "/sell_test.csv",
        "--factor=" + testDataRatio,
        "--preserve_test_ids=" + (preserveTestIds ? "True" : "False")
    ]);

    await runProcess(config.python, processorsDir, [
        "split_train_test.py",
        "--input_path=" + processingDir + "/no_sell.csv",
        "--output_path_train=" + processingDir + "/no_sell_train.csv",
        "--output_path_test=" + processingDir + "/no_sell_test.csv",
        "--factor=" + testDataRatio,
        "--preserve_test_ids=" + (preserveTestIds ? "True" : "False")
    ]);

    var augmentFactor = 2;

    await runProcess(config.python, processorsDir, [
        "augment.py",
        "--input_path=" + processingDir + "/buy_test.csv",
        "--output_path=" + processingDir + "/buy_test_aug.csv",
        "--factor=" + augmentFactor
    ]);

    await runProcess(config.python, processorsDir, [
        "augment.py",
        "--input_path=" + processingDir + "/no_buy_test.csv",
        "--output_path=" + processingDir + "/no_buy_test_aug.csv",
        "--factor=" + augmentFactor
    ]);

    await runProcess(config.python, processorsDir, [
        "augment.py",
        "--input_path=" + processingDir + "/sell_test.csv",
        "--output_path=" + processingDir + "/sell_test_aug.csv",
        "--factor=" + augmentFactor
    ]);

    await runProcess(config.python, processorsDir, [
        "augment.py",
        "--input_path=" + processingDir + "/no_sell_test.csv",
        "--output_path=" + processingDir + "/no_sell_test_aug.csv",
        "--factor=" + augmentFactor
    ]);

    await runProcess(config.python, processorsDir, [
        "augment.py",
        "--input_path=" + processingDir + "/buy_train.csv",
        "--output_path=" + processingDir + "/buy_train_aug.csv",
        "--factor=" + augmentFactor
    ]);

    await runProcess(config.python, processorsDir, [
        "augment.py",
        "--input_path=" + processingDir + "/no_buy_train.csv",
        "--output_path=" + processingDir + "/no_buy_train_aug.csv",
        "--factor=" + augmentFactor
    ]);

    await runProcess(config.python, processorsDir, [
        "augment.py",
        "--input_path=" + processingDir + "/sell_train.csv",
        "--output_path=" + processingDir + "/sell_train_aug.csv",
        "--factor=" + augmentFactor
    ]);

    await runProcess(config.python, processorsDir, [
        "augment.py",
        "--input_path=" + processingDir + "/no_sell_train.csv",
        "--output_path=" + processingDir + "/no_sell_train_aug.csv",
        "--factor=" + augmentFactor
    ]);

    await runProcess(config.python, processorsDir, [
        "merge.py",
        "--input_path_1=" + processingDir + "/buy_test_aug.csv",
        "--input_path_2=" + processingDir + "/no_buy_test_aug.csv",
        "--output_path=" + processingDir + "/buying_test_aug.csv"
    ]);

    await runProcess(config.python, processorsDir, [
        "merge.py",
        "--input_path_1=" + processingDir + "/sell_test_aug.csv",
        "--input_path_2=" + processingDir + "/no_sell_test_aug.csv",
        "--output_path=" + processingDir + "/selling_test_aug.csv"
    ]);

    await runProcess(config.python, processorsDir, [
        "merge.py",
        "--input_path_1=" + processingDir + "/buy_train_aug.csv",
        "--input_path_2=" + processingDir + "/no_buy_train_aug.csv",
        "--output_path=" + processingDir + "/buying_train_aug.csv"
    ]);

    await runProcess(config.python, processorsDir, [
        "merge.py",
        "--input_path_1=" + processingDir + "/sell_train_aug.csv",
        "--input_path_2=" + processingDir + "/no_sell_train_aug.csv",
        "--output_path=" + processingDir + "/selling_train_aug.csv"
    ]);

    await runProcess(config.python, processorsDir, [
        "normalize.py",
        "--input_path=" + processingDir + "/buying_test_aug.csv",
        "--output_path=" + processingDir + "/buying_test_aug_norm.csv"
    ]);

    await writeMeta(
        processingDir + "/buying_test_aug_norm.meta",
        now,
        days,
        maxMissingDays,
        testDataRatio,
        preserveTestIds,
        augmentFactor);

    await runProcess(config.python, processorsDir, [
        "normalize.py",
        "--input_path=" + processingDir + "/buying_train_aug.csv",
        "--output_path=" + processingDir + "/buying_train_aug_norm.csv"
    ]);

    await writeMeta(
        processingDir + "/buying_train_aug_norm.meta",
        now,
        days,
        maxMissingDays,
        testDataRatio,
        preserveTestIds,
        augmentFactor);

    await runProcess(config.python, processorsDir, [
        "normalize.py",
        "--input_path=" + processingDir + "/selling_train_aug.csv",
        "--output_path=" + processingDir + "/selling_train_aug_norm.csv"
    ]);

    await writeMeta(
        processingDir + "/selling_train_aug_norm.meta",
        now,
        days,
        maxMissingDays,
        testDataRatio,
        preserveTestIds,
        augmentFactor);

    await runProcess(config.python, processorsDir, [
        "normalize.py",
        "--input_path=" + processingDir + "/selling_test_aug.csv",
        "--output_path=" + processingDir + "/selling_test_aug_norm.csv"
    ]);

    await writeMeta(
        processingDir + "/selling_test_aug_norm.meta",
        now,
        days,
        maxMissingDays,
        testDataRatio,
        preserveTestIds,
        augmentFactor);

    console.log("done processing " + user);
}


exports.run = async function () {
    try {
        if (!fs.existsSync(config.processing_dir)) {
            fs.mkdirSync(config.processing_dir);
        }

        var user = "***REMOVED***";
        processUser(user);
    }
    catch (error) {
        console.log("error in process job: " + error);
    }

    setTimeout(exports.run, config.job_process_interval_seconds * 1000);
};
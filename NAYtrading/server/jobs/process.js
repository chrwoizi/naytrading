const fs = require('fs');
const path = require('path');
const process = require('process');
const { spawn } = require('child_process');
const dateFormat = require('dateformat');
const glob = require("glob");
const sql = require('../sql/sql');
const config = require('../config/envconfig');
const exportUserController = require('../controllers/export_user_controller')


class IntervalCall {
    constructor(seconds) {
        this.seconds = seconds;
        this.last_time = new Date()
    }

    maybeCall(callback) {
        if ((new Date().getTime() - this.last_time.getTime()) / 1000 > this.seconds) {
            const now = new Date();
            const duration = now - this.last_time;
            this.last_time = now;
            callback(duration);
        }
    }
}


function logVerbose(message) {
    if (config.env == "development") {
        console.log(message);
    }
}


function logError(message) {
    console.log(message);
}


async function download(user, fromDateUTC, filePath, cancel) {
    const stream = fs.createWriteStream(filePath + ".incomplete");

    const intervalCall = new IntervalCall(1);
    function reportProgress(progress) {
        intervalCall.maybeCall(() => {
            logVerbose("" + (100 * progress).toFixed(2) + "% of snapshots exported to " + filePath + ".incomplete");
        });
    }

    const count = await exportUserController.exportUserSnapshotsGeneric(fromDateUTC, user, stream, cancel, reportProgress);

    if (count > 0) {
        return new Promise((resolve, reject) => {
            try {
                fs.rename(filePath + ".incomplete", filePath, err => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(count);
                    }
                });
            }
            catch (e) {
                reject(e);
            }
        });
    }
    else {
        await removeFile(filePath + ".incomplete");
        return count;
    }
}


function runProcess(executable, cwd, args) {
    return new Promise((resolve, reject) => {
        try {
            const env = Object.create(process.env);
            env.PYTHONIOENCODING = 'utf-8';
            const proc = spawn(executable, args, { cwd: cwd, env: env });

            proc.stdout.setEncoding("utf8");
            proc.stderr.setEncoding("utf8");

            proc.stdout.on('data', (data) => {
                const message = "" + data;
                logVerbose(message.substr(0, data.length - 2));
            });

            proc.stderr.on('data', (data) => {
                const message = "" + data;
                logError(message.substr(0, data.length - 2));
            });

            proc.on('close', (code) => {
                if (code == 0) {
                    resolve();
                }
                else {
                    reject("child process exited with code " + code);
                }
            });

            proc.on('error', function (e) {
                reject("child process crashed with " + e);
            });
        }
        catch (e) {
            reject(e);
        }
    });
}


function writeFile(filePath, content) {
    return new Promise((resolve, reject) => {
        try {
            fs.writeFile(filePath, content, function (err) {
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


function removeFile(filePath) {
    return new Promise((resolve, reject) => {
        try {
            fs.unlink(filePath, err => {
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


async function writeMeta(filePath, now, days, maxMissingDays, testDataRatio, preserveTestIds, augmentFactor, lines) {
    const meta = {
        time: dateFormat(now, "yyyymmddHHMMss"),
        days: days,
        max_missing_days: maxMissingDays,
        test_data_ratio: testDataRatio,
        preserve_test_ids: preserveTestIds ? "True" : "False",
        augment_factor: augmentFactor,
        lines: lines
    };

    await writeFile(filePath, JSON.stringify(meta));
}


function getFiles(mask, regex) {
    return new Promise((resolve, reject) => {
        try {
            glob(mask, {}, function (er, files) {
                if (er == null) {
                    const result = []
                    for (let i = 0; i < files.length; ++i) {
                        const file = files[i];
                        const match = regex.exec(file);
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


function parseDateUTC(str) {
    return new Date(Date.UTC(str.substr(0, 4), parseInt(str.substr(4, 2)) - 1, str.substr(6, 2),
        str.substr(8, 2), parseInt(str.substr(10, 2)), str.substr(12, 2)));
}


function getMaxDate(files) {
    const regex = /[^\d]+(\d+).json(\.csv)?$/;

    let maxDate = "19700101000000";
    for (let i = 0; i < files.length; ++i) {
        const file = files[i];
        const match = regex.exec(file);
        if (match) {
            const date = match[1];
            if (date > maxDate) {
                maxDate = date;
            }
        }
    }
    return maxDate;
}


function sleep(milliseconds) {
    return new Promise((resolve, reject) => {
        try {
            setTimeout(resolve, milliseconds);
        }
        catch (e) {
            reject(e);
        }
    });
}


function isUpToDate(filePath, latestSnapshotDate) {
    if (fs.existsSync(filePath) && fs.existsSync(filePath + ".meta")) {
        const lastMeta = JSON.parse(fs.readFileSync(filePath + ".meta", 'utf8'));
        if (lastMeta.time >= latestSnapshotDate) {
            return true;
        }
    }
    return false;
}


function countLines(filePath) {
    return new Promise((resolve, reject) => {
        try {
            let i;
            let count = 0;
            fs.createReadStream(filePath)
                .on('data', function (chunk) {
                    for (i = 0; i < chunk.length; ++i)
                        if (chunk[i] == 10) count++;
                })
                .on('end', function () {
                    resolve(count - 1);
                });
        }
        catch (e) {
            reject(e);
        }
    });
}


async function processUser(user) {
    const processingDir = path.resolve(config.processing_dir + "/" + user);

    if (!fs.existsSync(processingDir)) {
        fs.mkdirSync(processingDir);
    }
    else {
        const killfile = processingDir + "/kill";
        await writeFile(killfile, "");
        await sleep(10000);
        if (fs.existsSync(killfile)) {
            await removeFile(killfile);
        }

        const incompletes = await getFiles(processingDir + "/*.incomplete", /\.incomplete$/);
        for (let i = 0; i < incompletes.length; ++i) {
            try {
                await removeFile(incompletes[i]);
            }
            catch (e) {
                console.log("Error while deleting " + incompletes[i] + ": " + e.message + "\n" + e.stack);
            }
        }
    }

    function cancel() {
        return false;
    }

    let files = await getFiles(processingDir + "/*.*", /[^\d]+(\d+)\.json(\.csv)?$/);
    const fromDate = getMaxDate(files);

    const now = new Date();
    const filePath = processingDir + "/" + dateFormat(now, "yyyymmddHHMMss") + ".json";

    await download(user, parseDateUTC(fromDate), filePath, cancel);

    files = await getFiles(processingDir + "/*.*", /[^\d]+(\d+)\.json(\.csv)?$/);

    if (files.length == 0) {
        logVerbose("done processing " + user);
        return;
    }

    const latestSnapshotDate = getMaxDate(files);
    if (isUpToDate(processingDir + "/buying_train_norm.csv", latestSnapshotDate)
        && isUpToDate(processingDir + "/buying_test_norm.csv", latestSnapshotDate)
        && isUpToDate(processingDir + "/selling_train_norm.csv", latestSnapshotDate)
        && isUpToDate(processingDir + "/selling_test_norm.csv", latestSnapshotDate)) {
        logVerbose("done processing " + user);
        return;
    }

    const processorsDir = path.resolve(config.processors_dir);

    const days = config.chart_period_seconds / 60 / 60 / 24;
    const maxMissingDays = config.discard_threshold_missing_workdays;
    const testDataRatio = 0.2;
    const preserveTestIds = true;
    const augmentFactor = 4;

    const jsonFiles = files.filter(x => x.endsWith(".json"));
    for (let i = 0; i < jsonFiles.length; ++i) {
        if (!fs.existsSync(jsonFiles[i] + ".csv")) {
            await runProcess(config.python, processorsDir, [
                "flatten.py",
                "--input_path=" + jsonFiles[i],
                "--output_path=" + jsonFiles[i] + ".csv",
                "--days=" + days,
                "--max_missing_days=" + maxMissingDays
            ]);
        }
        if (fs.existsSync(jsonFiles[i] + ".csv")) {
            await removeFile(jsonFiles[i]);
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

    async function processAction(action) {

        async function split(file) {
            const args = [
                "split_train_test.py",
                "--input_path=" + processingDir + "/" + file + ".csv",
                "--output_path_train=" + processingDir + "/" + file + "_train.csv",
                "--output_path_test=" + processingDir + "/" + file + "_test.csv",
                "--factor=" + testDataRatio
            ];
            if (preserveTestIds) {
                args.push("--preserve_test_ids=True");
            }
            await runProcess(config.python, processorsDir, args);
        }

        await Promise.all([split(action), split("no_" + action)]);

        async function processDataset(dataset, should_augment) {

            let input_suffix = "";
            if (should_augment) {
                async function augment(file) {
                    await runProcess(config.python, processorsDir, [
                        "augment.py",
                        "--input_path=" + processingDir + "/" + file + "_" + dataset + ".csv",
                        "--output_path=" + processingDir + "/" + file + "_" + dataset + "_aug.csv",
                        "--factor=" + augmentFactor
                    ]);
                }

                await Promise.all([augment(action), augment("no_" + action)]);

                input_suffix = "_aug";
            }

            await runProcess(config.python, processorsDir, [
                "merge.py",
                "--input_path_1=" + processingDir + "/" + action + "_" + dataset + input_suffix + ".csv",
                "--input_path_2=" + processingDir + "/no_" + action + "_" + dataset + input_suffix + ".csv",
                "--output_path=" + processingDir + "/" + action + "ing_" + dataset + ".csv"
            ]);

            const outputPath = processingDir + "/" + action + "ing_" + dataset + "_norm.csv";
            await runProcess(config.python, processorsDir, [
                "normalize.py",
                "--input_path=" + processingDir + "/" + action + "ing_" + dataset + ".csv",
                "--output_path=" + outputPath
            ]);

            const lines = await countLines(outputPath);

            await writeMeta(
                processingDir + "/" + action + "ing_" + dataset + "_norm.csv.meta",
                now,
                days,
                maxMissingDays,
                testDataRatio,
                preserveTestIds,
                should_augment ? augmentFactor : 1,
                lines);
        }

        await Promise.all([processDataset("train", true), processDataset("test", false)]);
    }

    await Promise.all([processAction("buy"), processAction("sell")]);

    logVerbose("done processing " + user);
}


exports.run = async function () {
    try {
        if (!fs.existsSync(config.processing_dir)) {
            fs.mkdirSync(config.processing_dir);
        }

        const users = await sql.query("SELECT DISTINCT(User) FROM usersnapshots");
        for (let i = 0; i < users.length; ++i) {
            if (!users[i].User.endsWith(".ai")) {
                await processUser(users[i].User);
            }
        }
    }
    catch (error) {
        logError("error in process job: " + error.message + "\n" + error.stack);
    }

    setTimeout(exports.run, config.job_process_interval_seconds * 1000);
};
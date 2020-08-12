const newSnapshotController = require('../controllers/new_snapshot_controller');
const config = require('../config/envconfig');
const settings = require('../config/settings');
const ratesProvider = require('../providers/rates_provider');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const dateFormat = require('dateformat');

function sleep(ms) {
    return new Promise((resolve, reject) => {
        try {
            setTimeout(resolve, ms);
        }
        catch (e) {
            reject(e);
        }
    });
}

async function sendEmail(text) {
    if (config.email_host) {
        const transporter = nodemailer.createTransport({
            host: config.email_host,
            port: Number(config.email_port || "25"),
            secure: config.email_secure === true || config.email_secure === "true",
            auth: {
                user: config.email_user,
                pass: config.email_pass
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        let mailOptions = {
            from: config.email_from,
            to: config.email_to,
            subject: 'NAYtrading alive test',
            text: text,
            html: text
        };

        return new Promise((resolve) => {
            transporter.sendMail(mailOptions, (error, response) => {
                if (error) {
                    if (error.message) {
                        console.log("error in alive: " + error.message + "\n" + error.stack);
                    }
                    else {
                        console.log("error in alive: " + error);
                    }
                }

                console.log(response);
                console.log(error);
                resolve();
            });
        });
    }
}

async function checkRates() {
    const endTime = new Date();
    const endDate = new Date(endTime.getTime());
    endDate.setHours(0, 0, 0, 0);
    const startTime = new Date(endDate.getTime() - config.chart_period_seconds * 1000);

    for (const sourceType of Object.getOwnPropertyNames(config.job_alive_source_ids)) {
        try {

            const sourceId = config.job_alive_source_ids[sourceType];
            if (sourceId) {

                let problem = null;
                async function checkRatesCallback(rates, marketId) {
                    problem = newSnapshotController.checkRates(rates, startTime, endTime, { Strikes: 0 });
                    return problem == null;
                }

                const ratesResponse = await ratesProvider.getRates(sourceType, sourceId, null, startTime, endTime, checkRatesCallback);

                if (!ratesResponse || !ratesResponse.Rates || !(ratesResponse.Rates.length > 0)) {
                    await settings.set("alive_failure_" + sourceType, new Date().toISOString());
                    const text = 'Cannot get rates from ' + sourceType + '. Reason: ' + (problem ? (problem.Reason ? problem.Reason : problem) : 'unknown');
                    console.log(text);
                    await sendEmail(text);
                }
                else {
                    await settings.set("alive_failure_" + sourceType, '');
                }
            }
        }
        catch (error) {
            console.log("error in alive for source type " + sourceType + ": " + error.message + "\n" + error.stack);
        }
    }
}

async function checkProcessing() {
    let processingExists = false;
    let maxTimestamp;
    const timeoutDate = new Date(new Date().getTime() - config.job_alive_processing_timeout_days * 1000 * 60 * 60 * 24);
    const processingDirs = fs.readdirSync(config.processing_dir);
    for (const userDir of processingDirs) {
        const userDirPath = path.join(config.processing_dir, userDir);
        const files = fs.readdirSync(userDirPath);
        for (const file of files) {
            const extension = path.extname(file);
            if (extension.toLowerCase() === '.meta') {
                const lastMeta = JSON.parse(fs.readFileSync(path.join(userDirPath, file), 'utf8'));
                if (!maxTimestamp || lastMeta.time > maxTimestamp) {
                    maxTimestamp = lastMeta.time;
                }
                if (lastMeta.time >= dateFormat(timeoutDate, "yyyymmddHHMMss")) {
                    processingExists = true;
                }
            }
        }
    }
    if (!processingExists) {
        await settings.set("alive_failure_processing", new Date().toISOString());
        const text = 'No processing since ' + maxTimestamp + '. Expected maximum age is ' + config.job_alive_processing_timeout_days + ' days.';
        console.log(text);
        await sendEmail(text);
    }
    else {
        await settings.set("alive_failure_processing", "");
    }
}

exports.run = async function () {
    await sleep(3000 + Math.floor(Math.random() * 7000));

    try {
        await checkRates();
    }
    catch (e) {
        console.log("error in alive checkRates: " + e.message + "\n" + e.stack);
    }

    try {
        await checkProcessing();
    }
    catch (e) {
        console.log("error in alive checkProcessing: " + e.message + "\n" + e.stack);
    }

    setTimeout(exports.run, config.job_alive_interval_seconds * 1000);
};

const model = require('../models/index');
const sql = require('../sql/sql');
const snapshotController = require('../controllers/snapshot_controller');
const newSnapshotController = require('../controllers/new_snapshot_controller');
const config = require('../config/envconfig');
const settings = require('../config/settings');
const ratesProvider = require('../providers/rates_provider');
const nodemailer = require('nodemailer');

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

function sendEmail(sourceType, problem) {
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

        const text = 'Cannot get rates from ' + sourceType + '. Reason: ' + (problem ? (problem.Reason ? problem.Reason : problem) : 'unknown');
        let mailOptions = {
            from: config.email_from,
            to: config.email_to,
            subject: 'NAYtrading alive test',
            text: text,
            html: text
        };

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
        });
    }
}

exports.run = async function () {
    await sleep(3000 + Math.floor(Math.random() * 7000));

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
                    console.log('Cannot get rates from ' + sourceType + '. Reason: ' + (problem ? problem.Reason : 'unknown'));
                    await settings.set("alive_failure_" + sourceType, new Date().toISOString());
                    sendEmail(sourceType, problem);
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

    setTimeout(exports.run, config.job_alive_interval_seconds * 1000);
};
const sql = require('../sql/sql');
const config = require('../config/envconfig');


exports.run = async function () {
    try {

        await sql.query("UPDATE sources AS c SET c.Strikes = c.Strikes - 1, c.LastStrikeTime = NOW() WHERE c.Strikes > 0 AND c.LastStrikeTime <= @lastStrikeTime", {
            "@lastStrikeTime": new Date(new Date().getTime() - config.job_strikes_cooldown_seconds)
        });

    }
    catch (error) {
        console.log("error in strikes job: " + error.message + "\n" + error.stack);
    }

    setTimeout(exports.run, config.job_strikes_interval_seconds * 1000);
};
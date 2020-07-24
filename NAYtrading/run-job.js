require('dotenv').load();
require('sequelize'); // must be loaded before envconfig
const config = require('./server/config/envconfig');
const { exit } = require('process');

if (process.argv.length !== 3) {
    console.log('Usage: node run-job.js <job-name>');
    exit(-1);
}

const job = require('./server/jobs/' + process.argv[2]);

(async () => {
    const models = require("./server/models/index");

    models.sequelize.sync().then(async function () {
        console.log('Database initialized');
        await job.run();
        exit(0);
    }).catch(function (err) {
        console.log(err.message + "\n" + err.stack);
        exit(-1);
    });
})();

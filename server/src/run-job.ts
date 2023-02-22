import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import 'sequelize'; // must be loaded before envconfig
import './config/envconfig';
import { exit } from 'process';
import models from './models/index';

if (process.argv.length !== 3) {
  console.log('Usage: node run-job.js <job-name>');
  exit(-1);
}

// eslint-disable-next-line @typescript-eslint/no-var-requires
const job = require('./jobs/' + process.argv[2]);

(async () => {
  models.sequelize
    .sync()
    .then(async function () {
      console.log('Database initialized');
      await job.run();
      exit(0);
    })
    .catch(function (err) {
      console.log(err.message + '\n' + err.stack);
      exit(-1);
    });
})();

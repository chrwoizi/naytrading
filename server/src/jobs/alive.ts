import { checkRates as _checkRates } from '../controllers/new_snapshot_controller';
import envconfig from '../config/envconfig';
import { set } from '../config/settings';
import { getRates } from '../providers/rates_provider';
import { createTransport } from 'nodemailer';
import { mkdirSync, readdirSync, readFileSync } from 'fs';
import { join, extname } from 'path';
import * as moment from 'moment';

const email_host = envconfig.email_host;
const email_port = envconfig.email_port;
const email_secure = envconfig.email_secure;
const email_user = envconfig.email_user;
const email_pass = envconfig.email_pass;
const email_from = envconfig.email_from;
const email_to = envconfig.email_to;
const chart_period_seconds = envconfig.chart_period_seconds;
const job_alive_source_ids = envconfig.job_alive_source_ids;
const job_alive_processing_timeout_days =
  envconfig.job_alive_processing_timeout_days;
const processing_dir = envconfig.processing_dir;
const job_alive_interval_seconds = envconfig.job_alive_interval_seconds;

function sleep(ms) {
  return new Promise((resolve, reject) => {
    try {
      setTimeout(resolve, ms);
    } catch (e) {
      reject(e);
    }
  });
}

async function sendEmail(text) {
  if (email_host) {
    const transporter = createTransport({
      host: email_host,
      port: Number(email_port || '25'),
      secure: email_secure === true || email_secure === 'true',
      auth: {
        user: email_user,
        pass: email_pass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    const mailOptions = {
      from: email_from,
      to: email_to,
      subject: 'NAYtrading alive test',
      text: text,
      html: text,
    };

    return new Promise((resolve) => {
      transporter.sendMail(mailOptions, (error, response) => {
        if (error) {
          if (error.message) {
            console.log(
              'error in alive: ' + error.message + '\n' + error.stack
            );
          } else {
            console.log('error in alive: ' + error);
          }
        }

        console.log(response);
        console.log(error);
        resolve(undefined);
      });
    });
  }
}

async function checkRates() {
  const endTime = new Date();
  const endDate = new Date(endTime.getTime());
  endDate.setHours(0, 0, 0, 0);
  const startTime = new Date(endDate.getTime() - chart_period_seconds * 1000);

  for (const sourceType of Object.getOwnPropertyNames(job_alive_source_ids)) {
    try {
      const sourceId = job_alive_source_ids[sourceType];
      if (sourceId) {
        let problem: any = null;
        async function checkRatesCallback(rates, marketId) {
          problem = _checkRates(rates, startTime, endTime, { Strikes: 0 });
          return problem == null;
        }

        const ratesResponse = await getRates(
          sourceType,
          sourceId,
          null,
          startTime,
          endTime,
          checkRatesCallback
        );

        if (
          !ratesResponse ||
          !ratesResponse.Rates ||
          !(ratesResponse.Rates.length > 0)
        ) {
          await set('alive_failure_' + sourceType, new Date().toISOString());
          const text =
            'Cannot get rates from ' +
            sourceType +
            '. Reason: ' +
            (problem ? (problem.Reason ? problem.Reason : problem) : 'unknown');
          console.log(text);
          await sendEmail(text);
        } else {
          await set('alive_failure_' + sourceType, '');
        }
      }
    } catch (e) {
      const error = e as Error;
      console.log(
        'error in alive for source type ' +
          sourceType +
          ': ' +
          error.message +
          '\n' +
          error.stack
      );
    }
  }
}

async function checkProcessing() {
  let processingExists = false;
  let maxTimestamp;
  const timeoutDate = new Date(
    new Date().getTime() -
      job_alive_processing_timeout_days * 1000 * 60 * 60 * 24
  );
  mkdirSync(processing_dir, { recursive: true });
  const processingDirs = readdirSync(processing_dir);
  for (const userDir of processingDirs) {
    const userDirPath = join(processing_dir, userDir);
    const files = readdirSync(userDirPath);
    for (const file of files) {
      const extension = extname(file);
      if (extension.toLowerCase() === '.meta') {
        const lastMeta = JSON.parse(
          readFileSync(join(userDirPath, file), 'utf8')
        );
        if (!maxTimestamp || lastMeta.time > maxTimestamp) {
          maxTimestamp = lastMeta.time;
        }
        if (lastMeta.time >= moment(timeoutDate).format('YYYYMMDDHHmmss')) {
          processingExists = true;
        }
      }
    }
  }
  if (!processingExists) {
    await set('alive_failure_processing', new Date().toISOString());
    const text =
      'No processing since ' +
      maxTimestamp +
      '. Expected maximum age is ' +
      job_alive_processing_timeout_days +
      ' days.';
    console.log(text);
    await sendEmail(text);
  } else {
    await set('alive_failure_processing', '');
  }
}

export async function run() {
  await sleep(3000 + Math.floor(Math.random() * 7000));

  try {
    await checkRates();
  } catch (e) {
    const error = e as Error;
    console.log(
      'error in alive checkRates: ' + error.message + '\n' + error.stack
    );
  }

  try {
    await checkProcessing();
  } catch (e) {
    const error = e as Error;
    console.log(
      'error in alive checkProcessing: ' + error.message + '\n' + error.stack
    );
  }

  setTimeout(run, job_alive_interval_seconds * 1000);
}

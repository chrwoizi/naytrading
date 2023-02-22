import * as express from 'express';
import { createServer as createServerHttp } from 'http';
import { existsSync, lstatSync } from 'fs';
import * as passport from 'passport';
import * as session from 'express-session';
import { urlencoded, json } from 'body-parser';
import * as dotenv from 'dotenv';
dotenv.config();

import 'sequelize'; // must be loaded before envconfig
import envconfig from './config/envconfig';
import models from './models/index';

import authRoutes from './routes/auth_routes';
import apiRoutes from './routes/api_routes';
import { customPassport } from './passport/passport';

import { run as alive } from './jobs/alive';
import { run as split } from './jobs/split';
import { run as instruments } from './jobs/instruments';
import { run as cleanup } from './jobs/cleanup';
import { run as preload } from './jobs/preload';
import { run as strikes } from './jobs/strikes';
import { run as portfolios } from './jobs/portfolios';
import { run as process } from './jobs/process';
import { run as sources } from './jobs/sources';
import { run as consolidate } from './jobs/consolidate';
import { join, resolve } from 'path';

(async () => {
  const app = express();

  // BodyParser
  app.use(
    urlencoded({
      extended: true,
    })
  );
  app.use(json());

  // Passport
  app.use(
    session({
      secret: envconfig.jwt_secret,
      resave: false,
      saveUninitialized: false,
    })
  );
  app.use(passport.initialize());

  // static files
  app.use('/.well-known', express.static('./.well-known'));

  // Routes
  authRoutes(app, passport);
  apiRoutes(app, passport);
  app.get('/*', (req, res) => {
    const requestedPath = resolve(join('client', req.path));

    if (existsSync(requestedPath) && !lstatSync(requestedPath).isDirectory()) {
      res.sendFile(requestedPath);
    } else {
      res.sendFile(resolve('client/index.html'));
    }
  });

  // passport strategies
  customPassport(passport, models.user);

  // Database
  models.sequelize
    .sync()
    .then(function () {
      console.log('Database initialized');

      createServerHttp(app).listen(envconfig.port_http, () => {
        console.log('HTTP Server running on port ' + envconfig.port_http);
      });

      if (envconfig.job_consolidate_enabled) {
        setTimeout(function () {
          new Promise(function () {
            consolidate();
          });
        }, 60000);
      }

      if (envconfig.job_instruments_enabled) {
        setTimeout(function () {
          new Promise(function () {
            instruments();
          });
        }, 2000);
      }

      if (envconfig.job_sources_enabled) {
        setTimeout(function () {
          new Promise(function () {
            sources();
          });
        }, 3000);
      }

      if (envconfig.job_cleanup_enabled) {
        setTimeout(function () {
          new Promise(function () {
            cleanup();
          });
        }, 4000);
      }

      if (envconfig.job_split_enabled) {
        setTimeout(function () {
          new Promise(function () {
            split();
          });
        }, 5000);
      }

      if (envconfig.job_strikes_enabled) {
        setTimeout(function () {
          new Promise(function () {
            strikes();
          });
        }, 6000);
      }

      if (envconfig.job_portfolios_enabled) {
        setTimeout(function () {
          new Promise(function () {
            portfolios();
          });
        }, 8000);
      }

      if (envconfig.job_process_enabled) {
        setTimeout(function () {
          new Promise(function () {
            process();
          });
        }, 12000);
      }

      if (envconfig.job_alive_enabled) {
        setTimeout(function () {
          new Promise(function () {
            alive();
          });
        }, 10000);
      }

      if (envconfig.job_preload_enabled) {
        setTimeout(function () {
          new Promise(function () {
            preload();
          });
        }, 14000);
      }
    })
    .catch(function (err) {
      console.log(err.message + '\n' + err.stack);
      console.log('Something went wrong with the Database Update!');
    });
})();

const express = require('express');
const https = require('https');
const http = require('http');
const fs = require('fs');
const app = express();
const passport = require('passport');
const session = require('express-session');
require('express-mysql-session')(session);
const bodyParser = require('body-parser');
require('dotenv').load();

require('sequelize'); // must be loaded before envconfig
const config = require('./server/config/envconfig');

const splitJob = require('./server/jobs/split');
const instrumentsJob = require('./server/jobs/instruments');
const cleanupJob = require('./server/jobs/cleanup');
const preloadJob = require('./server/jobs/preload');
const strikesJob = require('./server/jobs/strikes');
const portfoliosJob = require('./server/jobs/portfolios');
const processJob = require('./server/jobs/process');
const sourcesJob = require('./server/jobs/sources');
const consolidateJob = require('./server/jobs/consolidate');

(async () => {

    // BodyParser
    app.use(bodyParser.urlencoded({
        extended: true
    }));
    app.use(bodyParser.json());

    // Passport
    app.use(passport.initialize());

    // static files
    app.use('/', express.static('./dist', { index: false }));
    app.use('/.well-known', express.static('./.well-known'));

    // Html
    app.engine('html', require('ejs').renderFile);
    app.set('view engine', 'html');
    app.set('views', './dist');

    // Models
    var models = require("./server/models/index");

    // Routes
    require('./server/routes/auth_routes.js')(app, passport);
    require('./server/routes/api_routes.js')(app, passport);
    app.get('/*', (req, res) => {
        res.render('./index.html', { req, res });
    });

    // passport strategies
    require('./server/passport/passport.js')(passport, models.user);

    // Database
    models.sequelize.sync().then(function () {
        console.log('Database initialized');

        http.createServer(app).listen(config.port_http, () => {
            console.log('HTTP Server running on port ' + config.port_http);
        });

        if (config.https_enabled) {
            var httpsOptions = {
                key: fs.readFileSync(config.https_key),
                cert: fs.readFileSync(config.https_cert),
                ca: fs.readFileSync(config.https_ca)
            };

            https.createServer(httpsOptions, app).listen(config.port_https, () => {
                console.log('HTTPS Server running on port ' + config.port_https);
            });
        }

        if (config.job_consolidate_enabled) {
            setTimeout(function () {
                new Promise(function () { consolidateJob.run(); });
            }, 60000);
        }

        if (config.job_instruments_enabled) {
            setTimeout(function () {
                new Promise(function () { instrumentsJob.run(); });
            }, 2000);
        }

        if (config.job_sources_enabled) {
            setTimeout(function () {
                new Promise(function () { sourcesJob.run(); });
            }, 3000);
        }

        if (config.job_cleanup_enabled) {
            setTimeout(function () {
                new Promise(function () { cleanupJob.run(); });
            }, 4000);
        }

        if (config.job_split_enabled) {
            setTimeout(function () {
                new Promise(function () { splitJob.run(); });
            }, 5000);
        }

        if (config.job_strikes_enabled) {
            setTimeout(function () {
                new Promise(function () { strikesJob.run(); });
            }, 6000);
        }

        if (config.job_portfolios_enabled) {
            setTimeout(function () {
                new Promise(function () { portfoliosJob.run(); });
            }, 8000);
        }

        if (config.job_preload_enabled) {
            setTimeout(function () {
                new Promise(function () { preloadJob.run(); });
            }, 10000);
        }

        if (config.job_process_enabled) {
            setTimeout(function () {
                new Promise(function () { processJob.run(); });
            }, 12000);
        }

    }).catch(function (err) {
        console.log(err.message + "\n" + err.stack);
        console.log("Something went wrong with the Database Update!");
    });
})();

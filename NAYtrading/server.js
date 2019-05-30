var express = require('express');
var https = require('https');
var http = require('http');
var fs = require('fs');
var app = express();
var passport = require('passport');
var session = require('express-session');
var MySQLStore = require('express-mysql-session')(session);
var bodyParser = require('body-parser');
var env = require('dotenv').load();
var exphbs = require('express-handlebars');

require('sequelize'); // must be loaded before envconfig
var config = require('./app/config/envconfig');

var splitJob = require('./app/jobs/split');
var instrumentsJob = require('./app/jobs/instruments');
var cleanupJob = require('./app/jobs/cleanup');
var preloadJob = require('./app/jobs/preload');
var strikesJob = require('./app/jobs/strikes');
var portfoliosJob = require('./app/jobs/portfolios');
var processJob = require('./app/jobs/process');
var sourcesJob = require('./app/jobs/sources');
var consolidateJob = require('./app/jobs/consolidate');

var sql = require('./app/sql/sql');

(async () => {

    // For BodyParser
    app.use(bodyParser.urlencoded({
        extended: true
    }));
    app.use(bodyParser.json());


    // For Passport
    await sql.query("CREATE TABLE IF NOT EXISTS `sessions` (\
        `session_id` varchar(128) COLLATE utf8mb4_bin NOT NULL,\
        `expires` int(11) unsigned NOT NULL,\
        `data` text COLLATE utf8mb4_bin,\
        PRIMARY KEY (`session_id`)\
    ) ENGINE=InnoDB");
    var sessionStore = new MySQLStore(config.session);
    app.use(session({
        key: 'session',
        secret: 'naytrading',
        store: sessionStore,
        resave: false,
        saveUninitialized: false
    }));
    app.use(passport.initialize());
    app.use(passport.session());


    // For static files
    app.use('/static', express.static('./static/'));
    app.use('/.well-known', express.static('./static/.well-known'));
    app.use('/angular', express.static('./node_modules/angular/'));
    app.use('/angular-chart.js', express.static('./node_modules/angular-chart.js/dist/'));
    app.use('/angular-resource', express.static('./node_modules/angular-resource/'));
    app.use('/angular-route', express.static('./node_modules/angular-route/'));
    app.use('/angular-spinner', express.static('./node_modules/angular-spinner/dist/'));
    app.use('/bootstrap', express.static('./node_modules/bootstrap/dist/'));
    app.use('/glyphicons-only-bootstrap', express.static('./node_modules/glyphicons-only-bootstrap/'));
    app.use('/startbootstrap-landing-page', express.static('./node_modules/startbootstrap-landing-page/'));
    app.use('/chart.js', express.static('./node_modules/chart.js/dist/'));
    app.use('/jquery', express.static('./node_modules/jquery/dist/'));
    app.use('/ng-infinite-scroll', express.static('./node_modules/ng-infinite-scroll/build/'));


    // For Handlebars
    app.set('views', './views');
    app.engine('hbs', exphbs({
        defaultLayout: 'main',
        extname: '.hbs',
        layoutsDir: './views/layouts'
    }));
    app.set('view engine', '.hbs');


    // Models
    var models = require("./app/models/index");

    // Routes
    var authRoute = require('./app/routes/auth_routes.js')(app, passport);
    var viewsRoute = require('./app/routes/views_routes.js')(app, passport);
    var apiRoute = require('./app/routes/api_routes.js')(app, passport);

    // load passport strategies
    require('./app/passport/passport.js')(passport, models.user);


    // Sync Database
    models.sequelize.sync().then(function () {

        console.log('Database initialized')

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
                new Promise(function (resolve, reject) { consolidateJob.run(); });
            }, 60000);
        }

        if (config.job_instruments_enabled) {
            setTimeout(function () {
                new Promise(function (resolve, reject) { instrumentsJob.run(); });
            }, 2000);
        }

        if (config.job_sources_enabled) {
            setTimeout(function () {
                new Promise(function (resolve, reject) { sourcesJob.run(); });
            }, 3000);
        }

        if (config.job_cleanup_enabled) {
            setTimeout(function () {
                new Promise(function (resolve, reject) { cleanupJob.run(); });
            }, 4000);
        }

        if (config.job_split_enabled) {
            setTimeout(function () {
                new Promise(function (resolve, reject) { splitJob.run(); });
            }, 5000);
        }

        if (config.job_strikes_enabled) {
            setTimeout(function () {
                new Promise(function (resolve, reject) { strikesJob.run(); });
            }, 6000);
        }
    
        if (config.job_portfolios_enabled) {
            setTimeout(function () {
                new Promise(function (resolve, reject) { portfoliosJob.run(); });
            }, 8000);
        }
    
        if (config.job_preload_enabled) {
            setTimeout(function () {
                new Promise(function (resolve, reject) { preloadJob.run(); });
            }, 10000);
        }

        if (config.job_process_enabled) {
            setTimeout(function () {
                new Promise(function (resolve, reject) { processJob.run(); });
            }, 12000);
        }
    
    }).catch(function (err) {

        console.log(err.message + "\n" + err.stack);
        console.log("Something went wrong with the Database Update!");

    });
})();

var express = require('express');
var https = require('https');
var http = require('http');
var fs = require('fs');
var app = express();
var passport = require('passport');
var session = require('cookie-session');
var bodyParser = require('body-parser');
var env = require('dotenv').load();
var exphbs = require('express-handlebars');

var config = require('./app/config/envconfig');

var mainJob = require('./app/jobs/main');

(async () => {

    try {
        // For BodyParser
        app.use(bodyParser.urlencoded({
            extended: true
        }));
        app.use(bodyParser.json());


        // For Passport
        app.use(session({
            key: 'session',
            secret: 'naytrading-trader',
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


        // Routes
        var authRoute = require('./app/routes/auth_routes.js')(app, passport);
        var viewsRoute = require('./app/routes/views_routes.js')(app, passport);
        var apiRoute = require('./app/routes/api_routes.js')(app, passport);

        // load passport strategies
        require('./app/passport/passport.js')(passport);


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
            
        if (config.job_main_enabled) {
            setTimeout(function () {
                new Promise(function (resolve, reject) { mainJob.run(); });
            }, 1000);
        }
    }
    catch (e) {
        console.log(e.message);
        console.log(e.stack);
        console.log(e);
    }
})();
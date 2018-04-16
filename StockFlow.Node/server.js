var express = require('express')
var app = express()
var passport = require('passport')
var session = require('express-session')
var bodyParser = require('body-parser')
var env = require('dotenv').load()
var exphbs = require('express-handlebars')
var cleanupJob = require('./app/jobs/cleanup')


// For BodyParser
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());


// For Passport
app.use(session({
    secret: 'stockflow',
    resave: true,
    saveUninitialized: true
})); // session secret
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions


// For static files
app.use('/static', express.static('./static/'));
app.use('/angular', express.static('./node_modules/angular/'));
app.use('/angular-chart.js', express.static('./node_modules/angular-chart.js/dist/'));
app.use('/angular-resource', express.static('./node_modules/angular-resource/'));
app.use('/angular-route', express.static('./node_modules/angular-route/'));
app.use('/angular-spinner', express.static('./node_modules/angular-spinner/dist/'));
app.use('/bootstrap', express.static('./node_modules/bootstrap/dist/'));
app.use('/glyphicons-only-bootstrap', express.static('./node_modules/glyphicons-only-bootstrap/'));
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


}).catch(function (err) {

    console.log(err, "Something went wrong with the Database Update!")

});


// Start server
app.listen(5000, function (err) {

    if (!err)
        console.log("Site is live");
    else
        console.log(err);

});

setTimeout(function () {
    new Promise(function (resolve, reject) { cleanupJob.run(); });
}, 10000);
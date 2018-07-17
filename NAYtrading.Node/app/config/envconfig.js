var path = require('path');
var moment = require('moment');

var env = process.env.NODE_ENV || 'development';

var default_config = require(__dirname + '/config.default.json')[env];
var config = require(__dirname + '/config.json')[env];

var default_database = require(__dirname + '/database.default.json')[env];
var database = require(__dirname + '/database.json')[env];

function addProperties(from, to) {
    var fromProperties = Object.keys(from);
    var toProperties = Object.keys(to);
    for(var i = 0; i < fromProperties.length; ++i) {
        var property = fromProperties[i];
        if (toProperties.indexOf(property) == -1) {
            to[property] = from[property];
        }
        if(from[property] != null && to[property] != null && typeof(from[property]) === 'object' && typeof(to[property]) === 'object') {
            addProperties(from[property], to[property]);
        }
    }
}

addProperties(default_config, config);
addProperties(default_database, database);

function configureDatabase(config, database) {
    database.user = database.user || database.username;

    database.dialectOptions = {
        decimalNumbers: true,
        useUTC: false,
        dateStrings: true,
        typeCast: function (field, next) {
            if (field.type === 'DATETIME') {
                return field.string()
            }
            return next()
        }
    }

    database.timezone = moment.tz.guess();

    config.database = database;

    addProperties(database, config.session);
}

configureDatabase(config, database);

function resolvePaths(obj) {
    var properties = Object.keys(obj);
    for(var i = 0; i < properties.length; ++i) {
        var property = properties[i];
        var value = obj[property];
        if(typeof(value) === 'string' && (value.startsWith("../") || value.startsWith("./"))) {
            obj[property] = path.resolve(__dirname + "/" + value);
        }
        else if(value != null && typeof(value) === 'object') {
            resolvePaths(value);
        }
    }
}

resolvePaths(config);

config.env = env;

module.exports = config;

function include(config, path) {
    var included = require(path);
    addProperties(included, config);
}

if (config.include) {
    for(var i = 0; i < config.include.length; ++i) {
        include(config, config.include[i]);
    }
}
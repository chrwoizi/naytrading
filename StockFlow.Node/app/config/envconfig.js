var moment = require('moment');

var env = process.env.NODE_ENV || 'development';

var default_config = require(__dirname + '/config.default.json')[env];
var default_database = require(__dirname + '/database.default.json')[env];

var config = require(__dirname + '/config.json')[env];
var database = require(__dirname + '/database.json')[env];

function copyProperties(from, to) {
    var fromProperties = Object.keys(from);
    var toProperties = Object.keys(to);
    for(var i = 0; i < fromProperties.length; ++i) {
        var property = fromProperties[i];
        if (toProperties.indexOf(property) == -1) {
            to[property] = from[property];
        }
        if(from[property] != null && to[property] != null && typeof(from[property]) === 'object' && typeof(to[property]) === 'object') {
            copyProperties(from[property], to[property]);
        }
    }
}

copyProperties(default_config, config);
copyProperties(default_database, database);

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

module.exports = config;
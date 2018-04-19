var moment = require('moment');

var env = process.env.NODE_ENV || 'development';
var config = require(__dirname + '/config.json')[env];

config.database.user = config.database.user || config.database.username;

config.database.dialectOptions = {
    useUTC: false,
    dateStrings: true,
    typeCast: function (field, next) {
        if (field.type === 'DATETIME') {
            return field.string()
        }
        return next()
    }
}

config.database.timezone = moment.tz.guess();

module.exports = config;
var path = require('path');

var env = process.env.NODE_ENV || 'development';

var default_config = require('./config.default.json')[env];
var config = require('./config.json')[env];

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

config.require = function (name) {
    return require(config.naytrading_trader + '/node_modules/' + name);
}

module.exports = config;

function include(config, path) {
    var included = require(path);
    addProperties(included, config);
}

include(config, config.naytrading_trader + "/app/config/envconfig");
if (config.include) {
    for(var i = 0; i < config.include.length; ++i) {
        include(config, config.include[i]);
    }
}
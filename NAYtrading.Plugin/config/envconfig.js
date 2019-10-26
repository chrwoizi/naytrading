const path = require('path');

const env = process.env.NODE_ENV || 'development';

const default_config = require('./config.default.json')[env];
const config = require('./config.json')[env];

function addProperties(from, to) {
    const fromProperties = Object.keys(from);
    const toProperties = Object.keys(to);
    for(let i = 0; i < fromProperties.length; ++i) {
        const property = fromProperties[i];
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
    const properties = Object.keys(obj);
    for(let i = 0; i < properties.length; ++i) {
        const property = properties[i];
        const value = obj[property];
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
    return require(config.naytrading + '/node_modules/' + name);
};

module.exports = config;

function include(config, path) {
    const included = require(path);
    addProperties(included, config);
}

include(config, config.naytrading + "/server/config/envconfig");
if (config.include) {
    for(let i = 0; i < config.include.length; ++i) {
        include(config, config.include[i]);
    }
}
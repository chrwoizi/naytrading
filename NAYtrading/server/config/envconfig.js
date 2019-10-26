require('sequelize'); // must be loaded before envconfig
const path = require('path');
const moment = require('moment');

const env = process.env.NODE_ENV || 'development';

function load() {

    function requireFresh(path) {
        delete require.cache[require.resolve(path)];
        return require(path);
    }

    const default_config = requireFresh(__dirname + '/config.default.json')[env];
    const config = requireFresh(__dirname + '/config.json')[env];

    const default_database = requireFresh(__dirname + '/database.default.json')[env];
    const database = requireFresh(__dirname + '/database.json')[env];

    function addProperties(from, to, overwrite) {
        const fromProperties = Object.keys(from);
        const toProperties = Object.keys(to);
        for (let i = 0; i < fromProperties.length; ++i) {
            const property = fromProperties[i];
            if (from[property] != null && to[property] != null && typeof (from[property]) === 'object' && typeof (to[property]) === 'object') {
                addProperties(from[property], to[property], overwrite);
            }
            else {
                if (overwrite || toProperties.indexOf(property) == -1) {
                    to[property] = from[property];
                }
            }
        }
    }

    addProperties(default_config, config);
    addProperties(default_database, database);

    function configureDatabase(config, database) {
        database.user = database.user || database.username;

        database.dialectOptions = {
            decimalNumbers: true,
            timezone: moment.tz.guess(),
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

        if (config.session) {
            addProperties(database, config.session);
        }
    }

    configureDatabase(config, database);

    function resolvePaths(obj) {
        const properties = Object.keys(obj);
        for (let i = 0; i < properties.length; ++i) {
            const property = properties[i];
            const value = obj[property];
            if (typeof (value) === 'string' && (value.startsWith("../") || value.startsWith("./"))) {
                obj[property] = path.resolve(__dirname + "/" + value);
            }
            else if (value != null && typeof (value) === 'object') {
                resolvePaths(value);
            }
        }
    }

    resolvePaths(config);

    config.env = env;

    function include(config, path) {
        const included = requireFresh(path);
        addProperties(included, config);
    }

    if (config.include) {
        for (let i = 0; i < config.include.length; ++i) {
            include(config, config.include[i]);
        }
    }

    addProperties(config, module.exports, true);
}

module.exports = {};
module.exports.reload = load;
load();
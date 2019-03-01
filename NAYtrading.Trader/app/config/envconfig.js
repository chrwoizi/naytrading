var path = require('path');

var env = process.env.NODE_ENV || 'development';

function load() {

    function requireFresh(path) {
        delete require.cache[require.resolve(path)];
        return require(path);
    }

    var default_config = requireFresh(__dirname + '/config.default.json')[env];
    var config = requireFresh(__dirname + '/config.json')[env];

    function addProperties(from, to, overwrite) {
        var fromProperties = Object.keys(from);
        var toProperties = Object.keys(to);
        for (var i = 0; i < fromProperties.length; ++i) {
            var property = fromProperties[i];
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

    function resolvePaths(obj) {
        var properties = Object.keys(obj);
        for (var i = 0; i < properties.length; ++i) {
            var property = properties[i];
            var value = obj[property];
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
        var included = requireFresh(path);
        addProperties(included, config);
    }

    if (config.include) {
        for (var i = 0; i < config.include.length; ++i) {
            include(config, config.include[i]);
        }
    }

    addProperties(config, module.exports, true);
}

module.exports = {};
module.exports.reload = load;
load();
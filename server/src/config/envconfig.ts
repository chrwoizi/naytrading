import 'sequelize'; // must be loaded before envconfig
import * as path from 'path';

var result: any = {};

const env = process.env.NODE_ENV || 'development';

function load() {
  function requireFresh(filePath) {
    delete require.cache[require.resolve(filePath)];
    return require(filePath);
  }

  const default_config = requireFresh(__dirname + '/config.default.json')[env];
  const config = requireFresh(__dirname + '/config.json')[env];

  const default_database = requireFresh(__dirname + '/database.default.json')[
    env
  ];
  const database = requireFresh(__dirname + '/database.json')[env];

  function addProperties(from, to, overwrite?: boolean) {
    const fromProperties = Object.keys(from);
    const toProperties = Object.keys(to);
    for (let i = 0; i < fromProperties.length; ++i) {
      const property = fromProperties[i];
      if (
        from[property] != null &&
        to[property] != null &&
        typeof from[property] === 'object' &&
        typeof to[property] === 'object'
      ) {
        addProperties(from[property], to[property], overwrite);
      } else {
        if (overwrite || toProperties.indexOf(property) == -1) {
          to[property] = from[property];
        }
      }
    }
  }

  for (const key of Object.getOwnPropertyNames(process.env)) {
    if (key.toLowerCase().startsWith('naytrading_')) {
      const configKey = key.substr('naytrading_'.length).toLowerCase();
      let value: any = process.env[key];
      const originalValue = config[configKey] || default_config[configKey];
      if (typeof originalValue === 'boolean') {
        value = value === 'true';
      }
      if (typeof originalValue === 'number') {
        value = parseFloat(value);
      }
      config[configKey] = value;
    }
  }

  if (process.env.naytrading_instruments_providers) {
    config.instruments_providers = {};
    const providers = process.env.naytrading_instruments_providers.split(';');
    for (const providerStr of providers) {
      const provider = providerStr.split(':');
      config.instruments_providers[provider[0]] = provider[1];
    }
  }

  if (process.env.naytrading_rates_providers) {
    config.rates_providers = {};
    const providers = process.env.naytrading_rates_providers.split(';');
    for (const providerStr of providers) {
      const provider = providerStr.split(':');
      config.rates_providers[provider[0]] = provider[1];
    }
  }

  if (process.env.naytrading_job_split_sources) {
    config.job_split_sources =
      process.env.naytrading_job_split_sources.split(';');
  }

  if (process.env.naytrading_job_alive_source_ids) {
    config.job_alive_source_ids = {};
    const providers = process.env.naytrading_job_alive_source_ids.split(';');
    for (const providerStr of providers) {
      const provider = providerStr.split(':');
      config.job_alive_source_ids[provider[0]] = provider[1];
    }
  }

  database.username =
    process.env.naytrading_database_username || database.username;
  database.password =
    process.env.naytrading_database_password || database.password;
  database.host = process.env.naytrading_database_host || database.host;

  addProperties(default_config, config);
  addProperties(default_database, database);

  function configureDatabase(config, database) {
    database.user = database.user || database.username;

    database.timezone = database.timezone || '+00:00';

    database.dialectOptions = {
      decimalNumbers: true,
      timezone: database.timezone,
      dateStrings: true,
      typeCast: function (field, next) {
        if (field.type === 'DATETIME') {
          return field.string();
        }
        return next();
      },
    };

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
      if (
        typeof value === 'string' &&
        (value.startsWith('../') || value.startsWith('./'))
      ) {
        obj[property] = path.resolve(path.join(__dirname, value));
      } else if (typeof value === 'string' && value.startsWith('__workdir__')) {
        obj[property] = path.resolve(value.replace('__workdir__', '.'));
      } else if (value != null && typeof value === 'object') {
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

  addProperties(config, result, true);
}

result = {};
result.reload = load;
load();

export default result;

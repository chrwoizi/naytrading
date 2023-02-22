const { existsSync } = require("fs");
const path = require("path");

const env = process.env.NODE_ENV || "development";

const default_config = require(__dirname + "/config.default.json")[env];
const config = require(__dirname + "/config.json")[env];

function addProperties(from, to) {
  const fromProperties = Object.keys(from);
  const toProperties = Object.keys(to);
  for (let i = 0; i < fromProperties.length; ++i) {
    const property = fromProperties[i];
    if (toProperties.indexOf(property) == -1) {
      to[property] = from[property];
    }
    if (
      from[property] != null &&
      to[property] != null &&
      typeof from[property] === "object" &&
      typeof to[property] === "object"
    ) {
      addProperties(from[property], to[property]);
    }
  }
}

addProperties(default_config, config);

function resolvePaths(obj) {
  const properties = Object.keys(obj);
  for (let i = 0; i < properties.length; ++i) {
    const property = properties[i];
    const value = obj[property];
    if (
      typeof value === "string" &&
      (value.startsWith("../") || value.startsWith("./"))
    ) {
      obj[property] = path.resolve(path.join(__dirname, value));
    } else if (
      typeof value === "string" &&
      value.indexOf("__workdir__") !== -1
    ) {
      obj[property] = path.resolve(value.replace(/__workdir__/g, "."));
    } else if (value != null && typeof value === "object") {
      resolvePaths(value);
    }
  }
}

resolvePaths(config);

config.env = env;

config.require = function (name) {
  let queryPath = config.naytrading;

  while (queryPath && queryPath.length > 0) {
    const nodeModules = path.join(queryPath, "node_modules");
    if (existsSync(nodeModules)) {
      return require(path.join(nodeModules, name));
    }
    queryPath = path.dirname(queryPath);
  }

  throw new Error("node_modules not found");
};

module.exports = config;

function include(config, path) {
  const included = require(path);
  addProperties(included, config);
}

include(config, __filename);
if (config.include) {
  for (let i = 0; i < config.include.length; ++i) {
    include(config, config.include[i]);
  }
}

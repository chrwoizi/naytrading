import model from '../models/index';
import envconfig from './envconfig';

let values = {};

export function get(key) {
  return values[key];
}

export async function set(key, value) {
  const existing = await model.setting.findOne({
    where: {
      key: key,
    },
  });
  if (existing) {
    await model.setting.update(
      {
        value: value,
      },
      {
        where: {
          key: key,
        },
      }
    );
  } else {
    await model.setting.create({
      key: key,
      value: value,
    });
  }
  values[key] = value;
}

async function update() {
  const items = await model.setting.findAll({});
  values = {};
  for (let i = 0; i < items.length; ++i) {
    values[items[i].key] = items[i].value;
  }
}

async function run() {
  try {
    await update();
  } catch (e) {
    const error = e as Error;
    console.log('error in settings: ' + error.message + '\n' + error.stack);
  }

  setTimeout(run, envconfig.settings_refresh_interval_seconds * 1000);
}

setTimeout(run, 100);

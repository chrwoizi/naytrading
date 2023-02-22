import { Sequelize } from 'sequelize';

import { InstrumentRate } from './instrumentrate';
import { Portfolio } from './portfolio';
import { Snapshot } from './snapshot';
import { Source } from './source';
import { TradeLog } from './tradelog';
import { UserInstrument } from './userinstrument';
import { Weight } from './weight';
import { Instrument } from './instrument';
import { Monitor } from './monitor';
import { Setting } from './setting';
import { SnapshotRate } from './snapshotrate';
import { Trade } from './trade';
import { User } from './user';
import { UserSnapshot } from './usersnapshot';
import { Whitelist } from './whitelist';

import envconfig from '../config/envconfig';
const config = envconfig.database;

let sequelize: Sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(
    process.env[config.use_env_variable] as string,
    config
  );
} else {
  sequelize = new Sequelize(
    config.database,
    config.username,
    config.password,
    config
  );
}

const db = {
  instrumentrate: InstrumentRate,
  portfolio: Portfolio,
  snapshot: Snapshot,
  source: Source,
  tradelog: TradeLog,
  userinstrument: UserInstrument,
  weight: Weight,
  instrument: Instrument,
  monitor: Monitor,
  setting: Setting,
  snapshotrate: SnapshotRate,
  trade: Trade,
  user: User,
  usersnapshot: UserSnapshot,
  whitelist: Whitelist,
  sequelize: sequelize,
  Sequelize: Sequelize,
};

Object.keys(db).forEach((modelName) => {
  if (modelName !== 'sequelize' && modelName !== 'Sequelize') {
    db[modelName] = db[modelName].initSchema(sequelize);
  }
});

Object.keys(db).forEach((modelName) => {
  if (modelName !== 'sequelize' && modelName !== 'Sequelize') {
    db[modelName].initAssociations(db);
  }
});

export default db;

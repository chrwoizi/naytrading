import {
  monitor,
  getStats,
  clearDecisions,
  clearStats,
  reloadConfig,
  getProviders,
  getProcessings,
} from '../controllers/data_controller';
import {
  addDefault,
  addUrl,
  instruments,
  instrument,
  updateInstruments,
  getWeight,
  setWeight,
} from '../controllers/instrument_controller';
import {
  countSnapshots,
  snapshots,
  snapshot,
  setDecision,
  refreshSnapshotRates,
} from '../controllers/snapshot_controller';
import {
  createNewRandomSnapshot,
  createNewRandomOrConfirmSnapshot,
  getOpenSnapshots,
  createNewSnapshotByInstrumentId,
} from '../controllers/new_snapshot_controller';
import { exportLog } from '../controllers/export_controller';
import {
  exportUserTrades,
  exportUserTradelogs,
  downloadBuyingTrain,
  downloadBuyingTest,
  downloadSellingTrain,
  downloadSellingTest,
} from '../controllers/export_user_controller';
import {
  getOpenSuggestions,
  hasNewerSuggestion,
  saveTradeLog,
  getSuggestions,
  getSuggestion,
} from '../controllers/trader_controller';

export default function (app, passport) {
  app.post(
    '/api/instruments/add/default',
    passport.authenticate('jwt', { session: false }),
    addDefault
  );
  app.post(
    '/api/instruments/add/url',
    passport.authenticate('jwt', { session: false }),
    addUrl
  );
  app.get(
    '/api/instruments',
    passport.authenticate('jwt', { session: false }),
    instruments
  );
  app.get(
    '/api/instrument/:id',
    passport.authenticate('jwt', { session: false }),
    instrument
  );
  app.post(
    '/api/instruments/update',
    passport.authenticate('jwt', { session: false }),
    updateInstruments
  );

  app.get(
    '/api/weight/:instrumentId/:type',
    passport.authenticate('jwt', { session: false }),
    getWeight
  );
  app.post(
    '/api/weight/:instrumentId/:type/:weight',
    passport.authenticate('jwt', { session: false }),
    setWeight
  );

  app.get(
    '/api/monitor',
    passport.authenticate('jwt', { session: false }),
    monitor
  );

  app.get(
    '/api/count/snapshots/:fromDate',
    passport.authenticate('jwt', { session: false }),
    countSnapshots
  );

  app.get(
    '/api/snapshots',
    passport.authenticate('jwt', { session: false }),
    snapshots
  );
  app.get(
    '/api/snapshots/:instrument',
    passport.authenticate('jwt', { session: false }),
    snapshots
  );
  app.get(
    '/api/snapshot/:id',
    passport.authenticate('jwt', { session: false }),
    snapshot
  );

  app.get(
    '/api/confirm/:id/:decision/:confirmed',
    passport.authenticate('jwt', { session: false }),
    snapshot
  );

  app.post(
    '/api/decision',
    passport.authenticate('jwt', { session: false }),
    setDecision
  );

  app.get(
    '/api/snapshot/new/random',
    passport.authenticate('jwt', { session: false }),
    createNewRandomSnapshot
  );
  app.get(
    '/api/snapshot/new/random_or_confirm',
    passport.authenticate('jwt', { session: false }),
    createNewRandomOrConfirmSnapshot
  );
  app.get(
    '/api/snapshot/new/open',
    passport.authenticate('jwt', { session: false }),
    getOpenSnapshots
  );
  app.get(
    '/api/snapshot/new/:instrumentId',
    passport.authenticate('jwt', { session: false }),
    createNewSnapshotByInstrumentId
  );

  app.get(
    '/api/stats',
    passport.authenticate('jwt', { session: false }),
    getStats
  );
  app.get(
    '/api/stats/:user',
    passport.authenticate('jwt', { session: false }),
    getStats
  );

  app.post(
    '/api/clear/decisions',
    passport.authenticate('jwt', { session: false }),
    clearDecisions
  );
  app.post(
    '/api/clear/stats',
    passport.authenticate('jwt', { session: false }),
    clearStats
  );

  app.get('/api/export/user/trades/:fromDate', exportUserTrades);
  app.get('/api/export/user/tradelogs/:fromDate', exportUserTradelogs);
  app.get('/api/export/user/train/buying/:time', downloadBuyingTrain);
  app.get('/api/export/user/test/buying/:time', downloadBuyingTest);
  app.get('/api/export/user/train/selling/:time', downloadSellingTrain);
  app.get('/api/export/user/test/selling/:time', downloadSellingTest);
  app.get('/api/export/log', exportLog);

  app.post(
    '/api/snapshot/refresh',
    passport.authenticate('jwt', { session: false }),
    refreshSnapshotRates
  );

  app.get(
    '/api/trader/suggestions',
    passport.authenticate('jwt', { session: false }),
    getOpenSuggestions
  );
  app.get(
    '/api/trader/suggestion/:id/newer',
    passport.authenticate('jwt', { session: false }),
    hasNewerSuggestion
  );
  app.post(
    '/api/trader/log',
    passport.authenticate('jwt', { session: false }),
    saveTradeLog
  );
  app.get(
    '/api/suggestions',
    passport.authenticate('jwt', { session: false }),
    getSuggestions
  );
  app.get(
    '/api/suggestion/:id',
    passport.authenticate('jwt', { session: false }),
    getSuggestion
  );

  app.post(
    '/api/config/reload',
    passport.authenticate('jwt', { session: false }),
    reloadConfig
  );

  app.get(
    '/api/providers',
    passport.authenticate('jwt', { session: false }),
    getProviders
  );
  app.get(
    '/api/processings',
    passport.authenticate('jwt', { session: false }),
    getProcessings
  );
}

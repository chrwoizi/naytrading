const dataController = require('../controllers/data_controller.js');
const instrumentController = require('../controllers/instrument_controller.js');
const snapshotController = require('../controllers/snapshot_controller.js');
const newSnapshotController = require('../controllers/new_snapshot_controller.js');
const exportController = require('../controllers/export_controller.js');
const exportUserController = require('../controllers/export_user_controller.js');
const traderController = require('../controllers/trader_controller.js');

module.exports = function (app, passport) {

    app.post('/api/instruments/add/default', passport.authenticate('jwt', { session: false }), instrumentController.addDefault);
    app.post('/api/instruments/add/url', passport.authenticate('jwt', { session: false }), instrumentController.addUrl);
    app.get('/api/instruments', passport.authenticate('jwt', { session: false }), instrumentController.instruments);
    app.get('/api/instrument/:id', passport.authenticate('jwt', { session: false }), instrumentController.instrument);
    app.post('/api/instruments/update', passport.authenticate('jwt', { session: false }), instrumentController.updateInstruments);

    app.get('/api/weight/:instrumentId/:type', passport.authenticate('jwt', { session: false }), instrumentController.getWeight);
    app.post('/api/weight/:instrumentId/:type/:weight', passport.authenticate('jwt', { session: false }), instrumentController.setWeight);

    app.get('/api/monitor', passport.authenticate('jwt', { session: false }), dataController.monitor);

    app.get('/api/count/snapshots/:fromDate', passport.authenticate('jwt', { session: false }), snapshotController.countSnapshots);

    app.get('/api/snapshots', passport.authenticate('jwt', { session: false }), snapshotController.snapshots);
    app.get('/api/snapshots/:instrument', passport.authenticate('jwt', { session: false }), snapshotController.snapshots);
    app.get('/api/snapshot/:id', passport.authenticate('jwt', { session: false }), snapshotController.snapshot);

    app.get('/api/confirm/:id/:decision/:confirmed', passport.authenticate('jwt', { session: false }), snapshotController.snapshot);

    app.post('/api/decision', passport.authenticate('jwt', { session: false }), snapshotController.setDecision);

    app.get('/api/snapshot/new/random', passport.authenticate('jwt', { session: false }), newSnapshotController.createNewRandomSnapshot);
    app.get('/api/snapshot/new/random_or_confirm', passport.authenticate('jwt', { session: false }), newSnapshotController.createNewRandomOrConfirmSnapshot);
    app.get('/api/snapshot/new/open', passport.authenticate('jwt', { session: false }), newSnapshotController.getOpenSnapshots);
    app.get('/api/snapshot/new/:instrumentId', passport.authenticate('jwt', { session: false }), newSnapshotController.createNewSnapshotByInstrumentId);

    app.get('/api/stats', passport.authenticate('jwt', { session: false }), dataController.getStats);
    app.get('/api/stats/:user', passport.authenticate('jwt', { session: false }), dataController.getStats);

    app.post('/api/clear/decisions', passport.authenticate('jwt', { session: false }), dataController.clearDecisions);
    app.post('/api/clear/stats', passport.authenticate('jwt', { session: false }), dataController.clearStats);

    app.get('/api/export/user/trades/:fromDate', exportUserController.exportUserTrades);
    app.get('/api/export/user/tradelogs/:fromDate', exportUserController.exportUserTradelogs);
    app.get('/api/export/user/train/buying/:time', exportUserController.downloadBuyingTrain);
    app.get('/api/export/user/test/buying/:time', exportUserController.downloadBuyingTest);
    app.get('/api/export/user/train/selling/:time', exportUserController.downloadSellingTrain);
    app.get('/api/export/user/test/selling/:time', exportUserController.downloadSellingTest);
    app.get('/api/export/log', exportController.exportLog);

    app.post('/api/snapshot/refresh', passport.authenticate('jwt', { session: false }), snapshotController.refreshSnapshotRates);

    app.get('/api/trader/suggestions', passport.authenticate('jwt', { session: false }), traderController.getOpenSuggestions);
    app.get('/api/trader/suggestion/:id/newer', passport.authenticate('jwt', { session: false }), traderController.hasNewerSuggestion);
    app.post('/api/trader/log', passport.authenticate('jwt', { session: false }), traderController.saveTradeLog);
    app.get('/api/suggestions', passport.authenticate('jwt', { session: false }), traderController.getSuggestions);
    app.get('/api/suggestion/:id', passport.authenticate('jwt', { session: false }), traderController.getSuggestion);

    app.post('/api/config/reload', passport.authenticate('jwt', { session: false }), dataController.reloadConfig);

    app.get('/api/providers', passport.authenticate('jwt', { session: false }), dataController.getProviders);
    app.get('/api/processings', passport.authenticate('jwt', { session: false }), dataController.getProcessings);

}
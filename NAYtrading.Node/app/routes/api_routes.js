var dataController = require('../controllers/data_controller.js');
var instrumentController = require('../controllers/instrument_controller.js');
var snapshotController = require('../controllers/snapshot_controller.js');
var newSnapshotController = require('../controllers/new_snapshot_controller.js');
var importController = require('../controllers/import_controller.js');
var importUserController = require('../controllers/import_user_controller.js');
var exportController = require('../controllers/export_controller.js');
var exportUserController = require('../controllers/export_user_controller.js');
var traderController = require('../controllers/trader_controller.js');

module.exports = function (app, passport) {

    app.post('/api/instruments/add/default', instrumentController.addDefault);
    app.post('/api/instruments/add/url', instrumentController.addUrl);
    app.get('/api/instruments', instrumentController.instruments);
    app.get('/api/instrument/:id', instrumentController.instrument);
    app.post('/api/instruments/update', instrumentController.updateInstruments);

    app.get('/api/weight/:instrumentId/:type', instrumentController.getWeight);
    app.post('/api/weight/:instrumentId/:type/:weight', instrumentController.setWeight);

    app.get('/api/count/snapshots/:fromDate', snapshotController.countSnapshots);

    app.get('/api/snapshot', snapshotController.snapshots);
    app.get('/api/snapshot/:id', snapshotController.snapshot);

    app.get('/api/confirm/:id/:decision/:confirmed', snapshotController.snapshot);

    app.post('/api/decision', snapshotController.setDecision);

    app.get('/api/snapshot/new/random', newSnapshotController.createNewRandomSnapshot);
    app.get('/api/snapshot/new/random_or_confirm', newSnapshotController.createNewRandomOrConfirmSnapshot);
    app.get('/api/snapshot/new/:instrumentId', newSnapshotController.createNewSnapshotByInstrumentId);

    app.get('/api/stats', dataController.getStats);
    app.get('/api/stats/:user', dataController.getStats);

    app.post('/api/clear/decisions', dataController.clearDecisions);

    app.get('/api/export/instruments/:exportSecret', exportController.exportInstruments);
    app.get('/api/export/user/instruments', exportUserController.exportUserInstruments);
    app.get('/api/export/snapshots/:fromDate/:exportSecret', exportController.exportSnapshots);
    app.get('/api/export/user/snapshots/:fromDate', exportUserController.exportUserSnapshots);
    app.get('/api/export/user/trades/:fromDate', exportUserController.exportUserTrades);
    app.get('/api/export/user/tradelogs/:fromDate', exportUserController.exportUserTradelogs);
    app.get('/api/export/user/train/buying/:time', exportUserController.downloadBuyingTrain);
    app.get('/api/export/user/test/buying/:time', exportUserController.downloadBuyingTest);
    app.get('/api/export/user/train/selling/:time', exportUserController.downloadSellingTrain);
    app.get('/api/export/user/test/selling/:time', exportUserController.downloadSellingTest);
    app.get('/api/export/log', exportController.exportLog);

    app.post('/api/import/instruments', importController.importInstruments);
    app.post('/api/import/user/instruments', importUserController.importUserInstruments);
    app.post('/api/import/snapshots', importController.importSnapshots);
    app.post('/api/import/user/snapshots', importUserController.importUserSnapshots);
    app.post('/api/import/user/tradelogs', importUserController.importTradelogs);

    app.post('/api/snapshot/refresh', snapshotController.refreshSnapshotRates);

    app.get('/api/trader/suggestions', traderController.getOpenSuggestions);
    app.get('/api/trader/suggestion/:id/newer', traderController.hasNewerSuggestion);
    app.post('/api/trader/log', traderController.saveTradeLog);
    app.get('/api/suggestions', traderController.getSuggestions);
    app.get('/api/suggestion/:id', traderController.getSuggestion);
    
    app.post('/api/config/reload', dataController.reloadConfig);

}
var dataController = require('../controllers/data_controller.js');
var instrumentController = require('../controllers/instrument_controller.js');
var snapshotController = require('../controllers/snapshot_controller.js');
var newSnapshotController = require('../controllers/new_snapshot_controller.js');
var importController = require('../controllers/import_controller.js');
var importUserController = require('../controllers/import_user_controller.js');
var exportController = require('../controllers/export_controller.js');
var exportUserController = require('../controllers/export_user_controller.js');

module.exports = function (app, passport) {

    app.post('/api/instruments/add/default', instrumentController.addDefault);

    app.post('/api/instruments/add/url/:url', instrumentController.addUrl);

    app.get('/api/instruments', instrumentController.instruments);

    app.get('/api/instrument/:id', instrumentController.instrument);

    app.post('/api/instruments/update/:importSecret', instrumentController.updateInstruments);

    app.get('/api/weight/:instrumentId/:type', instrumentController.getWeight);

    app.post('/api/weight/:instrumentId/:type/:weight', instrumentController.setWeight);

    app.get('/api/count/snapshots/:fromDate', snapshotController.countSnapshots);

    app.get('/api/snapshot', snapshotController.snapshots);

    app.get('/api/snapshot/:id', snapshotController.snapshot);

    app.get('/api/snapshot/:id/set/:decision', snapshotController.setDecision);

    app.get('/api/snapshot/new/random', newSnapshotController.createNewRandomSnapshot);

    app.get('/api/snapshot/new/:instrumentId', newSnapshotController.createNewSnapshotByInstrumentId);

    app.get('/api/stats', dataController.getStats);

    app.post('/api/clear/decisions', dataController.clearDecisions);

    app.get('/api/export/instruments/:exportSecret', exportController.exportInstruments);

    app.get('/api/export/user/instruments', exportUserController.exportUserInstruments);

    app.get('/api/export/snapshots/:fromDate/:exportSecret', exportController.exportSnapshots);

    app.get('/api/export/user/snapshots/:fromDate', exportUserController.exportUserSnapshots);

    app.get('/api/export/user/trades/:fromDate', exportUserController.exportUserTrades);

    app.get('/api/export/log', exportController.exportLog);

    app.post('/api/import/instruments/:importSecret', importController.importInstruments);

    app.post('/api/import/user/instruments', importUserController.importUserInstruments);

    app.post('/api/import/snapshots/:importSecret', importController.importSnapshots);

    app.post('/api/import/user/snapshots', importUserController.importUserSnapshots);

}
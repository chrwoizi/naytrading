var dataController = require('../controllers/data_controller.js');
var instrumentController = require('../controllers/instrument_controller.js');
var snapshotController = require('../controllers/snapshot_controller.js');
var newSnapshotController = require('../controllers/new_snapshot_controller.js');
var importController = require('../controllers/import_controller.js');
var exportController = require('../controllers/export_controller.js');

module.exports = function (app, passport) {

    app.post('/api/instruments/add/index', instrumentController.addIndex);

    app.post('/api/instruments/add', instrumentController.addUrl);

    app.get('/api/instruments', instrumentController.instruments);

    app.get('/api/instrument/:id', instrumentController.instrument);

    app.post('/api/count/snapshots', snapshotController.countSnapshots);

    app.get('/api/snapshot', snapshotController.snapshots);

    app.get('/api/snapshot/:id', snapshotController.snapshot);

    app.get('/api/snapshot/:id/set/:decision', snapshotController.setDecision);

    app.get('/api/snapshot/new/random', newSnapshotController.createNewRandomSnapshot);

    app.get('/api/snapshot/new/:instrumentId', newSnapshotController.createNewSnapshotByInstrumentId);

    app.get('/api/stats', dataController.getStats);

    app.post('/api/clear/decisions', dataController.clearDecisions);

    app.get('/api/export/instruments/:exportSecret', exportController.exportInstruments);

    app.get('/api/export/user/instruments', exportController.exportUserInstruments);

    app.get('/api/export/snapshots/:fromDate/:exportSecret', exportController.exportSnapshots);

    app.get('/api/export/user/snapshots/:fromDate', exportController.exportUserSnapshots);

    app.get('/api/export/user/trades/:fromDate', exportController.exportUserTrades);

    app.post('/api/import/user/instruments', importController.importUserInstruments);

    app.post('/api/import/user/snapshots', importController.importUserSnapshots);

}
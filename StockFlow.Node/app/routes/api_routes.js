var dataController = require('../controllers/data_controller.js');
var instrumentController = require('../controllers/instrument_controller.js');
var snapshotController = require('../controllers/snapshot_controller.js');
var newSnapshotController = require('../controllers/new_snapshot_controller.js');

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

}
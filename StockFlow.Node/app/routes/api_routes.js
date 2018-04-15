var apiController = require('../controllers/api_controller.js');
var newSnapshotController = require('../controllers/new_snapshot_controller.js');
var dataController = require('../controllers/data_controller.js');

module.exports = function (app, passport) {

    app.get('/api/instruments', apiController.instruments);

    app.get('/api/instrument/:id', apiController.instrument);

    app.get('/api/snapshot', apiController.snapshots);

    app.get('/api/snapshot/:id', apiController.snapshot);

    app.get('/api/snapshot/new/random', newSnapshotController.newSnapshot);

    app.get('/api/snapshot/new/:instrumentId', newSnapshotController.newSnapshotByInstrumentId);

    app.get('/api/stats', dataController.getStats);

}
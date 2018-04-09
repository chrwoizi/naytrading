var apiController = require('../controllers/api_controller.js');

module.exports = function (app, passport) {

    app.get('/api/instruments', apiController.instruments);

    app.get('/api/instrument/:id', apiController.instrument);

    app.get('/api/snapshot', apiController.snapshots);

    app.get('/api/snapshot/:id', apiController.snapshot);

}
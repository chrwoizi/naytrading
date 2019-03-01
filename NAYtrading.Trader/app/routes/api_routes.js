var apiController = require('../controllers/api_controller.js');

module.exports = function (app, passport) {

    app.get('/api/user/status', apiController.getUserStatus);
    app.post('/api/tans/set', apiController.setTanList);
    app.post('/api/tans/unlock', apiController.unlockTanList);
    app.post('/api/broker/unlock', apiController.unlockBroker);
    app.post('/api/job/run', apiController.runJob);
    app.post('/api/job/cancel', apiController.cancelJob);
    app.post('/api/config/reload', apiController.reloadConfig);

}
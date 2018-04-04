var apiController = require('../controllers/api_controller.js');
var model = require('../models/index');

module.exports = function (app, passport) {

    app.get('/instruments', function (req, res, next) {

        if (req.isAuthenticated()) {

            model.instrument.findAll({
                where: {
                    user_id: req.user.id
                }
            })
                .then(instruments => res.json(instruments))
                .catch(error => res.status(500));

        }
        else {
            res.status(403);
        }

    });

}
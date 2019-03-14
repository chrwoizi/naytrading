var viewsController = require('../controllers/views_controller.js');
var config = require('../config/envconfig');

module.exports = function (app, passport) {
    
    app.get('/', viewsController.home);

    app.get('/about', viewsController.about);

    app.get('/faq', viewsController.faq);

    app.get('/manage', isLoggedIn, viewsController.manage);

    app.get('/app', isLoggedIn, viewsController.app);
    
    function isLoggedIn(req, res, next) {

        if (req.isAuthenticated())
            return next();

        res.redirect('/');

    }
    
}
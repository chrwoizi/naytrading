var authController = require('../controllers/auth_controller');

module.exports = function (app, passport) {
    
    app.get('/signin', authController.signin);

    app.post('/signin', function (req, res, next) {
        passport.authenticate('local-signin', function (err, user, info) {
            req.login(user, {}, async function (err) {
                if (err) {
                    if (typeof (info) !== 'undefined') {
                        res.hasError = info.hasError;
                        res.hasMessage = typeof (info.message) !== 'undefined';
                        res.message = info.message;
                    }
                    else {
                        res.hasError = false;
                        res.hasMessage = false;
                    }
                    return authController.signin(req, res);
                }
                else {
                    return res.redirect('/app');
                }
            });
        })(req, res, next);
    });

    app.get('/logout', authController.logout);

}
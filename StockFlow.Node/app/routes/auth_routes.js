var authController = require('../controllers/auth_controller.js');


module.exports = function (app, passport) {
    
    app.get('/signup', authController.signup);

    app.post('/signup', function (req, res, next) {
        passport.authenticate('local-signup', function (err, user, info) {
            req.login(user, {}, function (err) {
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
                    return authController.signup(req, res);
                }
                else {
                    return res.redirect('/app');
                }
            });
        })(req, res, next);
    });

    app.get('/signin', authController.signin);

    app.post('/signin', function (req, res, next) {
        passport.authenticate('local-signin', function (err, user, info) {
            req.login(user, {}, function (err) {
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

    app.get('/password', isLoggedIn, authController.password);

    app.post('/password', function (req, res, next) {
        passport.authenticate('local-change', function (err, user, info) {
            if (typeof (info) !== 'undefined') {
                res.hasError = info.hasError;
                res.hasMessage = typeof (info.message) !== 'undefined';
                res.message = info.message;
            }
            else {
                res.hasError = false;
                res.hasMessage = false;
            }

            if (req.isAuthenticated()) {
                authController.password(req, res);
            }
            else {
                authController.signin(req, res);
            }
        })(req, res, next);
    });

    function isLoggedIn(req, res, next) {

        if (req.isAuthenticated())
            return next();

        res.redirect('/');

    }

}
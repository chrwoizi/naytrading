var authController = require('../controllers/auth_controller');
var instrumentController = require('../controllers/instrument_controller');

module.exports = function (app, passport) {
    
    app.get('/signup', authController.signup);

    app.post('/signup', function (req, res, next) {
        passport.authenticate('local-signup', function (err, user, info) {
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
                    return authController.signup(req, res);
                }
                else {
                    await instrumentController.addAllInstruments(user.email);
                    await authController.setLastLogin(user.email);
                    return res.redirect('/app/#!/snapshot?action=random_or_confirm');
                }
            });
        })(req, res, next);
    });

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
                    await instrumentController.addAllInstruments(user.email);
                    await authController.setLastLogin(user.email);
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
    
    app.get('/whitelist', authController.whitelist);
    app.post('/whitelist/add', authController.addWhitelist);
    app.post('/whitelist/remove', authController.removeWhitelist);
    
    app.post('/deleteme', authController.deleteAccount);

    function isLoggedIn(req, res, next) {

        if (req.isAuthenticated())
            return next();

        res.redirect('/');

    }

}
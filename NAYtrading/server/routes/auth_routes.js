const authController = require('../controllers/auth_controller');

module.exports = function (app, passport) {

    app.get('/api/user', function (req, res, next) {
        authController.getUser(req, res, next, passport);
    });

    app.post('/api/register', function (req, res, next) {
        authController.register(req, res, next, passport);
    });

    app.post('/api/login', function (req, res, next) {
        authController.login(req, res, next, passport);
    });

    app.post('/api/password', passport.authenticate('jwt', { session: false }), function (req, res, next) {
        authController.password(req, res, next, passport);
    });

    app.get('/api/users', passport.authenticate('jwt', { session: false }), authController.getUsers);

    app.get('/api/whitelist', passport.authenticate('jwt', { session: false }), authController.whitelist);
    app.post('/api/whitelist/add', passport.authenticate('jwt', { session: false }), authController.addWhitelist);
    app.post('/api/whitelist/remove', passport.authenticate('jwt', { session: false }), authController.removeWhitelist);

    app.post('/api/deleteme', passport.authenticate('jwt', { session: false }), authController.deleteAccount);

    app.get('/api/token', passport.authenticate('jwt', { session: false }), authController.createToken);
}
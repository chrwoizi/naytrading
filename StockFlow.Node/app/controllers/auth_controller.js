var exports = module.exports = {}

function getDefaultArgs(req) {
    return {
        isAuthenticated: req.isAuthenticated(),
        username: req.isAuthenticated() ? req.user.email : undefined,
        isAi: req.isAuthenticated() ? req.user.email.endsWith('.ai') : false
    }
}

exports.signup = function (req, res) {

    var args = getDefaultArgs(req);
    args.hasError = res.hasError;
    args.hasMessage = res.hasMessage;
    args.message = res.message;
    res.render('signup', args);

}

exports.signin = function (req, res) {

    var args = getDefaultArgs(req);
    args.hasError = res.hasError;
    args.hasMessage = res.hasMessage;
    args.message = res.message;
    res.render('signin', args);

}

exports.password = function (req, res) {

    var args = getDefaultArgs(req);
    args.hasError = res.hasError;
    args.hasMessage = res.hasMessage;
    args.message = res.message;
    res.render('password', args);

}

exports.logout = function (req, res) {

    req.session.destroy(function (err) {

        res.redirect('/');

    });

}
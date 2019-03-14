var exports = module.exports = {}

function getDefaultArgs(req) {
    return {
        isAuthenticated: req.isAuthenticated(),
        username: req.isAuthenticated() ? req.user.email : undefined,
        isAi: req.isAuthenticated() ? req.user.email.endsWith('.ai') : false
    }
}

exports.signin = function (req, res) {

    var args = getDefaultArgs(req);
    args.hasError = res.hasError;
    args.hasMessage = res.hasMessage;
    args.message = res.message;
    res.render('signin', args);

}

exports.logout = function (req, res) {

    req.session.destroy(function (err) {

        res.redirect('/');

    });

}
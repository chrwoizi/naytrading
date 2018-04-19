var exports = module.exports = {}

function get_default_args(req) {
    return {
        isAuthenticated: req.isAuthenticated(),
        username: req.isAuthenticated() ? req.user.email : undefined,
        isAi: req.isAuthenticated() ? req.user.email.endsWith('.ai') : false
    }
}

exports.get_default_args = get_default_args;

exports.home = function (req, res) {

    res.render('about', get_default_args(req));

}

exports.about = function (req, res) {

    res.render('about', get_default_args(req));

}

exports.contact = function (req, res) {

    res.render('contact', get_default_args(req));

}

exports.manage = function (req, res) {

    res.render('manage', get_default_args(req));

}

exports.clear = function (req, res) {

    res.render('clear', get_default_args(req));

}

exports.app = function (req, res) {

    res.render('app', get_default_args(req));

}

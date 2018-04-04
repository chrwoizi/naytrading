var exports = module.exports = {}

function getDefaultArgs(req) {
    return {
        isAuthenticated: req.isAuthenticated(),
        username: req.isAuthenticated() ? req.user.email : undefined,
        isAi: req.isAuthenticated() ? req.user.email.endsWith('.ai') : false
    }
}

exports.home = function (req, res) {

    res.render('home', getDefaultArgs(req));

}

exports.about = function (req, res) {

    res.render('about', getDefaultArgs(req));

}

exports.contact = function (req, res) {

    res.render('contact', getDefaultArgs(req));

}

exports.manage = function (req, res) {

    res.render('manage', getDefaultArgs(req));

}

exports.clear = function (req, res) {

    res.render('clear', getDefaultArgs(req));

}

exports.app = function (req, res) {

    res.render('app', getDefaultArgs(req));

}

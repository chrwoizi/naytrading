var exports = module.exports = {}

function getDefaultArgs(req) {
    return {
        isAuthenticated: req.isAuthenticated(),
        username: req.isAuthenticated() ? req.user.email : undefined,
        isAi: req.isAuthenticated() ? req.user.email.endsWith('.ai') : false
    }
}

exports.instruments = function (req, res) {

    res.render('instruments', getDefaultArgs(req));

}
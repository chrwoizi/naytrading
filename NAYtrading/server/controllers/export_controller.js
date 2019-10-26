const config = require('../config/envconfig');
const authController = require('./auth_controller');

exports.exportLog = async function (req, res) {
    try {
        const tokenUser = authController.getTokenUser(req.query.token);
        if (tokenUser && tokenUser == config.admin_user) {
            res.download(__dirname + '/../../' + config.log_path);
        }
        else {
            res.status(401);
            res.json({ error: "unauthorized" });
        }
    }
    catch (error) {
        try {
            res.status(500);
            res.json({ error: error.message });
        }
        catch (e2) {
            res.write(JSON.stringify({ error: error.message }));
            res.end();
        }
    }
}

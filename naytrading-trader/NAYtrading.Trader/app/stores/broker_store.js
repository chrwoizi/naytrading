var exports = module.exports = {}

var brokerPasswordsByUser = {};
var brokerUsersByUser = {};

exports.getUsers = function() {
    return Object.getOwnPropertyNames(brokerUsersByUser);
};

exports.setPassword = function (userName, password) {
    brokerPasswordsByUser[userName] = password;
};

exports.setBrokerUser = function (userName, brokerUser) {
    brokerUsersByUser[userName] = brokerUser;
};

exports.isPasswordSet = function (userName) {
    var password = brokerPasswordsByUser[userName];
    if (typeof (password) === 'string' && password.length > 0) {
        return true;
    } else {
        return false;
    }
};

exports.isBrokerUserSet = function (userName) {
    var brokerUser = brokerUsersByUser[userName];
    if (typeof (brokerUser) === 'string' && brokerUser.length > 0) {
        return true;
    } else {
        return false;
    }
};

exports.login = async function (callback, userName) {
    var password = brokerPasswordsByUser[userName];
    if (typeof (password) !== 'string' || password.length == 0) {
        throw new Error("broker password is not set for user " + userName);
    }
    
    var brokerUser = brokerUsersByUser[userName];
    if (typeof (brokerUser) !== 'string' || brokerUser.length == 0) {
        throw new Error("broker user is not set for user " + userName);
    }

    return await callback(brokerUser, password);
};

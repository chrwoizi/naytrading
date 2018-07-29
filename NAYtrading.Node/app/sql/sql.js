var exports = module.exports = {}
var mysql = require('mysql');
var moment = require('moment');
var config = require('../config/envconfig');
var dateFormat = require('dateformat');

config.database.connectionLimit = 10;

var pool = mysql.createPool(config.database);

exports.query = async function (sql, args) {

    var regex = /(@\w+)/g;
    var params = [];
    while (matches = regex.exec(sql)) {
        params.push(matches[1]);
    }

    for (var arg in args) {
        if (!arg.startsWith("@")) {
            throw { message: "invalid sql argument " + arg };
        }
    }

    function mapArg(value) {
        if (value && value.getUTCFullYear) {
            return dateFormat(value, 'yyyy-mm-dd HH:MM:ss');
        }
        return value;
    }

    return new Promise(function (resolve, reject) {
        pool.query(
            sql.replace(regex, "?"),
            params.map(x => mapArg(args[x])),
            function (err, rows, fields) {
                if (err) reject(err);
                resolve(rows);
            });
    });
};

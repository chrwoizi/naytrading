var exports = module.exports = {}
var mysql = require('mysql');
var moment = require('moment');
var config = require('../config/envconfig');

config.database.connectionLimit = 10;

var pool = mysql.createPool(config.database);

exports.query = async function (sql, args) {

    var regex = /(@\w+)/g;
    var params = [];
    while (matches = regex.exec(sql)) {
        params.push(matches[1]);
    }
    
    return new Promise(function (resolve, reject) {
        pool.query(
            sql.replace(regex, "?"),
            params.map(x => args[x]),
            function (err, rows, fields) {
                if (err) reject(err);
                resolve(rows);
            });
    });
};

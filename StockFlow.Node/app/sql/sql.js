var exports = module.exports = {}
var mysql = require('mysql');

var env = process.env.NODE_ENV || 'development';
var config = require(__dirname + '/../config/config.json')[env];

var pool = mysql.createPool({
    connectionLimit: 10,
    host: config.host,
    user: config.username,
    password: config.password,
    database: config.database,
    port: config.port
});

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
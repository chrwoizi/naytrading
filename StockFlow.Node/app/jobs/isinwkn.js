var exports = module.exports = {}
var sql = require('../sql/sql');
var fs = require('fs');
var config = require('../config/envconfig');

var isin_sql = "";
try {
    isin_sql = fs.readFileSync(__dirname + '/../sql/isin.sql', 'utf8');
} catch (e) {
    console.log('Error:', e.stack);
}

var wkn_sql = "";
try {
    wkn_sql = fs.readFileSync(__dirname + '/../sql/wkn.sql', 'utf8');
} catch (e) {
    console.log('Error:', e.stack);
}

exports.run = async function () {
    try {

        var ids = await sql.query(isin_sql);
        
        for (var i = 0; i < ids.length; ++i) {
            await sql.query("UPDATE instruments i INNER JOIN instruments g ON g.ID = @fromId SET i.Isin = g.Isin WHERE i.ID = @toId", {
                "@fromId": ids[i].FromId,
                "@toId": ids[i].ToId
            });
            console.log("Updated ISIN of instrument " + ids[i].ToId);
        }

        ids = await sql.query(wkn_sql);
        
        for (var i = 0; i < ids.length; ++i) {
            await sql.query("UPDATE instruments i INNER JOIN instruments g ON g.ID = @fromId SET i.Wkn = g.Wkn WHERE i.ID = @toId", {
                "@fromId": ids[i].FromId,
                "@toId": ids[i].ToId
            });
            console.log("Updated WKN of instrument " + ids[i].ToId);
        }

    }
    catch (error) {
        console.log("error in isin/wkn job: " + error);
    }

    setTimeout(exports.run, config.job_isinwkn_interval_seconds * 1000);
};
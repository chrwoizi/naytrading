var exports = module.exports = {}
var model = require('../models/index');
var sequelize = require('sequelize');
var sql = require('../sql/sql');
var instrumentsProvider = require('../providers/instruments_provider');
var config = require('../config/envconfig');


exports.run = async function () {
    try {

        for (var s = 0; s < instrumentsProvider.sources.length; ++s) {
            var sourceType = instrumentsProvider.sources[s];
            var instruments = await sql.query("SELECT i.ID, i.Isin, i.Wkn FROM instruments AS i \
                WHERE (i.Isin IS NOT NULL OR i.Wkn IS NOT NULL) \
                AND NOT EXISTS (SELECT 1 FROM sources AS s WHERE s.SourceType = @sourceType AND s.Instrument_ID = i.ID) \
                ORDER BY (SELECT MAX(s.Time) FROM snapshots AS s where s.Instrument_ID = i.ID) DESC", {
                    "@sourceType": sourceType
                });

            for (var i = 0; i < instruments.length && i < config.job_sources_batch_size; ++i) {
                var instrument = instruments[i];
                var sourceId = await instrumentsProvider.getInstrumentId(sourceType, instrument.Isin, instrument.Wkn);
                await model.source.create({
                    Instrument_ID: instrument.ID,
                    SourceType: sourceType,
                    SourceId: sourceId || '',
                    Strikes: 0,
                    LastStrikeTime: new Date(),
                    Status: (sourceId && sourceId.length > 0) ? 'ACTIVE' : 'NOTFOUND'
                });
            }
        }
    }
    catch (error) {
        console.log("error in sources job: " + error.message + "\n" + error.stack);
    }

    setTimeout(exports.run, config.job_sources_interval_seconds * 1000);
};
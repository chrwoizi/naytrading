const model = require('../models/index');
const sql = require('../sql/sql');
const instrumentsProvider = require('../providers/instruments_provider');
const config = require('../config/envconfig');


exports.run = async function () {

    for (let s = 0; s < instrumentsProvider.sources.length; ++s) {
        const sourceType = instrumentsProvider.sources[s];
        try {
            const instruments = await sql.query("SELECT i.ID, i.Isin, i.Wkn FROM instruments AS i \
                WHERE (i.Isin IS NOT NULL OR i.Wkn IS NOT NULL) \
                AND NOT EXISTS (SELECT 1 FROM sources AS s WHERE s.SourceType = @sourceType AND s.Instrument_ID = i.ID) \
                ORDER BY (SELECT MAX(s.Time) FROM snapshots AS s where s.Instrument_ID = i.ID) DESC", {
                "@sourceType": sourceType
            });

            for (let i = 0; i < instruments.length && i < config.job_sources_batch_size; ++i) {
                const instrument = instruments[i];
                let sourceId;
                try {
                    sourceId = await instrumentsProvider.getInstrumentId(sourceType, instrument.Isin, instrument.Wkn);
                }
                catch (error) {
                    console.log("Error while adding instrument source: " + error.message + "\n" + error.stack + "\n" + instrument.ID + " " + sourceType);
                }

                const newSource = {
                    Instrument_ID: instrument.ID,
                    SourceType: sourceType,
                    SourceId: sourceId || '',
                    Strikes: 0,
                    LastStrikeTime: new Date(),
                    StrikeReason: '',
                    Status: (sourceId && sourceId.length > 0) ? 'ACTIVE' : 'NOTFOUND'
                };
                await model.source.create(newSource);
            }

            await instrumentsProvider.updateInstruments(sourceType, sql);
        }
        catch (error) {
            console.log("error in sources job for source type " + sourceType + ": " + error.message + "\n" + error.stack);
        }
    }

    setTimeout(exports.run, config.job_sources_interval_seconds * 1000);
};
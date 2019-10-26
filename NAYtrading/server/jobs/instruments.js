const model = require('../models/index');
const instrumentsProvider = require('../providers/instruments_provider');
const config = require('../config/envconfig');
const settings = require('../config/settings');


async function updateGlobalInstruments() {
    const allInstruments = await instrumentsProvider.getAllInstruments(null, config.job_instruments_min_capitalization);

    const knownInstruments = await model.instrument.findAll({ include: [{ model: model.source }] });

    function getKey(source) {
        return source.SourceType + "/" + source.SourceId;
    }

    function containsAny(refList, itemList) {
        for (let i = 0; i < itemList.length; ++i) {
            if (refList.indexOf(itemList[i]) >= 0) {
                return true;
            }
        }
    }

    const knownKeys = knownInstruments.map(i => i.sources.map(getKey)).reduce(function (a, b) { return a.concat(b); });

    const newInstruments = allInstruments.filter(i => !containsAny(knownKeys, i.sources.map(getKey)));

    let totalCount = 0;
    for (let i = 0; i < newInstruments.length; ++i) {
        const instrument = newInstruments[i];
        try {
            await model.instrument.create(instrument, {
                include: [{
                    model: model.source
                }]
            });
            totalCount++;
        }
        catch (error) {
            console.log("Error while adding instrument: " + error.message + "\n" + error.stack + "\n" + JSON.stringify(instrument));
        }
    }

    if (totalCount > 0) {
        console.log("Added " + totalCount + " instruments.");
    }
}

exports.run = async function () {
    try {

        if (settings.get("update_instruments") == "true") {
            await settings.set("update_instruments", "false");
            await updateGlobalInstruments();
        }

    }
    catch (error) {
        console.log("error in instruments job: " + error.message + "\n" + error.stack);
    }

    setTimeout(exports.run, config.job_instruments_interval_seconds * 1000);
};
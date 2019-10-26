const model = require('../models/index');
const config = require('./envconfig');

let values = {};

exports.get = function (key) {
    return values[key];
};

exports.set = async function (key, value) {
    const existing = await model.setting.findOne({
        where: {
            key: key
        }
    });
    if (existing) {
        await model.setting.update(
            {
                value: value
            },
            {
                where: {
                    key: key
                }
            });
    }
    else {
        await model.setting.create({
            key: key,
            value: value
        });
    }
    values[key] = value;
};

async function update() {
    const items = await model.setting.findAll({});
    values = {};
    for (let i = 0; i < items.length; ++i) {
        values[items[i].key] = items[i].value;
    }
}

function run() {
    new Promise(async function () {
        try {
            await update();
        }
        catch (error) {
            console.log("error in settings: " + error.message + "\n" + error.stack);
        }

        setTimeout(run, config.settings_refresh_interval_seconds * 1000);
    });
}

setTimeout(run, 100);
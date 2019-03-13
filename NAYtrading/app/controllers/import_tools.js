var exports = module.exports = {}
var model = require('../models/index');
var sql = require('../sql/sql');
var sequelize = require('sequelize');
var JSONStream = require('JSONStream');
var multiparty = require('multiparty');
var stream = require('stream');
var fs = require('fs');
var config = require('../config/envconfig');


exports.importFromFormSubmit = async function (req, res, getExistingEntities, getEntityKeys, createEntity, updateEntity, destroyEntity, prepareEntity) {
    var filePath = undefined;

    try {
        var form = new multiparty.Form();

        form.parse(req, async (error, fields, files) => {

            if (!(files && files.file && files.file.length == 1 && files.file[0].path && files.file[0].size > 0)) {
                res.status(500);
                res.json({ message: "no file received" });
                return;
            }

            filePath = files.file[0].path;

            var existing = await getExistingEntities();
            var remaining = Object.assign({}, existing);
            var remainingById = {};
            for (var key in remaining) {
                if (remaining.hasOwnProperty(key)) {
                    remainingById[remaining[key].ID] = remaining[key];
                }
            }

            var addedCount = 0;
            var removedCount = 0;
            var errors = [];

            var processor = new stream.Transform({ objectMode: true });
            processor._transform = function (data, encoding, onDone) {
                try {
                    if (prepareEntity) {
                        prepareEntity(data);
                    }
                    var keys = getEntityKeys(data);
                    console.log("importing " + keys.join(", "));
                    var value = null;
                    for (var k = 0; k < keys.length; ++k) {
                        value = existing[keys[k]];
                        if (value) {
                            break;
                        }
                    }
                    if (value) {
                        updateEntity(data, value).then(() => {
                            for (var k = 0; k < keys.length; ++k) {
                                delete remaining[keys[k]];
                            }
                            onDone();
                        });
                    }
                    else {
                        createEntity(data).then(() => {
                            addedCount++;
                            onDone();
                        })
                            .catch(e => {
                                errors.push(e);
                                onDone(e);
                            });
                    }
                }
                catch (e) {
                    errors.push(e);
                    onDone(e);
                }
            };

            fs.createReadStream(filePath)
                .pipe(JSONStream.parse('*'))
                .pipe(processor)
                .on('finish', async () => {
                    try {
                        if (errors.length == 0) {
                            if (fields.delete && fields.delete.length == 1 && fields.delete[0] == "on") {
                                for (var key in remaining) {
                                    var item = remaining[key];
                                    console.log("deleting " + item.ID);
                                    removedCount += await destroyEntity(item);
                                }
                            }
                        }

                        console.log("import complete. added: " + addedCount + ", removed: " + removedCount + ", errors: " + JSON.stringify(errors));
                        res.json({ added: addedCount, removed: removedCount, errors: errors });
                    }
                    catch (e) {
                        res.status(500);
                        res.json(e);
                    }

                    try {
                        fs.unlinkSync(filePath);
                    }
                    catch (e) { }
                })
                .on('error', err => {
                    res.status(500);
                    res.json(err);
                    try {
                        fs.unlinkSync(filePath);
                    }
                    catch (e) { }
                });

        });
    }
    catch (error) {
        res.status(500);
        res.json(error);
        if (filePath) {
            try {
                fs.unlinkSync(filePath);
            }
            catch (e) { }
        }
    }
};

exports.toDictionary = function (existing, getKey) {
    var dict = {};
    for (var i = 0; i < existing.length; ++i) {
        var item = existing[i];
        var key = getKey(item);
        dict[key] = item;
    };
    return dict;
};

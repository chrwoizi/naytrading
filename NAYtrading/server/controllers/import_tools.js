const JSONStream = require('JSONStream');
const multiparty = require('multiparty');
const stream = require('stream');
const fs = require('fs');

exports.importFromFormSubmit = async function (req, res, getExistingEntities, getEntityKeys, createEntity, updateEntity, destroyEntity, prepareEntity) {
    let filePath = undefined;

    try {
        const form = new multiparty.Form();

        form.parse(req, async (error, fields, files) => {

            if (!(files && files.file && files.file.length == 1 && files.file[0].path && files.file[0].size > 0)) {
                res.status(500);
                res.json({ message: "no file received" });
                return;
            }

            filePath = files.file[0].path;

            const existing = await getExistingEntities();
            const remaining = Object.assign({}, existing);
            const remainingById = {};
            for (const key in remaining) {
                if (remaining.hasOwnProperty(key)) {
                    remainingById[remaining[key].ID] = remaining[key];
                }
            }

            let addedCount = 0;
            let removedCount = 0;
            const errors = [];

            const processor = new stream.Transform({ objectMode: true });
            processor._transform = function (data, encoding, onDone) {
                try {
                    if (prepareEntity) {
                        prepareEntity(data);
                    }
                    const keys = getEntityKeys(data);
                    console.log("importing " + keys.join(", "));
                    let value = null;
                    for (let k = 0; k < keys.length; ++k) {
                        value = existing[keys[k]];
                        if (value) {
                            break;
                        }
                    }
                    if (value) {
                        updateEntity(data, value).then(() => {
                            for (let k = 0; k < keys.length; ++k) {
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
                                for (const key in remaining) {
                                    const item = remaining[key];
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
    const dict = {};
    for (let i = 0; i < existing.length; ++i) {
        const item = existing[i];
        const key = getKey(item);
        dict[key] = item;
    }
    return dict;
};

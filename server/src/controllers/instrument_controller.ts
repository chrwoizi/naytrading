import model from '../models/index';
import { Op } from 'sequelize';
import { getInstrumentByUrl } from '../providers/instruments_provider';
import { query } from '../sql/sql';
import { readFileSync } from 'fs';
import envconfig from '../config/envconfig';
import { set } from '../config/settings';

let copy_sql = '';
try {
  copy_sql = readFileSync(__dirname + '/../sql/copy_instruments.sql', 'utf8');
} catch (e) {
  const error = e as Error;
  console.log('Error:', error.stack);
}

function getInstrumentViewModel(instrument) {
  return {
    ID: instrument.ID,
    InstrumentName: instrument.InstrumentName,
    Capitalization:
      instrument.Capitalization > 0
        ? Math.floor(instrument.Capitalization)
        : null,
  };
}

export async function addAllInstruments(userName) {
  const result = await query(copy_sql, {
    '@userName': userName,
  });

  return result.affectedRows;
}

export async function addDefault(req, res) {
  try {
    if (req.isAuthenticated()) {
      const affectedRows = await addAllInstruments(req.user.email);

      res.json({ added: affectedRows });
    } else {
      res.status(401);
      res.json({ error: 'unauthorized' });
    }
  } catch (e) {
    const error = e as Error;
    res.status(500);
    res.json({ error: error.message });
  }
}

export async function addUrl(req, res) {
  try {
    if (req.isAuthenticated() && req.user.email == envconfig.admin_user) {
      if (typeof req.body.url !== 'string') throw new Error('bad request');

      const instrument = await getInstrumentByUrl(null, req.body.url);

      if (instrument && instrument.sources && instrument.sources.length > 0) {
        let knownSource: any = null;
        for (let i = 0; i < instrument.sources.length; ++i) {
          knownSource = await model.source.findOne({
            where: {
              SourceType: instrument.sources[i].SourceType,
              SourceId: instrument.sources[i].SourceId,
            },
          });
          if (knownSource) {
            break;
          }
        }

        if (knownSource) {
          const existing = await model.userinstrument.findOne({
            where: {
              Instrument_ID: knownSource.Instrument_ID,
              User: req.user.email,
            },
          });
          if (existing) {
            res.json({ added: 0 });
          } else {
            await model.userinstrument.create({
              Instrument_ID: knownSource.Instrument_ID,
              User: req.user.email,
            });
            res.json({ added: 1 });
          }
        } else {
          const instrument2 = await model.instrument.create(instrument, {
            include: [
              {
                model: model.source,
              },
            ],
          });
          await model.userinstrument.create({
            Instrument_ID: instrument2.ID,
            User: req.user.email,
          });
          res.json({ added: 1 });
        }
      } else {
        res.json({ added: 0 });
      }
    } else {
      res.status(401);
      res.json({ error: 'unauthorized' });
    }
  } catch (e) {
    const error = e as Error;
    res.status(500);
    res.json({ error: error.message });
  }
}

export async function instruments(req, res) {
  try {
    if (req.isAuthenticated()) {
      const instruments = await query(
        'SELECT i.ID, i.InstrumentName, i.Capitalization FROM instruments AS i INNER JOIN userinstruments AS u ON u.Instrument_ID = i.ID WHERE u.User = @userName AND EXISTS (SELECT 1 FROM sources AS s WHERE s.Instrument_ID = i.ID AND s.Strikes <= @maxStrikes) ORDER BY i.Capitalization DESC',
        {
          '@userName': req.user.email,
          '@maxStrikes': envconfig.max_strikes,
        }
      );

      res.json({ instruments: instruments.map(getInstrumentViewModel) });
    } else {
      res.status(401);
      res.json({ error: 'unauthorized' });
    }
  } catch (e) {
    const error = e as Error;
    res.status(500);
    res.json({ error: error.message });
  }
}

export async function instrument(req, res) {
  try {
    if (req.isAuthenticated()) {
      const id = parseInt(req.params.id);
      if (Number.isNaN(id)) throw new Error('bad request');

      const instrument = await model.instrument.findOne({
        where: {
          ID: id,
        },
      });

      if (instrument) {
        res.json(getInstrumentViewModel(instrument));
      } else {
        res.status(404);
        res.json({ error: 'instrument not found' });
      }
    } else {
      res.status(401);
      res.json({ error: 'unauthorized' });
    }
  } catch (e) {
    const error = e as Error;
    res.status(500);
    res.json({ error: error.message });
  }
}

export async function getWeight(req, res) {
  try {
    if (req.isAuthenticated()) {
      if (typeof req.params.instrumentId !== 'string')
        throw new Error('bad request');
      if (typeof req.params.type !== 'string') throw new Error('bad request');

      const instrument = await model.instrument.findOne({
        where: {
          [Op.or]: [
            { Isin: req.params.instrumentId },
            { Wkn: req.params.instrumentId },
          ],
        },
      });

      if (instrument) {
        const weight = await model.weight.findOne({
          where: {
            User: req.user.email,
            Instrument_ID: instrument.ID,
            Type: req.params.type,
          },
        });

        if (weight) {
          res.json(weight.Weight);
        } else {
          res.json(null);
        }
      } else {
        res.status(404);
        res.json({ error: 'instrument not found' });
      }
    } else {
      res.status(401);
      res.json({ error: 'unauthorized' });
    }
  } catch (e) {
    const error = e as Error;
    res.status(500);
    res.json({ error: error.message });
  }
}

export async function setWeight(req, res) {
  try {
    if (req.isAuthenticated()) {
      if (typeof req.params.instrumentId !== 'string')
        throw new Error('bad request');
      if (typeof req.params.type !== 'string') throw new Error('bad request');

      const weightValue = parseFloat(req.params.weight);
      if (Number.isNaN(weightValue)) throw new Error('bad request');

      const instrument = await model.instrument.findOne({
        where: {
          [Op.or]: [
            { Isin: req.params.instrumentId },
            { Wkn: req.params.instrumentId },
          ],
        },
      });

      if (instrument) {
        const weight = await model.weight.findOne({
          where: {
            User: req.user.email,
            Instrument_ID: instrument.ID,
            Type: req.params.type,
          },
        });

        if (weight) {
          if (weight.Weight != weightValue) {
            await model.weight.update(
              {
                Weight: weightValue,
              },
              {
                where: {
                  User: req.user.email,
                  Instrument_ID: instrument.ID,
                  Type: req.params.type,
                },
              }
            );
          }
        } else {
          await model.weight.create({
            User: req.user.email,
            Instrument_ID: instrument.ID,
            Type: req.params.type,
            Weight: weightValue,
          });
        }

        res.json({});
      } else {
        res.status(404);
        res.json({ error: 'instrument not found' });
      }
    } else {
      res.status(401);
      res.json({ error: 'unauthorized' });
    }
  } catch (e) {
    const error = e as Error;
    res.status(500);
    res.json({ error: error.message });
  }
}

export async function updateInstruments(req, res) {
  try {
    if (req.isAuthenticated() && req.user.email == envconfig.admin_user) {
      await set('update_instruments', 'true');

      res.json({ status: 'ok' });
    } else {
      res.status(401);
      res.json({ error: 'unauthorized' });
    }
  } catch (e) {
    const error = e as Error;
    res.status(500);
    res.json({ error: error.message });
  }
}

export async function setInstrumentRates(instrumentId, rates) {
  let transaction;

  try {
    transaction = await model.sequelize.transaction();

    await model.instrumentrate.destroy({
      where: {
        Instrument_ID: instrumentId,
      },
      transaction: transaction,
    });

    await model.instrumentrate.bulkCreate(
      rates.map(function (r) {
        return {
          Instrument_ID: instrumentId,
          Open: r.Open,
          Close: r.Close,
          High: r.High,
          Low: r.Low,
          Time: r.Time,
        };
      }),
      {
        transaction: transaction,
      }
    );

    await model.instrument.update(
      {
        LastRateDate: rates[rates.length - 1].Time,
        FirstRateDate: rates[0].Time,
        Split: 'FIXED',
        SplitUpdatedAt: new Date(),
      },
      {
        where: {
          ID: instrumentId,
        },
        transaction: transaction,
      }
    );

    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

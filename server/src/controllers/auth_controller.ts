import envconfig from '../config/envconfig';
import model from '../models/index';
import { query } from '../sql/sql';
import { sign } from 'jsonwebtoken';
import { randomBytes } from 'crypto';

import { addAllInstruments } from './instrument_controller';

const tokensByUser = {};
const tokensByValue = {};

function return500(res, e) {
  res.status(500);
  res.json({ error: e.message });
}

export async function setLastLogin(userName) {
  await query('UPDATE users SET last_login = NOW() WHERE email = @userName', {
    '@userName': userName,
  });
}

function getUserView(user) {
  return {
    id: user.id,
    username: user.email,
    isAdmin: user.email == envconfig.admin_user,
    token: user.jwt,
  };
}

function createJwt(user) {
  user.jwt = sign({ email: user.email }, envconfig.jwt_secret);
}

export async function createToken(req, res) {
  try {
    if (req.isAuthenticated()) {
      const time = new Date().getTime();

      let token = tokensByUser[req.user.email];
      if (token) {
        token.validFrom = new Date();
      } else {
        token = {
          user: req.user.email,
          value: randomBytes(48).toString('hex'),
          validFrom: time,
        };
        tokensByUser[token.user] = token;
        tokensByValue[token.value] = token;
      }

      for (const user of Object.getOwnPropertyNames(tokensByUser)) {
        const token = tokensByUser[user];
        if (time - token.validFrom > envconfig.max_token_age_milliseconds) {
          delete tokensByUser[token.user];
          delete tokensByValue[token.value];
        }
      }

      res.json({ token: token.value });
    } else {
      res.status(401);
      res.json({ error: 'unauthorized' });
    }
  } catch (error) {
    return500(res, error);
  }
}

export function getTokenUser(value) {
  const token = tokensByValue[value];
  if (token) {
    return tokensByValue[value].user;
  }
  return null;
}

export function register(req, res, next, passport) {
  passport.authenticate('local-signup', function (err, user, info) {
    if (info && info.hasError) {
      res.json({
        error: info.message,
      });
      return;
    }

    req.login(user, {}, async function (err) {
      if (err) {
        res.json({
          error: err,
        });
      } else {
        await addAllInstruments(user.email);
        await setLastLogin(user.email);
        createJwt(user);
        res.json(getUserView(user));
      }
    });
  })(req, res, next);
}

export function login(req, res, next, passport) {
  passport.authenticate('local-signin', function (err, user, info) {
    if (info && info.hasError) {
      res.json({
        error:
          'Could not verify login details. Please check email and password.',
      });
      return;
    }

    req.login(user, {}, async function (err) {
      if (err) {
        res.json({
          error:
            'Could not verify login details. Please check email and password.',
        });
      } else {
        await addAllInstruments(user.email);
        await setLastLogin(user.email);
        createJwt(user);
        res.json(getUserView(user));
      }
    });
  })(req, res, next);
}

export function password(req, res, next, passport) {
  if (!req.isAuthenticated()) {
    res.status(401);
    res.json({ error: 'unauthorized' });
    return;
  }
  passport.authenticate('local-change', function (err, user, info) {
    if (info && info.hasError) {
      res.json({
        error: info.message,
      });
      return;
    }

    if (req.isAuthenticated()) {
      res.status(200);
      res.json({});
    } else {
      res.status(401);
      res.json({ error: 'unauthorized' });
    }
  })(req, res, next);
}

export async function getUser(req, res, next, passport) {
  try {
    passport.authenticate('jwt', async function (err, user, info) {
      try {
        if (user) {
          createJwt(user);
          res.json(getUserView(user));
        } else {
          res.json({});
        }
      } catch (e) {
        const error = e as Error;
        res.status(500);
        res.json({ error: error.message });
      }
    })(req, res);
  } catch (e) {
    const error = e as Error;
    res.status(500);
    res.json({ error: error.message });
  }
}

export async function getUsers(req, res) {
  try {
    if (req.isAuthenticated() && req.user.email == envconfig.admin_user) {
      const users = await query(
        'SELECT email, last_login FROM users ORDER BY last_login DESC'
      );
      res.json(
        users.map((user) => {
          return { username: user.email, last_login: user.last_login };
        })
      );
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

export async function whitelist(req, res) {
  try {
    if (req.isAuthenticated() && req.user.email == envconfig.admin_user) {
      const whitelists = await model.whitelist.findAll({});
      res.json(
        whitelists.map((whitelist) => {
          return { username: whitelist.email };
        })
      );
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

export async function addWhitelist(req, res) {
  try {
    if (req.isAuthenticated() && req.user.email == envconfig.admin_user) {
      if (typeof req.body.username !== 'string') throw new Error('bad request');

      await model.whitelist.create({
        email: req.body.username,
      });
      res.status(200);
      res.json({});
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

export async function removeWhitelist(req, res) {
  try {
    if (req.isAuthenticated() && req.user.email == envconfig.admin_user) {
      if (typeof req.body.username !== 'string') throw new Error('bad request');

      await model.whitelist.destroy({
        where: {
          email: req.body.username,
        },
      });
      res.status(200);
      res.json({});
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

export async function deleteAccount(req, res) {
  try {
    if (req.isAuthenticated() && req.user.email) {
      if (typeof req.body.email !== 'string') throw new Error('bad request');

      if (req.body.email && req.user.email == req.body.email) {
        await query('DELETE FROM users where email = @user', {
          '@user': req.user.email,
        });
        await query('DELETE FROM userinstruments where User = @user', {
          '@user': req.user.email,
        });
        await query('DELETE FROM usersnapshots where User = @user', {
          '@user': req.user.email,
        });
        await query('DELETE FROM portfolios where User = @user', {
          '@user': req.user.email,
        });
        await query('DELETE FROM trades where User = @user', {
          '@user': req.user.email,
        });
        await query('DELETE FROM weights where User = @user', {
          '@user': req.user.email,
        });
        res.status(200);
        res.json({});
      } else {
        res.status(500);
        res.json({ error: 'unexpected user input' });
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

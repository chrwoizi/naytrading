import {
  getUser,
  register,
  login,
  password,
  getUsers,
  whitelist,
  addWhitelist,
  removeWhitelist,
  deleteAccount,
  createToken,
} from '../controllers/auth_controller';

export default function (app, passport) {
  app.get('/api/user', function (req, res, next) {
    getUser(req, res, next, passport);
  });

  app.post('/api/register', function (req, res, next) {
    register(req, res, next, passport);
  });

  app.post('/api/login', function (req, res, next) {
    login(req, res, next, passport);
  });

  app.post(
    '/api/password',
    passport.authenticate('jwt', { session: false }),
    function (req, res, next) {
      password(req, res, next, passport);
    }
  );

  app.get(
    '/api/users',
    passport.authenticate('jwt', { session: false }),
    getUsers
  );

  app.get(
    '/api/whitelist',
    passport.authenticate('jwt', { session: false }),
    whitelist
  );
  app.post(
    '/api/whitelist/add',
    passport.authenticate('jwt', { session: false }),
    addWhitelist
  );
  app.post(
    '/api/whitelist/remove',
    passport.authenticate('jwt', { session: false }),
    removeWhitelist
  );

  app.post(
    '/api/deleteme',
    passport.authenticate('jwt', { session: false }),
    deleteAccount
  );

  app.get(
    '/api/token',
    passport.authenticate('jwt', { session: false }),
    createToken
  );
}

import envconfig from '../config/envconfig';
import { getTokenUser } from './auth_controller';

export async function exportLog(req, res) {
  try {
    if (typeof req.query.token !== 'string') throw new Error('bad request');

    const tokenUser = getTokenUser(req.query.token);
    if (tokenUser && tokenUser == envconfig.admin_user) {
      res.download(envconfig.log_path);
    } else {
      res.status(401);
      res.json({ error: 'unauthorized' });
    }
  } catch (e) {
    const error = e as Error;
    try {
      res.status(500);
      res.json({ error: error.message });
    } catch (e2) {
      res.write(JSON.stringify({ error: error.message }));
      res.end();
    }
  }
}

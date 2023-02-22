import { query } from '../sql/sql';
import envconfig from '../config/envconfig';

export async function run() {
  try {
    await query(
      'UPDATE sources AS c SET c.Strikes = c.Strikes - 1, c.LastStrikeTime = NOW() WHERE c.Strikes > 0 AND c.LastStrikeTime <= @lastStrikeTime',
      {
        '@lastStrikeTime': new Date(
          new Date().getTime() - envconfig.job_strikes_cooldown_seconds
        ),
      }
    );
  } catch (e) {
    const error = e as Error;
    console.log('error in strikes job: ' + error.message + '\n' + error.stack);
  }

  setTimeout(run, envconfig.job_strikes_interval_seconds * 1000);
}

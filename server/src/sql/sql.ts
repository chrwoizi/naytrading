import { createPool, Pool } from 'mysql';
import 'moment';
import envconfig from '../config/envconfig';
import * as moment from 'moment';

envconfig.database.connectionLimit = 10;

const pool: Pool = createPool(envconfig.database);

export async function query(sql, args?: any): Promise<any[] | any> {
  const regex = /(@\w+)/g;
  const params: any[] = [];
  let matches;
  while ((matches = regex.exec(sql)) != null) {
    params.push(matches[1]);
  }

  if (args) {
    for (const arg in args) {
      if (!arg.startsWith('@')) {
        throw new Error('invalid sql argument ' + arg);
      }
    }
  }

  function mapArg(value) {
    if (value && value.getUTCFullYear) {
      return moment(value).format('YYYY-MM-DD HH:mm:ss');
    }
    return value;
  }

  return new Promise(function (resolve, reject) {
    pool.query(
      sql.replace(regex, '?'),
      params.map((x) => mapArg(args[x])),
      (err, rows, fields) => {
        if (err) reject(err);
        resolve(rows);
      }
    );
  });
}

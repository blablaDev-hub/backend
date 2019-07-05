import mysql from 'mysql';

export default class DB {
  constructor() {
    this.conn = mysql.createPool({
      host: 'localhost',
      user: 'root',
      password: 'root',
      database: 'bbDev',
      connectionLimit: 10
    });
  }

  query(sql, arg) {
    return new Promise((resolve, reject) => {
      this
        .conn
        .query(sql, arg, (err, rows) => {
          if (err)
            return reject(err);
          resolve(rows);
        });
    });
  }

  close() {
    return new Promise((resolve, reject) => {
      this
        .conn
        .end(err => {
          if (err)
            return reject(err);
          resolve();
        });
    });
  }
}

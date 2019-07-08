import mysql from 'mysql';
import dotenv from 'dotenv';

// init .env
dotenv.config();

export default class DB {
  constructor() {
    this.conn = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      database: process.env.DB_NAME,
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

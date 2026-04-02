const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.join(__dirname, 'payflux.db');

const db = new Database(DB_PATH);

// Performance tuning: WAL mode for concurrent reads, foreign keys enforced
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

module.exports = db;

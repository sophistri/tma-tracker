// The archive is one SQLite file. node:sqlite is built into Node (and so into Electron), so there is nothing to install,
// no server to start, and backing up the whole archive means copying a single file.
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const migrations = require('./schema');
const { seedEpisodes } = require('./seed');

let db = null, error = null, file = null, connecting = null;  // standard status state vaariiaaaableees
const cache = new Map();   // sql text -> prepared statement, so the same query isn't compiled again and again

function open(filePath) {
  close();
  file = filePath;
  try {
    if (filePath !== ':memory:') fs.mkdirSync(path.dirname(filePath), { recursive: true });
    db = new DatabaseSync(filePath);
    db.exec('PRAGMA foreign_keys = ON');    // off by default! this is what makes the ON DELETE CASCADE rules in schema.js actually happen
    db.exec('PRAGMA journal_mode = WAL');   // readers never block the writer, and a crash can't leave the file half-written
    db.exec('PRAGMA synchronous = NORMAL');
    migrate();
    seedEpisodes(db);   // first run only: adds the 200 statements
    error = null;
    console.log('Archive database ready:', filePath);
  } catch (err) {
    close();
    error = err.message;
    console.error('Could not open the archive database:', err.message);
  }
}

// run every migration that hasn't run yet
function migrate() {
  const done = db.prepare('PRAGMA user_version').get().user_version;
  for (let i = done; i < migrations.length; i++) {
    transaction(() => {
      db.exec(migrations[i]);
      db.exec(`PRAGMA user_version = ${i + 1}`);
    });
  }
}

function close() {
  cache.clear();
  if (db) { try { db.close(); } catch { /* already closed */ } }
  db = null;
}

const handle = () => {
  if (!db) throw new Error('The archive database is not open');
  return db;
};

const stmt = (sql) => {
  let s = cache.get(sql);
  if (!s) cache.set(sql, (s = handle().prepare(sql)));
  return s;
};

// the three ways the models talk to the database. Values go in as ? placeholders, never glued into the SQL text
const get = (sql, ...params) => stmt(sql).get(...params);   // the first row, or undefined
const all = (sql, ...params) => stmt(sql).all(...params);   // every row
const run = (sql, ...params) => stmt(sql).run(...params);   // for changes: tells you how many rows changed

// Several changes that must all happen or none: an error anywhere undoes the lot
let inTransaction = false;
function transaction(fn) {
  if (inTransaction) return fn();   // already inside one: just join it
  handle().exec('BEGIN IMMEDIATE');
  inTransaction = true;
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  } finally {
    inTransaction = false;
  }
}

module.exports = {
  start: (filePath) => (connecting = Promise.resolve().then(() => open(filePath))),
  retry: () => (connecting = Promise.resolve().then(() => open(file))),
  whenReady: () => connecting,
  status: () => ({ connected: !!db, error, file }),
  close,
  get, all, run, transaction,
};

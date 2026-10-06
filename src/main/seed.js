// The Magnus Archives has 200 statements (episodes): 5 seasons of 40.
// This puts all of them into the archive the first time the app runs, so you only have to fill in the details.
const { randomUUID } = require('node:crypto');
const episodes = require('./data/episodes.json');   // [{ number, season, title, giver, subject, caseNo, ... }, ...] (no transcripts: see import.js)

// `db` is the open SQLite database (db.js hands it over)
function seedEpisodes(db) {
  // a note saying "already done", so a statement you delete later is never put back on the next launch
  if (db.prepare("SELECT 1 AS done FROM meta WHERE key = 'seeded-episodes-v1'").get()) return;

  // INSERT OR IGNORE: a statement whose number is already taken is left exactly as it is
  const add = db.prepare(`
    INSERT OR IGNORE INTO episodes (id, number, season, title, giver, subject, case_no, statement_date, actual_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);

  // all 200 in one transaction: either they all go in, or none do (and it simply tries again next launch)
  db.exec('BEGIN IMMEDIATE');
  try {
    for (const e of episodes) {
      add.run(randomUUID(), e.number, e.season, e.title, e.giver ?? '', e.subject ?? '', e.caseNo ?? '', e.statementDate ?? '', e.actualDate ?? '');
    }
    db.prepare("INSERT INTO meta (key, value) VALUES ('seeded-episodes-v1', ?)").run(new Date().toISOString());
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  console.log(`Seeded ${episodes.length} statements`);
}

module.exports = { seedEpisodes };

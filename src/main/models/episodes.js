const db = require('../db');
const { newId, checkId, groupBy } = require('./ids');
const { cleanFears } = require('./clean');

// text fields the page can send, and the longest each is allowed to be
const TEXT = { title: 120, giver: 120, subject: 200, caseNo: 40, statementDate: 60, actualDate: 60 };

// the list leaves out `text` (it's big); the search still looks inside it
const LIST_COLUMNS = 'e.id, e.number, e.season, e.title, e.giver, e.subject, e.case_no, e.statement_date, e.actual_date';

// a database row -> the shape the page has always received, with _id as a plain string
const shape = (r, fears) => ({
  _id: r.id, number: r.number, season: r.season, title: r.title, giver: r.giver, subject: r.subject,
  caseNo: r.case_no, statementDate: r.statement_date, actualDate: r.actual_date,
  ...('text' in r ? { text: r.text } : {}),
  fears: fears.get(r.id) || [],
});

const fearsByEpisode = () => groupBy(db.all('SELECT episode_id, fear FROM episode_fears ORDER BY fear'), 'episode_id', 'fear');
const order = 'ORDER BY e.number IS NULL, e.number, e.title';   // numbered ones first, in order; the rest by title

function list(q) {
  q = String(q || '').trim();
  let rows;
  if (!q) {
    rows = db.all(`SELECT ${LIST_COLUMNS} FROM episodes e ${order}`);
  } else if (q.length >= 3) {
    // escape characters that are special in a regex, so typing "(" can't break a search
    // (for the full-text index the equivalent is quoting: any 3 letters in a row match, in any field, and quoting the text makes it a plain phrase)
    const phrase = '"' + q.replace(/"/g, '""') + '"';
    rows = db.all(
      `SELECT ${LIST_COLUMNS} FROM episodes_fts JOIN episodes e ON e.rowid = episodes_fts.rowid WHERE episodes_fts MATCH ? ${order}`,
      phrase
    );
  } else {
    // one or two letters are too short for the index, so look the slow way (there are only a couple of hundred rows)
    const like = '%' + q.replace(/[\\%_]/g, '\\$&') + '%';
    rows = db.all(
      `SELECT ${LIST_COLUMNS} FROM episodes e
       WHERE e.title LIKE ?1 ESCAPE '\\' OR e.giver LIKE ?1 ESCAPE '\\' OR e.subject LIKE ?1 ESCAPE '\\' OR e.case_no LIKE ?1 ESCAPE '\\'
          OR e.statement_date LIKE ?1 ESCAPE '\\' OR e.actual_date LIKE ?1 ESCAPE '\\' OR e.text LIKE ?1 ESCAPE '\\' ${order}`,
      like
    );
  }
  const fears = fearsByEpisode();
  return rows.map((r) => shape(r, fears));
}

function get(id) {
  const r = db.get('SELECT e.*, e.id AS id FROM episodes e WHERE e.id = ?', checkId(id));
  if (!r) throw new Error('Statement not found');
  const fears = groupBy(db.all('SELECT episode_id, fear FROM episode_fears WHERE episode_id = ? ORDER BY fear', id), 'episode_id', 'fear');
  return shape(r, fears);
}

// numbers are whole numbers or nothing at all
const whole = (v, label) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) throw new Error(`${label} must be a whole number`);
  return n;
};

function save(ep) {
  const title = String(ep.title || '').trim();
  if (!title) throw new Error('A statement needs a title');
  const d = { title: title.slice(0, TEXT.title) };
  for (const k of Object.keys(TEXT)) if (k !== 'title') d[k] = String(ep[k] ?? '').trim().slice(0, TEXT[k]);
  const number = whole(ep.number, 'The number'), season = whole(ep.season, 'The season');
  const text = String(ep.text ?? '');
  const fears = cleanFears(ep.fears);

  try {
    return db.transaction(() => {
      let id = ep._id;
      if (id) {
        const found = db.run(
          `UPDATE episodes SET number = ?, season = ?, title = ?, giver = ?, subject = ?, case_no = ?, statement_date = ?, actual_date = ?, text = ? WHERE id = ?`,
          number, season, d.title, d.giver, d.subject, d.caseNo, d.statementDate, d.actualDate, text, checkId(id)
        );
        if (!found.changes) throw new Error('Statement not found');
      } else {
        id = newId();
        db.run(
          `INSERT INTO episodes (id, number, season, title, giver, subject, case_no, statement_date, actual_date, text) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          id, number, season, d.title, d.giver, d.subject, d.caseNo, d.statementDate, d.actualDate, text
        );
      }
      db.run('DELETE FROM episode_fears WHERE episode_id = ?', id);
      fears.forEach((f) => db.run('INSERT OR IGNORE INTO episode_fears (episode_id, fear) VALUES (?, ?)', id, f));
      return id;
    });
  } catch (err) {
    if (String(err.message).includes('UNIQUE constraint failed: episodes.number')) throw new Error(`Another statement already has the number ${number}`);
    throw err;
  }
}


function remove(id) {
  db.run('DELETE FROM episodes WHERE id = ?', checkId(id));
  // no entity should still point at a deleted statement (the database removes those tags itself: ON DELETE CASCADE)
  return true;
}

module.exports = { list, get, save, remove };

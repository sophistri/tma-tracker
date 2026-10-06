const db = require('../db');
const { newId, checkId, pick, groupBy } = require('./ids');
const { cleanFears, cleanTags } = require('./clean');


// reference-number prefix per type; the keys are also the list of valid types
const PREFIX = {
  person: 'PER', 
  place: 'PLA', 
  fear: 'FEA', 
  entity: 'ENT', 
  object: 'OBJ',
  group: 'GRP', 
  event: 'EVT', 
  lore: 'LOR', 
  notes: 'NOT',
};

const FIELDS = ['type', 'name', 'summary', 'notes', 'f'];

// PER-0001, PER-0002, ... a counter document per prefix, incremented atomically
// (now a counter row per prefix: one statement does the "+1" and hands the new number back, so two entries can never get the same one)
function nextRef(type) {
  const p = PREFIX[type];
  const row = db.get(
    'INSERT INTO counters (prefix, n) VALUES (?, 1) ON CONFLICT (prefix) DO UPDATE SET n = n + 1 RETURNING n',
    p
  );
  return `${p}-${String(row.n).padStart(4, '0')}`;
}

// the extra fields are kept as JSON text; make sure what comes back is always a plain object of short strings
const readFields = (json) => { try { return JSON.parse(json) || {}; } catch { return {}; } };
const cleanFields = (f) => Object.fromEntries(
  Object.entries(f && typeof f === 'object' ? f : {}).slice(0, 20).map(([k, v]) => [String(k).slice(0, 40), String(v ?? '').slice(0, 120)])
);

// replace the whole list of values for one entry (e.g. its fears) with a new one
function setList(table, column, id, values) {
  db.run(`DELETE FROM ${table} WHERE entity_id = ?`, id);   // table and column names are fixed in the code below, never user input
  values.forEach((v) => db.run(`INSERT OR IGNORE INTO ${table} (entity_id, ${column}) VALUES (?, ?)`, id, v));
}

// rows -> the same shape the page has always received, with _id as a plain string
function all() {
  const fears = groupBy(db.all('SELECT entity_id, fear FROM entity_fears ORDER BY fear'), 'entity_id', 'fear');
  const tags = groupBy(db.all('SELECT entity_id, tag FROM entity_tags ORDER BY tag'), 'entity_id', 'tag');
  const apps = groupBy(db.all('SELECT entity_id, episode_id FROM appearances'), 'entity_id', 'episode_id');
  return db.all('SELECT * FROM entities ORDER BY name COLLATE NOCASE').map((r) => ({
    _id: r.id, ref: r.ref, type: r.type, name: r.name, summary: r.summary, notes: r.notes,
    f: readFields(r.fields),
    fears: fears.get(r.id) || [], tags: tags.get(r.id) || [], appearances: apps.get(r.id) || [],
    createdAt: r.created_at, updatedAt: r.updated_at,
  }));
}

function save(e) {
  if (!PREFIX[e.type]) throw new Error('Unknown type: ' + e.type);
  const name = String(e.name || '').trim();
  if (!name) throw new Error('An entry needs a name');
  const data = {
    ...pick(e, FIELDS),
    name: name.slice(0, 60),
    summary: String(e.summary ?? '').trim().slice(0, 120),
    notes: String(e.notes ?? ''),
    f: JSON.stringify(cleanFields(e.f)),
  };
  const fears = cleanFears(e.fears), tags = cleanTags(e.tags), now = new Date().toISOString();

  // the entry and its lists change together or not at all
  return db.transaction(() => {
    if (e._id) {
      checkId(e._id);
      const found = db.run(
        'UPDATE entities SET type = ?, name = ?, summary = ?, notes = ?, fields = ?, updated_at = ? WHERE id = ?',
        data.type, data.name, data.summary, data.notes, data.f, now, e._id
      );
      if (!found.changes) throw new Error('Entry not found');
      setList('entity_fears', 'fear', e._id, fears);
      setList('entity_tags', 'tag', e._id, tags);
      return e._id;
    }
    const id = newId();
    db.run(
      'INSERT INTO entities (id, ref, type, name, summary, notes, fields, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, nextRef(data.type), data.type, data.name, data.summary, data.notes, data.f, now, now
    );
    setList('entity_fears', 'fear', id, fears);
    setList('entity_tags', 'tag', id, tags);
    return id;
  });
}

function remove(id) {
  db.run('DELETE FROM entities WHERE id = ?', checkId(id));
  // no dangling links (the database drops them itself: its tags, fears, appearances and links all cascade)
  return true;
}

// add or remove one statement id in an entity's appearances list
function tag(entityId, episodeId, on) {
  checkId(entityId); checkId(episodeId);
  if (!db.get('SELECT 1 AS ok FROM entities WHERE id = ?', entityId)) throw new Error('Entry not found');
  if (!db.get('SELECT 1 AS ok FROM episodes WHERE id = ?', episodeId)) throw new Error('Statement not found');
  if (on) db.run('INSERT OR IGNORE INTO appearances (entity_id, episode_id) VALUES (?, ?)', entityId, episodeId);   // tagging twice does nothing
  else db.run('DELETE FROM appearances WHERE entity_id = ? AND episode_id = ?', entityId, episodeId);
  return true;
}

// used when a statement is deleted: remove its id from every entity
// (the appearances table cascades, so deleting a statement removes its tags automatically)

module.exports = { all, save, remove, tag };

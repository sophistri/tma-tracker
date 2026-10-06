const db = require('../db');
const { newId, checkId, pick } = require('./ids');

const FIELDS = ['a', 'b', 'kind', 'note', 'mutual'];   // mutual = a two-way link ("friend of" reads the same from both ends)

const all = () => db.all('SELECT * FROM relationships').map((r) => ({
  _id: r.id, a: r.a, b: r.b, kind: r.kind, note: r.note, mutual: r.mutual === 1,
}));


// if id alr exists, then update. otherwise create a new rec
function save(l) {
  const data = pick(l, FIELDS);
  checkId(data.a); checkId(data.b); // throws if either id is malformed
  if (data.a === data.b) throw new Error("An entry can't link to itself");
  const kind = String(data.kind ?? '').trim().slice(0, 60);
  const note = String(data.note ?? '').trim().slice(0, 200);
  const mutual = l.mutual ? 1 : 0;   // always a true/false, never anything else (the database stores it as 1 or 0)

  for (const id of [data.a, data.b]) {
    if (!db.get('SELECT 1 AS ok FROM entities WHERE id = ?', id)) throw new Error('Entry not found');
  }
  if (l._id) {
    const found = db.run('UPDATE relationships SET a = ?, b = ?, kind = ?, note = ?, mutual = ? WHERE id = ?',
      data.a, data.b, kind, note, mutual, checkId(l._id));
    if (!found.changes) throw new Error('Link not found');
    return l._id;
  }
  const id = newId();
  db.run('INSERT INTO relationships (id, a, b, kind, note, mutual) VALUES (?, ?, ?, ?, ?, ?)', id, data.a, data.b, kind, note, mutual);
  return id;
}


function remove(id){
  db.run('DELETE FROM relationships WHERE id = ?', checkId(id));
  return true;
}

// used when an entity is deleted: drop every link that touches it
// (the database does that itself now: ON DELETE CASCADE in schema.js, so the removeFor function that used to do it is gone)

module.exports = { all, save, remove };

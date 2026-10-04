const { col } = require('../db');
const { oid, plain, pick } = require('./ids');
const relationships = require('./relationships');
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
async function nextRef(type) {
  const p = PREFIX[type];
  const doc = await col('counters').findOneAndUpdate(
    { _id: p },
    { $inc: { n: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  return `${p}-${String(doc.n).padStart(4, '0')}`;
}

const all = async () => (await col('entities').find().toArray()).map(plain);

async function save(e) {
  if (!PREFIX[e.type]) throw new Error('Unknown type: ' + e.type);
  if (!String(e.name || '').trim()) throw new Error('An entry needs a name');
  const data = { ...pick(e, FIELDS), fears: cleanFears(e.fears), tags: cleanTags(e.tags), updatedAt: new Date() };

  if (e._id) {
    await col('entities').updateOne({ _id: oid(e._id) }, { $set: data });
    return e._id;
  }
  const r = await col('entities').insertOne({
    ...data,
    ref: await nextRef(data.type),
    appearances: [],
    createdAt: new Date(),
  });
  return r.insertedId.toString();
}

async function remove(id) {
  await col('entities').deleteOne({ _id: oid(id) });
  await relationships.removeFor(id);  // no dangling links
  return true;
}

// add or remove one statement id in an entity's appearances list
async function tag(entityId, episodeId, on) {
  oid(episodeId);
  return col('entities').updateOne(
    { _id: oid(entityId) },
    on ? { $addToSet: { appearances: episodeId } } : { $pull: { appearances: episodeId } }
  );
}

// used when a statement is deleted: remove its id from every entity
const untagEverywhere = (episodeId) =>
  col('entities').updateMany({ appearances: episodeId }, { $pull: { appearances: episodeId } });



module.exports = { all, save, remove, tag, untagEverywhere };
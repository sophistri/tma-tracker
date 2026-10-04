const { col } = require('../db');
const { oid, plain, pick } = require('./ids');
const entities = require('./entities');
const { cleanFears, cleanTags } = require('./clean');

const FIELDS = ['number', 'title', 'season', 'giver', 'subject', 'text', 'statementDate', 'actualDate'];

// escape characters that are special in a regex, so typing "(" can't break a search
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// the list leaves out `text` (it's big); the search still looks inside it
async function list(q) {
  const rx = q ? new RegExp(esc(q), 'i') : null;
  const filter = rx ? { $or: [{ title: rx }, { text: rx }, { giver: rx }, { subject: rx }, { statementDate: rx }, { actualDate: rx }] } : {};
  const docs = await col('episodes').find(filter, { projection: { text: 0 } }).sort({ number: 1 }).toArray();
  return docs.map(plain);
}

async function get(id) {
  const ep = await col('episodes').findOne({ _id: oid(id) });
  if (!ep) throw new Error('Statement not found');
  return plain(ep);
}

async function save(ep) {
  if (!String(ep.title || '').trim()) throw new Error('A statement needs a title');
  const data = { ...pick(ep, FIELDS), fears: cleanFears(ep.fears) };
  if (ep._id) {
    await col('episodes').updateOne({ _id: oid(ep._id) }, { $set: data });
    return ep._id;
  }
  const r = await col('episodes').insertOne(data);
  return r.insertedId.toString();
}


async function remove(id) {
  await col('episodes').deleteOne({ _id: oid(id) });
  await entities.untagEverywhere(id);  // no entity should still point at a deleted statement
  return true;
}

module.exports = { list, get, save, remove };
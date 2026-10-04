const { col } = require('../db');
const { oid, plain, pick } = require('./ids');

const FIELDS = ['a', 'b', 'kind', 'note', 'mutual'];   // mutual = a two-way link ("friend of" reads the same from both ends)

const all = async () => (await col('relationships').find().toArray()).map(plain);


// if id alr exists, then update. otherwise create a new rec
async function save(l) {
  const data = pick(l, FIELDS);
  oid(data.a); oid(data.b); // throws if either id is malformed
  if (data.a === data.b) throw new Error("An entry can't link to itself");
  data.mutual = !!l.mutual;   // always a true/false, never anything else
  if (l._id) {
    await col('relationships').updateOne({ _id: oid(l._id) }, { $set: data });
    return l._id;
  }
  const r = await col('relationships').insertOne(data);
  return r.insertedId.toString();
}


async function remove(id){
  await col('relationships').deleteOne({ _id: oid(id) });
  return true;
}

// used when an entity is deleted: drop every link that touches it
const removeFor = (entityId) =>
  col('relationships').deleteMany({ $or: [{ a: entityId }, { b: entityId }] });

module.exports = { all, save, remove, removeFor };
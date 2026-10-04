const { MongoClient } = require('mongodb')
const { seedEpisodes } = require('./seed');

const MONGO_URL = 'mongodb://localhost:27017';
let client = null, db = null, error = null, connecting = null;  // standard status state vaariiaaaableees

async function connect() {
  if (client) { await client.close().catch(() => {}); client = null; db = null; }
  try {
    client = new MongoClient(MONGO_URL, { serverSelectionTimeoutMS: 4000 });
    await client.connect();
    db = client.db('the_archive');
    await ensureIndexes();
    await migrateFears();
    await seedEpisodes(db);   // first run only: adds the 200 statements
    error = null;
    console.log('Mongo connected');
  } catch (err) {
    db = null;
    error = err.message;
    console.error('Mongo connection failed:', err.message);
  }
}

async function ensureIndexes() {
  await Promise.all([
    db.collection('entities').createIndex({ type: 1, name: 1 }),
    db.collection('entities').createIndex({ ref: 1 }),
    db.collection('relationships').createIndex({ a: 1 }),
    db.collection('relationships').createIndex({ b: 1 }),
    db.collection('episodes').createIndex({ number: 1 }),
  ]);
}

async function migrateFears() {
  for (const name of ['entities', 'episodes']) {
    await db.collection(name).updateMany(
      { fear: { $exists: true } },
      [
        { $set: { fears: { $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$fear', ''] } }, 0] }, ['$fear'], []] } } },
        { $unset: 'fear' },
      ]
    );
  }
}

const col = (name) => {
  if (!db) throw new Error('MongoDB is not connected');
  return db.collection(name);
};

module.exports = {
  start: () => (connecting = connect()),
  retry: () => (connecting = connect()),
  whenReady: () => connecting,
  status: () => ({ connected: !!db, error }),
  col,
  close: () => (client ? client.close().catch(() => {}) : undefined),
};



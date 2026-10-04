// The Magnus Archives has 200 statements (episodes): 5 seasons of 40.
// This puts all of them into the archive the first time the app runs, so you only have to fill in the details.
const episodes = require('./data/episodes.json');   // [{ number, season, title }, ...] (titles only: no transcripts)

async function seedEpisodes(db) {
  // a note saying "already done", so a statement you delete later is never put back on the next launch
  const meta = db.collection('meta');
  if (await meta.findOne({ _id: 'seeded-episodes-v1' })) return;

  // one upsert per episode, matched on its number:
  //   missing  -> created from the list
  //   existing -> left exactly as you wrote it ($setOnInsert only applies when a new document is created)
  const ops = episodes.map(({ number, ...rest }) => ({
    updateOne: {
      filter: { number },
      update: { $setOnInsert: { ...rest, fears: [] } },
      upsert: true,
    },
  }));
  await db.collection('episodes').bulkWrite(ops, { ordered: false });
  await meta.insertOne({ _id: 'seeded-episodes-v1', at: new Date(), count: episodes.length });
  console.log(`Seeded ${episodes.length} statements`);
}

module.exports = { seedEpisodes };

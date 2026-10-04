const handle = require('./handle');
const episodes = require('../models/episodes');

handle('list-episodes', (q) => episodes.list(q));
handle('get-episode', (id) => episodes.get(id));
handle('save-episode', (ep) => episodes.save(ep));
handle('delete-episode', (id) => episodes.remove(id));
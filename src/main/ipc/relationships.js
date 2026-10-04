const handle = require('./handle');
const rel = require('../models/relationships');

handle('get-links', () => rel.all());
handle('save-link', (l) => rel.save(l));
handle('delete-link', (id) => rel.remove(id));
const handle = require('./handle');
const entities = require('../models/entities');

handle('get-entities', () => entities.all());
handle('save-entity', (e) => entities.save(e));
handle('delete-entity', (id) => entities.remove(id));
handle('tag', (entityId, episodeId, on) => entities.tag(entityId, episodeId, on));
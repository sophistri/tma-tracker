const { ipcMain } = require('electron')
const db = require('../db')
const handle = require('./handle')


handle('status', () => db.status());

// retry can't use the wrapper: it must not wait on the failed attempt it replaces
ipcMain.handle('retry-db', async () => {
  await db.retry();
  return db.status();
});
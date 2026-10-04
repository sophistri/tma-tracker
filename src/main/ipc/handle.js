const { ipcMain } = require('electron')
const db = require('../db')

// Every IPC handler goes through here: wait for the connection attempt to finish first

module.exports = (channel, fn) =>
  ipcMain.handle(channel, async (_event, ...args) => {
    await db.whenReady();
    return fn(...args);
  });
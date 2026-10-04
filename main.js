const { app, BrowserWindow } = require('electron')
const path = require('path')
const db = require('./src/main/db');
require('./src/main/ipc/system'); // requiring a file registers its handlers
require('./src/main/ipc/entities');
require('./src/main/ipc/relationships');
require('./src/main/ipc/episodes');


//app, which controls your application's event lifecycle.
//BrowserWindow, which creates and manages app windows.

// loads webpage into a new wndow instance
const createWindow = () => {
  const win = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, 'art', 'icon.png'),   // the cassette
    webPreferences: {
      // path.join ensures an absolute path, which Electron requires
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // Enabled by default, ensures security
      nodeIntegration: false,  // Disabled by default, prevents direct Node access in frontend
      sandbox: true,
    },
  })

  win.loadFile('index.html')
}



// OPEN SESAME
// call fn when electron is ready
// (In Electron, BrowserWindows can only be created after the app module's ready event is fired.)
app.whenReady().then(() => {
    db.start(); // start connecting, but don't wait: the window should appear immediately
    createWindow()
})

// CLOSE SESAME?
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => db.close());
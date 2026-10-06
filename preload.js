const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  status: () => ipcRenderer.invoke('status'),
  retryDb: () => ipcRenderer.invoke('retry-db'),

  getEntities: () => ipcRenderer.invoke('get-entities'),
  saveEntity: (e) => ipcRenderer.invoke('save-entity', e),
  deleteEntity: (id) => ipcRenderer.invoke('delete-entity', id),
  tag: (entityId, episodeId, on) => ipcRenderer.invoke('tag', entityId, episodeId, on),

  getLinks: () => ipcRenderer.invoke('get-links'),
  saveLink: (l) => ipcRenderer.invoke('save-link', l),
  deleteLink: (id) => ipcRenderer.invoke('delete-link', id),

  listEpisodes: (q) => ipcRenderer.invoke('list-episodes', q),
  getEpisode: (id) => ipcRenderer.invoke('get-episode', id),
  saveEpisode: (ep) => ipcRenderer.invoke('save-episode', ep),
  deleteEpisode: (id) => ipcRenderer.invoke('delete-episode', id),
  importTranscripts: (opts) => ipcRenderer.invoke('import-transcripts', opts),

  importTranscriptsFolder: (opts) => ipcRenderer.invoke('import-transcripts-folder', opts),
  downloadTranscriptsOnline: (opts) => ipcRenderer.invoke('download-transcripts-online', opts),
  onImportProgress: (cb) => {
    const handler = (_event, val) => cb(val);
    ipcRenderer.on('import-progress', handler);
    return () => ipcRenderer.removeListener('import-progress', handler);
  },

  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close:    () => ipcRenderer.send('win:close'),
});
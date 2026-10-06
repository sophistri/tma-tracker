const { dialog, BrowserWindow, ipcMain } = require('electron');
const importer = require('../import');
const db = require('../db');

const GITHUB_POSTS_API = 'https://api.github.com/repos/Snarp/magnus_archives_transcripts/contents/_posts';

// Helper for running concurrent promises
async function mapConcurrent(items, limit, fn) {
  const results = [];
  const executing = new Set();
  for (const item of items) {
    const p = Promise.resolve().then(() => fn(item));
    results.push(p);
    executing.add(p);
    const clean = () => executing.delete(p);
    p.then(clean).catch(clean);
    if (executing.size >= limit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(results);
}

// 1. Online Fast Downloader
ipcMain.handle('download-transcripts-online', async (event, opts) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const overwrite = Boolean(opts && opts.overwrite);

  const res = await fetch(GITHUB_POSTS_API, {
    headers: { 'User-Agent': 'TheArchive-DesktopApp', 'Accept': 'application/vnd.github.v3+json' },
  });
  if (!res.ok) throw new Error(`GitHub API HTTP ${res.status}`);
  const items = await res.json();

  // FILTER: Only .md files that are NOT trailers, teasers, or specials
  const mdFiles = items.filter((it) => {
    const name = it.name.toLowerCase();
    if (!name.endsWith('.md')) return false;
    if (name.includes('teaser') || name.includes('trailer') || name.includes('special')) return false;
    return true;
  });

  const total = mdFiles.length;
  let done = 0;
  const result = { files: total, imported: 0, skipped: [], filled: 0 };

  await mapConcurrent(mdFiles, 10, async (item) => {
    // Only match files like: 2016-04-14-003-across-the-street.md
    const match = item.name.match(/^\d{4}-\d{2}-\d{2}-0*(\d{1,3})(?:-[a-z0-9\-]+)?\.md$/i);
    if (!match) return;

    const number = Number(match[1]);
    if (number < 1 || number > 200) return; // ignore anything outside the 200 statements

    try {
      const rawRes = await fetch(item.download_url);
      if (!rawRes.ok) return;
      let text = await rawRes.text();
      text = text.replace(/^---[\s\S]*?---\s*/, '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();

      db.transaction(() => {
        const row = db.get('SELECT id, text, giver, subject, case_no, statement_date FROM episodes WHERE number = ?', number);
        
        // Skip only if row is missing OR (it already has text AND overwrite is false)
        if (!row || (row.text && !overwrite)) return;

        const h = importer.readHeader(text);
        const giver = row.giver || h.giver || '';
        const subject = row.subject || h.subject || '';
        const caseNo = row.case_no || h.caseNo || '';
        const statementDate = row.statement_date || h.statementDate || '';

        db.run(
          'UPDATE episodes SET text = ?, giver = ?, subject = ?, case_no = ?, statement_date = ? WHERE id = ?',
          text, giver, subject, caseNo, statementDate, row.id
        );
        result.imported++;
      });
    } finally {
      done++;
      if (win && !win.isDestroyed()) {
        win.webContents.send('import-progress', { done, total, ep: number });
      }
    }
  });

  return result;
});

// 2. Local Folder Picker
ipcMain.handle('import-transcripts-folder', async (event, opts) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const picked = await dialog.showOpenDialog(win, {
    title: 'Choose the folder of transcripts',
    properties: ['openDirectory'],
  });
  if (picked.canceled || !picked.filePaths[0]) return null;
  return importer.importFolder(picked.filePaths[0], { overwrite: !!(opts && opts.overwrite) });
});
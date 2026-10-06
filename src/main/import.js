// Bring transcripts in from a folder of text files, so you don't have to paste 200 of them by hand.
// Name each file after its episode number, e.g. "MAG 001.txt", "mag-12 - Dreamer.md" or just "042.txt".
// A transcript goes into the statement with that number. The statement giver, subject, case number and
// "original statement given" date are also read from the opening lines, but ONLY where those boxes are still empty.
const fs = require('node:fs');
const path = require('node:path');
const db = require('./db');

const EXTENSIONS = ['.txt', '.md', '.text'];
const MAX_BYTES = 5 * 1024 * 1024;   // a transcript is a few dozen KB; anything this big is the wrong file

// "MAG 001 - Anglerfish.txt" -> 1. Returns null if there's no usable number.
// (names like "MAG 100.1" are bonus episodes, not statement 100 or 1, so a number followed by .digit, or sitting after a dot, is rejected)
function numberFromName(file) {
  const base = path.basename(file, path.extname(file));
  const m = base.match(/\bmag[\s_\-.]*0*(\d{1,3})(?![\d]|\.\d)/i) || base.match(/(?<![\d.])0*(\d{1,3})(?!\d|\.\d)/);
  const n = m ? Number(m[1]) : null;
  return n && n >= 1 ? n : null;
}

const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Read what the opening of a transcript says. Every field is optional: whatever isn't found is simply left out.
// e.g. "Case #0122204, statement of Jane Doe regarding a noise. Original statement given 3rd May 2010. Audio recording by..."
function readHeader(text) {
  const head = text.slice(0, 1500).replace(/\s+/g, ' ');
  const out = {};
  const c = head.match(/\bcase\s*(?:no\.?|number)?\s*#?\s*([0-9]{3,8}(?:-[A-Z0-9]{1,3})?)\b/i);
  if (c) out.caseNo = c[1];
  const s = head.match(/\bstatement\s+of\s+(.{2,80}?),?\s+(?:regarding|concerning|about|on)\s+(.{3,160}?)\.(?:\s|$)/i);
  if (s) { out.giver = s[1].trim(); out.subject = capitalise(s[2].trim()); }
  const d = head.match(/\boriginal\s+statement\s+(?:given|made|recorded)\s+(?:on\s+)?(.{3,40}?)\./i);
  if (d) out.statementDate = d[1].trim();
  return out;
}

function importFolder(folder, { overwrite = false } = {}) {
  const result = { folder, files: 0, imported: 0, alreadyHadText: 0, unmatched: [], skipped: [], filled: 0 };
  const names = fs.readdirSync(folder, { withFileTypes: true })
    .filter((d) => d.isFile() && EXTENSIONS.includes(path.extname(d.name).toLowerCase()))
    .map((d) => d.name)
    .sort();
  result.files = names.length;

  // one transaction for the whole folder: a surprise halfway through can't leave it half imported
  db.transaction(() => {
    for (const name of names) {
      const number = numberFromName(name);
      if (!number) { result.skipped.push(`${name} (no episode number in the name)`); continue; }

      const full = path.join(folder, name);
      if (fs.statSync(full).size > MAX_BYTES) { result.skipped.push(`${name} (too big to be a transcript)`); continue; }
      const text = fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();   // no BOM, and one kind of line break
      if (!text) { result.skipped.push(`${name} (empty)`); continue; }

      const row = db.get('SELECT id, text, giver, subject, case_no, statement_date FROM episodes WHERE number = ?', number);
      if (!row) { result.unmatched.push(`${name} (no statement numbered ${number})`); continue; }
      if (row.text && !overwrite) { result.alreadyHadText++; continue; }

      // fill the details from the opening lines, but never overwrite something already typed in
      const h = readHeader(text);
      const giver = row.giver || h.giver || '', subject = row.subject || h.subject || '';
      const caseNo = row.case_no || h.caseNo || '', statementDate = row.statement_date || h.statementDate || '';
      if (giver !== row.giver || subject !== row.subject || caseNo !== row.case_no || statementDate !== row.statement_date) result.filled++;

      db.run('UPDATE episodes SET text = ?, giver = ?, subject = ?, case_no = ?, statement_date = ? WHERE id = ?',
        text, giver, subject, caseNo, statementDate, row.id);
      result.imported++;
    }
  });
  return result;
}

module.exports = { importFolder, numberFromName, readHeader };

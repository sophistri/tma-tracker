// a big drawer button: category name and how many entries it holds
function drawer(name, count, color, onClick) {
  const b = el('button', 'drawer');
  b.style.setProperty('--folder', color);   // the folder is painted in the category's colour (see .drawer in style.css)
  b.append(el('strong', '', name), el('span', '', String(count)));
  b.onclick = onClick;
  return b;
}

// a full-width row: title on top, a quieter line underneath
function row(title, sub, color, onClick) {
  const b = el('button', 'row');
  b.style.borderLeft = `10px solid ${color}`;
  b.append(el('strong', '', title), el('span', '', sub));
  b.onclick = onClick;
  return b;
}

const entryRow = (e) =>
  row(e.name, [e.ref, typeOf(e.type).one, ...(e.fears || [])].filter(Boolean).join(' · '), typeOf(e.type).color, () => openEntry(e));

const statementRow = (ep, sub) =>
  row(ep.title, sub, '#55adb6', () => gotoStatement(ep._id));

function renderHome() {
  // count entries per type in one pass
  const counts = {};
  S.entities.forEach((e) => (counts[e.type] = (counts[e.type] || 0) + 1));

  $('tiles').replaceChildren(
    drawer('Statements', S.episodes.length, '#55adb6', () => show('transcripts')),
    ...Object.entries(TYPES).map(([key, t]) => drawer(t.label, counts[key] || 0, t.color, () => gotoCatalog(key)))
  );

  // how many statements have at least one entry indexed in them
  const indexed = S.episodes.filter((ep) => S.entities.some((e) => (e.appearances || []).includes(ep._id))).length;
  $('hero-sub').textContent =
    `${plural(S.entities.length, 'entry', 'entries')}, ${plural(S.episodes.length, 'statement')}, ` +
    `${indexed}/${S.episodes.length} statements indexed`;
  // the progress bar under it: how much of the archive has at least one entry indexed
  $('hero-fill').style.width = (S.episodes.length ? Math.round((indexed / S.episodes.length) * 100) : 0) + '%';

  // the last statement you opened, if it still exists
  const last = S.episodes.find((ep) => ep._id === store.get('lastEp'));
  $('resume').replaceChildren(last
    ? statementRow(last, epRef(last))
    : el('p', 'empty', 'No statement opened yet.'));

  // the spread copies the array first, because sort modifies the array it's called on, and we must not reorder S.entities itself.
  const recent = [...S.entities].sort((a, b) => dateOf(b) - dateOf(a)).slice(0, 8);
  $('recent').replaceChildren(...(recent.length
    ? recent.map(entryRow)
    : [el('p', 'empty', 'Nothing filed yet. Add the first entry in the Catalog.')]));
}

// ---- search across everything ----
$('home-search').oninput = debounce(async () => {
  const q = $('home-search').value.trim();
  $('home-results').hidden = !q;
  $('home-main').hidden = !!q;
  if (!q) return;

  const entries = S.entities.filter((e) => matches(e, q)).slice(0, 30);   // in memory
  const statements = (await call('listEpisodes', q)) || [];                   // searched by the main process, transcripts included

  if ($('home-search').value.trim() !== q) return;   // the user kept typing while we waited: drop this stale answer

  const rows = [
    ...entries.map(entryRow),
    ...statements.map((ep) => statementRow(ep, `${epRef(ep)} · Statement`)),
  ];
  $('home-results').replaceChildren(...(rows.length ? rows : [el('p', 'empty', 'Nothing found.')]));
}, 200);
let catType = 'all';  // selected drawer tab ('all' or a key of TYPES)
let catLetter = '';   // selected A-Z divider ('' means all letters)

// first letter of a name, or '#' if it isn't A-Z
const initial = (name) => {
  const c = (name || '').trim().charAt(0).toUpperCase();
  return /[A-Z]/.test(c) ? c : '#';
};

// does this entry match what the user typed? checks several fields at once
const matches = (e, q) =>
  [e.name, e.ref, e.summary, e.notes, typeOf(e.type).label, ...(e.fears || []), ...Object.values(e.f || {})]
    .join(' ').toLowerCase().includes(q.toLowerCase());

function card(e) {
  const n = el('article', 'fcard');

  const tab = el('span', 'tab', e.ref || 'NEW');
  tab.style.background = typeOf(e.type).color;

  const links = S.links.filter((l) => l.a === e._id || l.b === e._id).length;
  const kind = [typeOf(e.type).one, ...(e.fears || [])].filter(Boolean).join(' · ');

  n.append(
    tab,
    el('h3', '', e.name),
    el('p', 'role', kind),
    ...(e.summary ? [el('p', 'notes', e.summary)] : []),
    el('p', 'meta', `Filed ${fmtDate(e.createdAt)}`),
    el('p', 'meta', `${plural(links, 'cross-ref')}, ${plural((e.appearances || []).length, 'statement')}`)
  );

  if (isMinor(e)) n.classList.add('minor');
  
  n.onclick = () => openEntry(e);  return n;
}

function renderCatalog() {
  const visible = S.entities.filter((e) => showMinor || !isMinor(e));
  // 1. drawer tabs, each showing how many entries it holds
  const tab = (key, text, count) => {
    const b = el('button', 'chip' + (catType === key ? ' on' : ''), `${text} ${count}`);
    b.onclick = () => { catType = key; catLetter = ''; renderCatalog(); };
    return b;
  };
  $('cat-chips').replaceChildren(
    tab('all', 'All', visible.length),
    ...Object.entries(TYPES).map(([key, t]) => tab(key, t.label, visible.filter((e) => e.type === key).length))
  );

  // 2. narrow down: by drawer, then by search text
  const q = $('cat-search').value;
  const base = visible.filter((e) => (catType === 'all' || e.type === catType) && matches(e, q));

  // 3. A-Z strip: letters with no entries are disabled
  const present = new Set(base.map((e) => initial(e.name)));
  if (catLetter && !present.has(catLetter)) catLetter = '';
  const letterBtn = (key, text) => {
    const b = el('button', 'letter' + (catLetter === key ? ' on' : ''), text);
    b.disabled = key !== '' && !present.has(key);
    b.onclick = () => { catLetter = key; renderCatalog(); };
    return b;
  };
  $('cat-letters').replaceChildren(
    letterBtn('', 'All'),
    ...[...'ABCDEFGHIJKLMNOPQRSTUVWXYZ#'].map((c) => letterBtn(c, c))
  );

  // 4. cards: filter by letter, sort by name, draw
  const rows = base
    .filter((e) => !catLetter || initial(e.name) === catLetter)
    .sort((a, b) => a.name.localeCompare(b.name))
    .sort(byImportance);
  $('cat-list').replaceChildren(...rows.map(card));
  $('cat-minor').textContent = showMinor ? 'Minor entries: shown' : 'Minor entries: hidden';
  if (!rows.length) $('cat-list').append(el('p', 'empty', 'Nothing filed here yet.'));
}

// to go from home to a specific catalog
function gotoCatalog(type) {
  catType = type;
  catLetter = '';
  $('cat-search').value = '';   // otherwise the old search text hides entries the drawer count promised
  renderCatalog();
  show('archive');
}


let showMinor = store.get('showMinor') !== 'no';

$('cat-minor').onclick = () => {
  showMinor = !showMinor;
  store.set('showMinor', showMinor ? 'yes' : 'no');
  renderCatalog();
};

$('cat-search').oninput = renderCatalog;
$('cat-new').onclick = () => openEntry({ type: catType === 'all' ? 'person' : catType });
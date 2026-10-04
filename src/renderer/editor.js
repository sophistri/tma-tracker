let editId = null;  // _id of the entry being edited, or null for a new one
let editF = {};     // current values of the type-specific fields
let pendingEp = null;  // if set, a newly created entry also gets tagged into this statement
let entDirty = false; // check for edits
let entryTrail = [];   // ids of entries visited before the current one, oldest first
const okLeaveEntry = async () => !entDirty || (await ask('Discard unsaved changes to this entry?'));

// fill the two dropdowns once, at startup
function fillSelects() {
  const fm = $('ent-form').elements;
  fm.type.replaceChildren(...Object.entries(TYPES).map(([key, t]) => new Option(t.one, key)));
}

// the extra fields depend on the selected type (person: allegiance, status; object: origin, holder...)
function buildFields() {
  const defs = typeOf($('ent-form').elements.type.value).fields;
  $('ent-fields').replaceChildren(...defs.map(([key, text]) => {
    const label = el('label', '', text + ' ');
    const input = document.createElement('input');
    input.maxLength = 120;
    input.value = editF[key] || '';
    input.oninput = () => (editF[key] = input.value);
    label.append(input);
    return label;
  }));
}
$('ent-form').elements.type.onchange = buildFields;

// open the dialog for an existing entry, or for a new one if called with no entry
function openEntry(e = {}, fromLink = false) {
  if (!fromLink) entryTrail = [];   // opened from the catalog or a panel: a fresh trail
  const fm = $('ent-form').elements;
  $('ent-form').reset();   // clears every field to default
  editId = e._id || null;

  // tags and the minor checkbox must be set AFTER reset(), otherwise reset() wipes them
  const tags = e.tags || [];
  fm.minor.checked = tags.includes('minor');
  fm.tags.value = tags.filter((t) => t !== 'minor').join(', ');

  $('ent-title').textContent = editId ? `File ${e.ref}` : 'New entry';
  $('ent-meta').textContent = editId ? `Filed ${fmtDate(e.createdAt)}` : 'A reference number is assigned when you save.';
  fm.type.value = e.type || 'person';
  setFears($('ent-fears'), e.fears);
  fm.name.value = e.name || '';
  fm.summary.value = e.summary || '';
  fm.notes.value = e.notes || '';
  editF = { ...(e.f || {}) };  // save it here so that changing 'type' later doesnt lose all progress
  buildFields();

  $('ent-delete').hidden = !editId;   // nothing to delete for a new entry
  $('ent-rel').hidden = !editId;               // cross-references need a saved entry
  $('ent-back').hidden = entryTrail.length === 0;  // nothing to go back to sooooo hide the button
  $('ent-map').hidden = !editId;                   // the map needs a saved entry to centre on
  $('ent-names').replaceChildren(...S.entities.map((x) => {
    const o = document.createElement('option');
    o.value = entryLabel(x);
    return o;
  }));
  if (editId) renderRels();

  entDirty = false;
  if (!$('ent-dialog').open) $('ent-dialog').showModal();
  $('ent-dialog').scrollTop = 0;               // a followed link starts at the top of its file
  fm.name.focus();
}

// save: collect the form into one object and hand it to the main process
$('ent-form').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const fm = $('ent-form').elements;
  const type = fm.type.value;


  const extra = {};  // keep only the extra fields that belong to the chosen type
  typeOf(type).fields.forEach(([key]) => { if (editF[key]) extra[key] = editF[key]; });

  
  const entry = {
    type, name: fm.name.value.trim(), fears: getFears($('ent-fears')),
    summary: fm.summary.value.trim(), notes: fm.notes.value, f: extra,
  };


  const tags = fm.tags.value.split(',').map((t) => t.trim()).filter(Boolean);
  if (fm.minor.checked) tags.unshift('minor');
  entry.tags = tags;

  
  if (editId) entry._id = editId;     // an _id means update; none means create

  const isNew = !editId, ep = pendingEp;   // capture now: the dialog's close event clears it
  const id = await call('saveEntity', entry);
  if (!id) return;
  if (isNew && ep) await call('tag', id, ep, true);
  entDirty = false;
  $('ent-dialog').close();
  await refresh();
});

// typing in the cross-reference box isn't a change to the entry itself
$('ent-form').addEventListener('input', (ev) => {
  if (!ev.target.closest('#ent-rel')) entDirty = true;
});

$('ent-cancel').onclick = () => $('ent-dialog').close();

$('ent-delete').onclick = async () => {
  const e = S.entities.find((x) => x._id === editId);
  if (!(await ask(`Delete ${e.name}? Its cross-references are removed too.`))) return;
  if (await call('deleteEntity', editId)) {
    $('ent-dialog').close();
    refresh();
  }
};

$('ent-back').onclick = async () => {
  if (!(await okLeaveEntry())) return;
  while (entryTrail.length) {
    const prev = S.entities.find((x) => x._id === entryTrail.pop());
    if (prev) return openEntry(prev, true);   // skip any entry deleted in the meantime
  }
  $('ent-back').hidden = true;
};

// jump to the relation map, centred on this entry
$('ent-map').onclick = async () => {
  if (!(await okLeaveEntry())) return;
  $('ent-dialog').close();
  focusMap(editId);
};

//Clear it whenever the dialog closes, so a cancelled entry can't leave a stale value behind
$('ent-dialog').addEventListener('close', () => { pendingEp = null; entryTrail = []; });  

function renderRels() {
  // every link where this entry is on either end
  const mine = S.links.filter((l) => l.a === editId || l.b === editId);

  $('rel-list').replaceChildren(...(mine.length ? mine.map((l) => {
    const otherId = l.a === editId ? l.b : l.a;  // picks whichever end of the link is not the current entry. (so that itll show up on both entries)
    const other = S.entities.find((x) => x._id === otherId);

    const row = el('div', 'rel');
    const open = el('button', 'cp-item');
    open.type = 'button';       // inside a form, buttons submit it unless told otherwise
    if (other) open.style.borderLeftColor = typeOf(other.type).color;
    open.append(
      el('strong', '', other ? other.name : '(missing entry)'),
      // ↔ = two-way (reads the same from both ends); ← = a one-way link that points at this entry
      el('span', '', `${l.mutual ? '↔ ' : (l.a === editId ? '' : '← ')}${l.kind || 'linked to'}${other ? ' · ' + other.ref : ''}`)
    );


    open.onclick = async () => {
      if (!other) return;
      if (!(await okLeaveEntry())) return;
      entryTrail.push(editId);     // remember where we are before leaving
      openEntry(other, true);
    };

    const x = el('button', 'small', '×');
    x.type = 'button';
    x.title = 'Remove cross-reference';
    x.onclick = async () => { if (await call('deleteLink', l._id)) refresh(); };

    // flips a link between one-way and two-way (the whole link is sent back so nothing else changes)
    const flip = el('button', 'small', l.mutual ? '↔' : '→');
    flip.type = 'button';
    flip.title = l.mutual ? 'Two-way. Click to make it one-way' : 'One-way. Click to make it two-way';
    flip.onclick = async () => { if (await call('saveLink', { ...l, mutual: !l.mutual })) refresh(); };

    row.append(open, flip, x);
    return row;
  }) : [el('p', 'empty', 'No cross-references yet.')]));

  // statements this entry is indexed in
  const e = S.entities.find((x) => x._id === editId);
  const eps = S.episodes.filter((ep) => ((e && e.appearances) || []).includes(ep._id));
  $('app-list').replaceChildren(...(eps.length ? eps.map((ep) => {
    const b = el('button', 'cp-item');
    b.type = 'button';
    b.append(el('strong', '', ep.title), el('span', '', epRef(ep)));
    b.onclick = () => { $('ent-dialog').close(); gotoStatement(ep._id); };
    return b;
  }) : [el('p', 'empty', 'Not indexed in any statement.')]));
}

$('rel-add').onclick = async () => {
  const target = resolveEntry($('rel-target').value);
  if (!target) return toast('No single entry matches. Pick one from the suggestions; the reference number tells duplicates apart.');
  if (!target || target._id === editId) return toast('Pick another entry from the list.');

  const kind = $('rel-kind').value.trim() || 'linked to';
  const mutual = $('rel-mutual').checked;
  // a two-way link counts in both directions, so "A friend of B" blocks adding "B friend of A"
  const exists = S.links.some((l) => (l.kind || '').toLowerCase() === kind.toLowerCase() && (
    (l.a === editId && l.b === target._id) ||
    ((l.mutual || mutual) && l.a === target._id && l.b === editId)));
  if (exists) return toast('That cross-reference already exists.');

  if (!(await call('saveLink', { a: editId, b: target._id, kind, mutual }))) return;
  $('rel-target').value = '';
  $('rel-kind').value = '';
  $('rel-mutual').checked = false;
  refresh();
};

// words like "friend of" read the same from both sides, so tick Two-way for them
$('rel-kind').addEventListener('input', () => {
  if (TWO_WAY_KINDS.includes($('rel-kind').value.trim().toLowerCase())) $('rel-mutual').checked = true;
});

// hopefully this will add relationships b/w entries?
['rel-target', 'rel-kind'].forEach((id) =>
  $(id).addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); $('rel-add').click(); }
  }));

function resolveEntry(typed) {
  const t = typed.trim().toLowerCase();
  if (!t) return null;
  const others = S.entities.filter((x) => x._id !== editId);
  const byLabel = others.find((x) => entryLabel(x).toLowerCase() === t);
  if (byLabel) return byLabel;
  const byRef = others.find((x) => (x.ref || '').toLowerCase() === t);
  if (byRef) return byRef;
  const sameName = others.filter((x) => x.name.toLowerCase() === t);
  return sameName.length === 1 ? sameName[0] : null;   // two entries with one name: ask for the reference
}

fillSelects();
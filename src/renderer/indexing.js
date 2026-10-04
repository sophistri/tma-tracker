$('cp-type').replaceChildren(...Object.entries(TYPES).map(([key, t]) => new Option(t.one, key)));

// one clickable row: name on top, reference number and type underneath
function entryButton(e) {
  const b = el('button', 'cp-item');
  b.style.borderLeftColor = typeOf(e.type).color;
  b.append(el('strong', '', e.name), el('span', '', [e.ref, typeOf(e.type).one].filter(Boolean).join(' · ')));
  return b;
}

function renderPanel() {
  // entries already indexed in the open statement
  const tagged = S.entities.filter((e) => epId && (e.appearances || []).includes(epId)).sort(byName);

  // the stamp on the form
  const stamp = $('stamp');
  stamp.hidden = !epId;
  stamp.textContent = tagged.length ? 'INDEXED' : 'UNINDEXED';
  stamp.className = tagged.length ? '' : 'off';

  // top list: indexed entries, each with a button to remove it
  $('cp-tagged').replaceChildren(...(tagged.length ? tagged.map((e) => {
    const row = el('div', 'rel');
    const open = entryButton(e);
    open.onclick = () => openEntry(e);                 // click the name to edit the entry
    const x = el('button', 'small', '×');
    x.title = 'Remove from index';
    x.onclick = async () => { if (await call('tag', e._id, epId, false)) refresh(); };
    row.append(open, x);
    return row;
  }) : [el('p', 'empty', epId ? 'Nothing indexed yet.' : 'Save the statement to start indexing.')]));

  // bottom list: entries that could be indexed, narrowed by the search box
  const q = $('cp-search').value;
  const taggedIds = new Set(tagged.map((e) => e._id));
  const rows = S.entities
    .filter((e) => !taggedIds.has(e._id) && matches(e, q))
    .sort(byName)
    .slice(0, 40);                                      // keep the list short
  $('cp-list').replaceChildren(...rows.map((e) => {
    const row = el('div', 'rel');
    const add = entryButton(e);
    add.onclick = async () => {
      if (!epId) return toast('Save the statement first, then index entries.');
      if (await call('tag', e._id, epId, true)) refresh();
    };
    const edit = el('button', 'small', '✎');
    edit.title = 'Edit this entry';
    edit.onclick = () => openEntry(e);
    row.append(add, edit);
    return row;
  }));
}
$('cp-search').oninput = renderPanel;

// "+ New" pre-fills the name from whatever text is selected in the transcript
$('cp-new').onclick = () => {
  const t = epForm.elements.text;
  const name = t.value.slice(t.selectionStart, t.selectionEnd).trim().slice(0, 60);
  openEntry({ type: $('cp-type').value, name });
  pendingEp = epId;   // set after openEntry; the dialog is open now, so nothing clears it early
};



let epId = null;    // _id of the open statement; null means a new, unsaved one
let dirty = false;  // true once the user has typed something that isn't saved yet

const epForm = $('ep-form');


// ---- the shelf ----
async function loadEpisodes() {
  const eps = (await call('listEpisodes', $('ep-search').value.trim())) || [];
  $('ep-list').replaceChildren(...eps.map((e) => {
    const b = el('button', 'ep' + (e._id === epId ? ' on' : ''));
    b.append(el('span', 'refno', epRef(e)), document.createTextNode(e.title));
    b.onclick = () => openEpisode(e._id);
    return b;
  }));
}
$('ep-search').oninput = loadEpisodes;

// ---- the form ----
function showEpForm(ep = {}) {
  const f = epForm.elements;
  epForm.hidden = false;
  $('ep-empty').hidden = true;
  $('cp').hidden = false;
  renderPanel();
  f.number.value = ep.number ?? '';
  f.season.value = ep.season ?? '';
  f.title.value = ep.title || '';
  f.giver.value = ep.giver || '';
  f.subject.value = ep.subject || '';
  f.caseNo.value = ep.caseNo || '';
  setFears($('ep-fears'), ep.fears);
  f.text.value = ep.text || '';
  f.statementDate.value = ep.statementDate || '';
  f.actualDate.value = ep.actualDate || '';
  $('ep-delete').hidden = !epId;
  dirty = false;  // a freshly loaded form has no unsaved changes
}

// any typing inside the form marks it as having unsaved changes
epForm.addEventListener('input', () => (dirty = true));

// resolves true if it's fine to leave this statement: nothing unsaved, or the user agreed
const okLeave = async () => !dirty || (await ask('Discard unsaved changes to this statement?'));

async function openEpisode(id) {
  if (id !== epId && !(await okLeave())) return;
  const ep = await call('getEpisode', id);   // the full document, with its transcript text
  if (!ep) return;
  epId = id;
  store.set('lastEp', id);   // remembered so the Reading room can offer "Continue reading"
  showEpForm(ep);
  loadEpisodes();
}

$('ep-new').onclick = async () => {
  if (!(await okLeave())) return;
  epId = null;
  showEpForm();
  loadEpisodes();
  epForm.elements.number.focus();
};

// ---- save and delete ----
const num = (v) => (v === '' ? null : Number(v));  // an empty number box means "no number"

epForm.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const d = Object.fromEntries(new FormData(epForm));  // { number: '1', title: '...', ... }
  d.number = num(d.number);
  d.season = num(d.season);
  d.fears = getFears($('ep-fears'));
  if (epId) d._id = epId;

  const id = await call('saveEpisode', d);
  if (!id) return;
  epId = id;
  store.set('lastEp', id);
  dirty = false;
  $('ep-delete').hidden = false;
  toast('Statement saved', true);
  await refresh();
  loadEpisodes();
});

$('ep-delete').onclick = async () => {
  if (!(await ask('Delete this statement?'))) return;
  if (!(await call('deleteEpisode', epId))) return;
  epId = null;
  dirty = false;
  epForm.hidden = true;
  $('cp').hidden = true;
  $('ep-empty').hidden = false;
  await refresh();   // entries that were tagged in it just lost that tag
  loadEpisodes();
};


// ---- import transcripts (Shift-click replaces transcripts that already have text) ----
const importDialog = $('import-dialog');
const progWrap = $('import-prog-wrap');
const progFill = $('import-prog-fill');
const progText = $('import-status-text');
const actionsWrap = $('import-actions');
const overwriteCheckbox = $('import-overwrite');

// Open the dialog
$('ep-import').onclick = (ev) => {
  // If user held Shift when clicking, pre-check the box
  if (overwriteCheckbox) {
    overwriteCheckbox.checked = ev.shiftKey;
  }
  progWrap.hidden = true;
  actionsWrap.hidden = false;
  progFill.style.width = '0%';
  importDialog.showModal();
};

$('btn-import-cancel').onclick = () => importDialog.close();

// Option A: Download from GitHub
$('btn-import-web').onclick = async () => {
  const overwrite = !!(overwriteCheckbox && overwriteCheckbox.checked);

  actionsWrap.hidden = true;
  progWrap.hidden = false;
  progText.textContent = 'Contacting GitHub archive...';

  try {
    const res = await window.api.downloadTranscriptsOnline({ overwrite });
    importDialog.close();
    toast(`Done! Imported ${res.imported} statements.`);
    await loadEpisodes();
    if (epId) {
      const ep = await call('getEpisode', epId);
      if (ep) showEpForm(ep);
    }
  } catch (err) {
    alert('Download failed: ' + err.message);
    importDialog.close();
  }
};

// Option B: Local Folder
$('btn-import-folder').onclick = async () => {
  const overwrite = !!(overwriteCheckbox && overwriteCheckbox.checked);
  importDialog.close();

  try {
    const res = await window.api.importTranscriptsFolder({ overwrite });
    if (!res) return;
    toast(`Imported ${res.imported} statements from folder.`);
    await loadEpisodes();
    if (epId) {
      const ep = await call('getEpisode', epId);
      if (ep) showEpForm(ep);
    }
  } catch (err) {
    alert('Import failed: ' + err.message);
  }
};

// helper to jump from entry to a statement 
async function gotoStatement(id) {
  await show('transcripts');
  openEpisode(id);
}
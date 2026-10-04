// (Loaded via index.html)

// ---- database status banner (from step 4) ----
function showDbStatus(st) {
  if (!st) return;
  $('dbbar').hidden = st.connected;
  if (!st.connected) $('db-msg').textContent = `Can't reach MongoDB: ${st.error}`;
}

$('db-retry').onclick = async () => {
  const st = await call('retryDb');
  showDbStatus(st);
  if (st && st.connected) refresh();
};
// ---- navigation ----
let view = 'home';

async function show(v) {
  if (view === 'transcripts' && v !== 'transcripts' && !(await okLeave())) return;
  view = v;
  // view switcher -- sets other views to hidden
  document.querySelectorAll('.view').forEach((s) => (s.hidden = s.id !== 'view-' + v));
  // button switcher -- sets on and off states and attaches 'show'
  document.querySelectorAll('#nav button').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
  if (v === 'transcripts') loadEpisodes();
  if (v === 'home') renderHome();   // pick up the statement you just opened
  if (v === 'map') renderMap();
  if (v === 'timeline') renderTimeline();
}

document.querySelectorAll('#nav button').forEach((b) => {
  b.onclick = () => show(b.dataset.view);
});

// ---- start ----
call('status').then((st) => {
  showDbStatus(st);
  if (st && st.connected) refresh();
});
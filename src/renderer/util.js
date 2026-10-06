// shortcut for document.getElementById
const $ = (id) => document.getElementById(id);

// build an element: el('p', 'muted', 'hello') -> <p class="muted">hello</p>
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
};

//TOAST
// // a message in the corner that disappears after 4 seconds

let showTimer, endTimer;

function resetToast(t) {
  clearTimeout(showTimer);
  clearTimeout(endTimer);
  t.classList.remove('is-destroying');
  t.querySelector('.disintegrate-container')?.remove();
}

function toast(msg, ok) {

  // Create layout with the image and text wrapper
  // (built with textContent, not innerHTML, so a message containing < or & can never be read as HTML)

  const t = $('toast');
  resetToast(t); // cancel any previous toast's timers and particles

  const icon = el('img', 'toast-icon');
  icon.src = 'art/eye-icon.png';
  icon.alt = '';
  t.replaceChildren(icon, el('span', '', msg));
  t.className = ok ? 'ok' : '';

  if (t.matches(':popover-open')) t.hidePopover();
  t.showPopover();

  // 0–2s: shown normally
  showTimer = setTimeout(() => disintegrateToast(t, 2000), 2000);
}

function disintegrateToast(t, duration = 2000) {
  // Get layout boundaries
  const { width, height } = t.getBoundingClientRect();
  const pixelSize = 8;
  const rows = Math.ceil(height / pixelSize);
  const cols = Math.ceil(width / pixelSize);

  // read the real colour BEFORE adding .is-destroying makes it transparent
  const bg = getComputedStyle(t).backgroundColor;

  // Create fragment wrapper 

  const container = document.createElement('div');
  container.className = 'disintegrate-container';
  container.style.setProperty('--pixel-size', `${pixelSize}px`);  // NEW
  const frag = document.createDocumentFragment();

  const maxDelay = duration * 0.6;
  const animTime = duration * 0.4;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = document.createElement('span');
      p.className = 'pixel-dust';
      p.style.top = `${r * pixelSize}px`;
      p.style.left = `${c * pixelSize}px`;
      // clamp edge pixels so they don't poke out past the toast
      p.style.width = `${Math.min(pixelSize, width - c * pixelSize)}px`;
      p.style.height = `${Math.min(pixelSize, height - r * pixelSize)}px`;
      p.style.setProperty('--color', bg);                          // CHANGED
      const angle = Math.random() * Math.PI * 2;
      const dist = 40 + Math.random() * 120;
      p.style.setProperty('--x', `${Math.cos(angle) * dist}px`);
      p.style.setProperty('--y', `${Math.sin(angle) * dist}px`);
      p.style.animationDuration = `${animTime}ms`;
      p.style.animationDelay = `${Math.random() * maxDelay}ms`;
      frag.appendChild(p);
    }
  }
  container.appendChild(frag);
  t.appendChild(container);
  t.classList.add('is-destroying');

  endTimer = setTimeout(() => {
    t.hidePopover();
    resetToast(t);
  }, duration);
}




// call the main process; on failure show a toast and return null instead of throwing
async function call(name, ...args) {
  try {
    return await window.api[name](...args);
  } catch (e) {
    toast(String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''));
    return null;
  }
}

// "1 entry", "2 entries" is handled by passing the plural; default just adds "s"
const plural = (n, word, many = word + 's') => `${n} ${n === 1 ? word : many}`;

// 2026-09-20 -> "20 Sept 2026"
const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'date unknown';

// replacement for window.confirm: resolves true on OK, false on Cancel or Esc
// It returns a promise, which stays pending until the user decides what action to take
function ask(msg) {
  return new Promise((resolve) => {
    const d = $('confirm-dialog'), f = $('confirm-form');
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    $('confirm-msg').textContent = msg;
    f.onsubmit = (e) => { e.preventDefault(); finish(true); d.close(); };
    $('confirm-cancel').onclick = () => d.close();
    d.onclose = () => finish(false);
    d.showModal();
  });
}

// create the ep ref number for each ep
const epRef = (ep) => `MAG ${ep.number == null ? '???' : String(ep.number).padStart(3, '0')}`;


// sort by name helper
const byName = (a, b) => a.name.localeCompare(b.name);

// including the reference number makes every label unique
const entryLabel = (e) => `${e.name} (${e.ref})`;


// remember small things between launches (the id of the last statement you opened)
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* storage unavailable: carry on */ } },
};

// run fn only after the user has stopped typing for `ms` milliseconds
const debounce = (fn, ms) => {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
};

// when an entry was last touched, as a number you can sort on
const dateOf = (e) => new Date(e.updatedAt || e.createdAt || 0).getTime();


const isMinor = (e) => (e.tags || []).includes('minor');
const byImportance = (a, b) => (isMinor(a) - isMinor(b)) || byName(a, b);   // minor entries go last




// (Loaded via index.html)

// ---- database status banner (from step 4) ----
function showDbStatus(st) {
  if (!st) return;
  $('dbbar').hidden = st.connected;
  if (!st.connected) $('db-msg').textContent = `Can't open the archive database: ${st.error}`;
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

// window controls
document.querySelectorAll('.bar').forEach(bar => {
  if (bar.querySelector('.wc')) return;
  bar.insertAdjacentHTML('beforeend', `
    <div class="wc">
      <button data-act="minimize"></button>
      <button data-act="maximize"></button>
      <button data-act="close"></button>
    </div>
    `);
});

document.querySelectorAll('.wc button').forEach(b =>
  b.addEventListener('click', () => window.api[b.dataset.act]())
);


// wavewavewave
const canvas = document.getElementById('visualizer');
const ctx = canvas.getContext('2d');  // defines it as a 2d blank surface ie now drawing methods can be used through ctx

const PIXEL   = 3;    // screen pixels per canvas pixel
const BAR     = 2;    // bar width in canvas pixels
const GAP     = 1;    // gap between bars
const STEP_MS = 60;   // time between steps (lower = faster outward travel)
const color   = getComputedStyle(document.documentElement).getPropertyValue('--muted').trim();

let amps = [];                  // amps[0] = center, amps[n] = n bars out
let envelope = 0.3, target = 0.3;   // envelope -> current amplitude, target -> target amplitude

function resize() {   // runs whenever canvas ie window changes size    
  canvas.width  = Math.floor(canvas.clientWidth  / PIXEL);
  canvas.height = Math.floor(canvas.clientHeight / PIXEL);
  const half = Math.ceil(canvas.width / 2 / (BAR + GAP)) + 1;     // how many bars are needed on one side (+1 so that there is never a gap)
  amps = Array.from({ length: half }, (_, i) => amps[i] || 0);  // builds a new list for the resized length. existing value are preserved
}
new ResizeObserver(resize).observe(canvas);   //calls resize automatically whenever the canvas changes size
resize();  // makes sure size is proper right at the start too

// a slowly drifting loudness, with random jitter per bar, plus the odd spike
function nextAmp() {
  if (Math.random() < 0.12) target = Math.random() ** 1.5;   // pick a new loudness, mostly quieter ones  // Each call has a 12% chance of picking a new target loudness.
  envelope += (target - envelope) * 0.35;                    // glide toward it  // Moves envelope 35% of the way toward target each time
  let v = envelope * (0.3 + 0.7 * Math.random());            // to make neighbouring bars uneven
  if (Math.random() < 0.06) v = Math.min(1, v * 1.8);        // occasional spike - 6% chance - min fn ensures it doesnt exceed max height
  return v;
}

function step() {
  amps.unshift(nextAmp());   // new value enters at the center...
  amps.pop();                // ...everything else moves out one bar
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);  // wipes canvas
  ctx.fillStyle = color;

  const cx = Math.floor(canvas.width / 2);   // get centre point
  const cy = Math.floor(canvas.height / 2);

  for (let i = 0; i < amps.length; i++) {
    const fade = Math.sqrt(1 - i / amps.length);             // tapers toward the far ends
    const h = Math.max(1, Math.floor(amps[i] * fade * cy));
    const dx = i * (BAR + GAP);
    ctx.fillRect(cx + dx,       cy - h, BAR, h * 2);         // right side
    ctx.fillRect(cx - dx - BAR, cy - h, BAR, h * 2);         // left side (mirrored)
  }
}

let last = 0, acc = 0;
function loop(ts) {
  if (canvas.offsetParent !== null) {                        // skip work while the home view is hidden
    acc += Math.min(ts - last, 200);                         // clamp so a background tab doesn't cause a burst
    while (acc >= STEP_MS) { step(); acc -= STEP_MS; }
    draw();
  }
  last = ts;
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
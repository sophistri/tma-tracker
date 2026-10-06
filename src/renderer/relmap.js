// ---- the relation map: every linked entry is a box, every link is an arrow ----
// nothing here is stored. The picture is worked out from S.entities and S.links every time it's drawn.

let mapFocus = null;      // _id of the entry the map is centred on; null means show the whole archive
let mapDepth = 1;         // how many links away from the focused entry to include
let mapType = 'all';      // only show this type of entry ('all' or a key of TYPES)
let mapUnlinked = false;  // include entries that have no links at all (whole-archive mode only)
let mapMinor = store.get('mapMinor') !== 'no'; // independent setting, defaults to true
let mapFit = { x: 0, y: 0, w: 1000, h: 700 };   // the view that fits everything: the Fit button goes back to it
let mapBox = { x: 0, y: 0, w: 1000, h: 700 };   // the part of the drawing you can currently see (the SVG viewBox)

const SVG_NS = 'http://www.w3.org/2000/svg';
// like el(), but for SVG elements, which have to be made with createElementNS
const svgEl = (tag, attrs = {}) => {
  const n = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
};

const entById = (id) => S.entities.find((e) => e._id === id);

// SVG can't size a box to its text, so estimate the width from the name
const BOX_H = 28;
const boxW = (name) => Math.max(80, Math.min(name.length, 24) * 8 + 24);
const shortName = (name) => (name.length > 24 ? name.slice(0, 23) + '…' : name);

// called from an entry's "Show on map" button
function focusMap(id) {
  mapFocus = id;
  show('map');
}

// ---- 1. which entries and links to draw ----
function mapGraph() {
  const byId = new Map(S.entities.map((e) => [e._id, e]));
  const edges = S.links.filter((l) => byId.has(l.a) && byId.has(l.b));
  // minor entries follow the map's own show/hide switch
  const allowed = (e) => (mapMinor || !isMinor(e)) && (mapType === 'all' || e.type === mapType);

  // focused: walk outwards from the entry, one link at a time, up to mapDepth steps
  if (mapFocus && byId.has(mapFocus)) {
    const depthOf = new Map([[mapFocus, 0]]);
    let frontier = [mapFocus];
    for (let step = 1; step <= mapDepth; step++) {
      const next = [];
      edges.forEach((l) => {
        [[l.a, l.b], [l.b, l.a]].forEach(([from, to]) => {
          if (frontier.includes(from) && !depthOf.has(to) && allowed(byId.get(to))) {
            depthOf.set(to, step);
            next.push(to);
          }
        });
      });
      frontier = next;
    }
    return {
      nodes: [...depthOf.keys()].map((id) => byId.get(id)),
      links: edges.filter((l) => depthOf.has(l.a) && depthOf.has(l.b)),
      depthOf,
    };
  }

  // not focused: everything that has a link (or everything, if asked)
  const linked = new Set(edges.flatMap((l) => [l.a, l.b]));
  const nodes = S.entities.filter((e) => allowed(e) && (mapUnlinked || linked.has(e._id)));
  const ids = new Set(nodes.map((e) => e._id));
  return { nodes, links: edges.filter((l) => ids.has(l.a) && ids.has(l.b)), depthOf: null };
}

// ---- 2. where to put them ----
// A simple force layout: every box pushes every other box away, every link pulls its two ends together,
// and the whole thing "cools down" until it settles. No library needed.
function forceLayout(nodes, links, depthOf) {
  const n = nodes.length;
  // two links between the same pair would pull twice as hard and squash them together, so pull once per pair
  const pulls = [...new Map(links.map((l) => [[l.a, l.b].sort().join('|'), l])).values()];
  const side = Math.max(300, Math.sqrt(n) * 150);     // the working area grows with the number of boxes
  const W = side * 1.4, H = side;
  const sorted = [...nodes].sort(byName);              // a fixed order, so the same data always gives the same picture
  const pos = new Map();

  // About 137.5 degrees. Each new box goes this far round from the last, so no two ever start in line with the middle.
  // (evenly spaced starting points are symmetrical, and a symmetrical layout can get stuck with boxes sitting on top of each other's links)
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));

  if (depthOf) {
    // focused: start with rings. ring 0 is the entry itself, ring 1 its neighbours, ring 2 theirs...
    const rings = {};
    sorted.forEach((e) => (rings[depthOf.get(e._id)] ||= []).push(e));
    Object.entries(rings).forEach(([d, list]) => list.forEach((e, i) => {
      const a = i * GOLDEN + Number(d), r = d * 230;
      pos.set(e._id, { x: W / 2 + Math.cos(a) * r, y: H / 2 + Math.sin(a) * r, dx: 0, dy: 0 });
    }));
  } else {
    // everything: start in a sunflower spiral
    sorted.forEach((e, i) => {
      const a = i * GOLDEN, r = 70 * Math.sqrt(i + 1);
      pos.set(e._id, { x: W / 2 + Math.cos(a) * r, y: H / 2 + Math.sin(a) * r, dx: 0, dy: 0 });
    });
  }

  const k = 150;   // the length of line linked boxes would like between their edges (room for the words on it)
  const wOf = new Map(sorted.map((e) => [e._id, boxW(e.name)]));
  // how far from a box's middle to its edge, going in direction (ux, uy): lets the forces measure the visible gap, not the middle-to-middle gap
  const reach = (w, ux, uy) => Math.min(ux ? w / 2 / Math.abs(ux) : Infinity, uy ? BOX_H / 2 / Math.abs(uy) : Infinity);
  const pinned = depthOf ? mapFocus : null;                        // the focused entry stays in the middle
  const iterations = n > 300 ? 80 : 250;
  let temp = W / 10;                                               // the most a box may move in one step; shrinks over time

  for (let it = 0; it < iterations; it++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {                            // every pair pushes apart
        const a = pos.get(sorted[i]._id), b = pos.get(sorted[j]._id);
        let dx = a.x - b.x, dy = a.y - b.y;
        const d = Math.hypot(dx, dy) || 0.01;
        dx /= d; dy /= d;
        const gap = Math.max(d - reach(wOf.get(sorted[i]._id), dx, dy) - reach(wOf.get(sorted[j]._id), dx, dy), 4);
        const f = Math.min((k * k) / gap, k * 6);                  // closer edges push harder (capped so it can't explode)
        a.dx += dx * f; a.dy += dy * f; b.dx -= dx * f; b.dy -= dy * f;
      }
    }
    pulls.forEach((l) => {                                         // every link pulls its ends together
      const a = pos.get(l.a), b = pos.get(l.b);
      let dx = a.x - b.x, dy = a.y - b.y;
      const d = Math.hypot(dx, dy) || 0.01;
      dx /= d; dy /= d;
      const gap = Math.max(d - reach(wOf.get(l.a), dx, dy) - reach(wOf.get(l.b), dx, dy), 0);
      const f = (gap * gap) / k;
      a.dx -= dx * f; a.dy -= dy * f; b.dx += dx * f; b.dy += dy * f;
    });
    pos.forEach((p, id) => {                                       // move, with a gentle pull to the middle
      p.dx -= (p.x - W / 2) * 0.02;
      p.dy -= (p.y - H / 2) * 0.02;
      if (id !== pinned) {
        const d = Math.hypot(p.dx, p.dy) || 0.01, m = Math.min(d, temp);
        p.x += (p.dx / d) * m;
        p.y += (p.dy / d) * m;
      }
      p.dx = p.dy = 0;
    });
    temp *= 0.97;
  }

  // a few passes that nudge any overlapping boxes apart
  for (let pass = 0; pass < 40; pass++) {
    let moved = false;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = pos.get(sorted[i]._id), b = pos.get(sorted[j]._id);
        const ox = (boxW(sorted[i].name) + boxW(sorted[j].name)) / 2 + 24 - Math.abs(a.x - b.x);
        const oy = BOX_H + 24 - Math.abs(a.y - b.y);
        if (ox > 0 && oy > 0) {
          moved = true;
          if (ox < oy) { const s = (a.x < b.x ? -1 : 1) * (ox / 2); a.x += s; b.x -= s; }
          else { const s = (a.y < b.y ? -1 : 1) * (oy / 2); a.y += s; b.y -= s; }
        }
      }
    }
    if (!moved) break;
  }
  return pos;
}

// split the entries into groups that are connected to each other (a group has no links to any other group)
function connectedGroups(nodes, links) {
  const byId = new Map(nodes.map((e) => [e._id, e]));
  const next = new Map(nodes.map((e) => [e._id, []]));
  links.forEach((l) => { next.get(l.a).push(l.b); next.get(l.b).push(l.a); });
  const seen = new Set(), groups = [];
  nodes.forEach((start) => {
    if (seen.has(start._id)) return;
    const ids = [start._id];
    seen.add(start._id);
    for (let i = 0; i < ids.length; i++) {                  // ids grows while we walk it: a simple queue
      next.get(ids[i]).forEach((to) => { if (!seen.has(to)) { seen.add(to); ids.push(to); } });
    }
    const set = new Set(ids);
    groups.push({ nodes: ids.map((id) => byId.get(id)), links: links.filter((l) => set.has(l.a)) });
  });
  return groups;
}

function layoutGraph(nodes, links, depthOf) {
  if (depthOf) return forceLayout(nodes, links, depthOf);   // focused: one connected picture

  // everything: lay each connected group out on its own, then pack the groups into rows.
  // (laid out together, unconnected groups just drift apart and the whole drawing shrinks to nothing)
  const placed = connectedGroups(nodes, links)
    .sort((a, b) => b.nodes.length - a.nodes.length)        // biggest groups first
    .map((g) => {
      const local = forceLayout(g.nodes, g.links, null);
      const xs = g.nodes.flatMap((e) => [local.get(e._id).x - boxW(e.name) / 2, local.get(e._id).x + boxW(e.name) / 2]);
      const ys = g.nodes.flatMap((e) => [local.get(e._id).y - BOX_H / 2, local.get(e._id).y + BOX_H / 2]);
      return { g, local, x0: Math.min(...xs), y0: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    });

  const pos = new Map();
  const GAP = 70, ROW_W = 1600;
  let x = 0, y = 0, rowH = 0;
  placed.forEach((c) => {
    if (x > 0 && x + c.w > ROW_W) { x = 0; y += rowH + GAP; rowH = 0; }   // start a new row
    c.g.nodes.forEach((e) => {
      const p = c.local.get(e._id);
      pos.set(e._id, { x: x + (p.x - c.x0), y: y + (p.y - c.y0) });
    });
    x += c.w + GAP;
    rowH = Math.max(rowH, c.h);
  });
  return pos;
}

// the point where a line from the middle of a box towards (tx, ty) leaves the box's edge
function edgePoint(cx, cy, w, h, tx, ty) {
  const dx = tx - cx, dy = ty - cy;
  if (!dx && !dy) return { x: cx, y: cy };
  const s = Math.min(w / 2 / (Math.abs(dx) || 1e-9), h / 2 / (Math.abs(dy) || 1e-9));
  return { x: cx + dx * s, y: cy + dy * s };
}

// ---- 3. drawing ----
function renderMap() {
  const svg = $('map-svg');
  const { nodes, links, depthOf } = mapGraph();

  // controls follow the state variables
  $('ent-names').replaceChildren(...S.entities.map((x) => {   // the focus box suggests entries, like the cross-reference box does
    const o = document.createElement('option');
    o.value = entryLabel(x);
    return o;
  }));
  $('map-type').replaceChildren(new Option('All types', 'all'), ...Object.entries(TYPES).map(([key, t]) => new Option(t.label, key)));$('map-type').value = mapType;
  $('map-depth').value = String(mapDepth);$('map-unlinked').checked = mapUnlinked;
  if ($('map-minor'))$('map-minor').checked = mapMinor;
  $('map-focus').value = mapFocus && entById(mapFocus) ? entryLabel(entById(mapFocus)) : '';
  $('map-depth').disabled = !mapFocus;
  $('map-unlinked').disabled = !!mapFocus;
  $('map-open').hidden = !mapFocus;
  $('map-clear').hidden = !mapFocus;

  svg.replaceChildren();
  svg.classList.remove('hovering');
  $('map-empty').hidden = nodes.length > 0;
  $('map-legend').replaceChildren();
  if (!nodes.length) { $('map-info').textContent = ''; return; }

  const pos = layoutGraph(nodes, links, depthOf);
  const width = (e) => boxW(e.name);
  const byId = new Map(nodes.map((e) => [e._id, e]));

  // an arrowhead, used at the end of every link
  const defs = svgEl('defs');
  const marker = svgEl('marker', { id: 'arrow', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '8', markerHeight: '8', orient: 'auto-start-reverse' });   // auto-start-reverse: the same arrow also works at the start of a line
  marker.append(svgEl('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: '#c9a878' }));
  defs.append(marker);
  svg.append(defs);

  // links first, so the boxes sit on top of the line ends
  const seen = {};
  links.forEach((l) => {
    const a = pos.get(l.a), b = pos.get(l.b), ea = byId.get(l.a), eb = byId.get(l.b);
    const from = edgePoint(a.x, a.y, width(ea), BOX_H, b.x, b.y);
    const to = edgePoint(b.x, b.y, width(eb), BOX_H, a.x, a.y);
    const key = [l.a, l.b].sort().join('|');
    const nth = (seen[key] = (seen[key] || 0) + 1) - 1;   // stagger the words when two entries share several links

    const g = svgEl('g', { class: 'medge' + (l.mutual ? ' mutual' : ''), 'data-a': l.a, 'data-b': l.b });
    const line = svgEl('line', { x1: from.x, y1: from.y, x2: to.x, y2: to.y, 'marker-end': 'url(#arrow)' });
    if (l.mutual) line.setAttribute('marker-start', 'url(#arrow)');   // a two-way link points both ways
    g.append(line);
    if (l.kind) {
      const t = svgEl('text', { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - 6 + nth * 15 });
      t.textContent = l.kind;
      g.append(t);
    }
    svg.append(g);
  });

  // then the boxes
  nodes.forEach((e) => {
    const p = pos.get(e._id), w = width(e);
    const g = svgEl('g', { class: 'mnode' + (e._id === mapFocus ? ' focus' : '') + (isMinor(e) ? ' minor' : ''), 'data-id': e._id,
      transform: `translate(${p.x - w / 2} ${p.y - BOX_H / 2})` });
    g.append(svgEl('rect', { width: w, height: BOX_H, fill: typeOf(e.type).color }));
    const t = svgEl('text', { x: w / 2, y: BOX_H / 2 + 5 });
    t.textContent = shortName(e.name);
    const tip = svgEl('title');
    tip.textContent = `${e.ref} · ${typeOf(e.type).one}${e._id === mapFocus ? ' (click to open)' : ' (click to focus)'}`;
    g.append(t, tip);

    g.addEventListener('click', () => {
      if (e._id === mapFocus) return openEntry(e);   // clicking the focused entry opens it
      mapFocus = e._id;
      renderMap();
    });
    g.addEventListener('mouseenter', () => hoverNode(e._id, true));
    g.addEventListener('mouseleave', () => hoverNode(e._id, false));
    svg.append(g);
  });

  // fit the whole drawing in view
  const xs = nodes.flatMap((e) => [pos.get(e._id).x - width(e) / 2, pos.get(e._id).x + width(e) / 2]);
  const ys = nodes.flatMap((e) => [pos.get(e._id).y - BOX_H / 2, pos.get(e._id).y + BOX_H / 2]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const w = Math.max(maxX - minX + 80, 400), h = Math.max(maxY - minY + 80, 260);
  mapBox = { x: (minX + maxX) / 2 - w / 2, y: (minY + maxY) / 2 - h / 2, w, h };
  mapFit = { ...mapBox };
  applyBox();

  // a short sentence under the controls, and a key to the colours in use
  const counts = `${plural(nodes.length, 'entry', 'entries')}, ${plural(links.length, 'link')}`;
  $('map-info').textContent = mapFocus
    ? `${entryLabel(entById(mapFocus))} and everything within ${plural(mapDepth, 'link')}: ${counts}`
    : `${counts}${mapUnlinked ? '' : ' (entries with no links are hidden)'}`;
  const used = [...new Set(nodes.map((e) => e.type))];
  $('map-legend').replaceChildren(...used.map((key) => {
    const chip = el('span', 'legend-chip', typeOf(key).one);
    chip.style.borderLeftColor = typeOf(key).color;
    return chip;
  }));
}

const applyBox = () => $('map-svg').setAttribute('viewBox', `${mapBox.x} ${mapBox.y} ${mapBox.w} ${mapBox.h}`);

// pointing at a box lights it and its links, and dims everything else
function hoverNode(id, on) {
  const svg = $('map-svg');
  svg.classList.toggle('hovering', on);
  svg.querySelectorAll('.lit').forEach((n) => n.classList.remove('lit'));
  if (!on) return;
  svg.querySelector(`.mnode[data-id="${id}"]`).classList.add('lit');
  svg.querySelectorAll('.medge').forEach((g) => {
    if (g.dataset.a !== id && g.dataset.b !== id) return;
    g.classList.add('lit');
    [g.dataset.a, g.dataset.b].forEach((x) => svg.querySelector(`.mnode[data-id="${x}"]`).classList.add('lit'));
  });
}

// ---- zoom with the wheel, drag the background to move around ----
function svgPoint(ev) {
  const svg = $('map-svg');
  const pt = svg.createSVGPoint();
  pt.x = ev.clientX;
  pt.y = ev.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());   // screen pixels -> drawing coordinates
}

// scale the visible area by k around the point (px, py), so that point stays where it is on screen
// (k below 1 zooms in, above 1 zooms out)
function zoomAt(px, py, k) {
  const w = mapBox.w * k;
  if (w < 120 || w > 60000) return;   // don't zoom into a speck, or out into nothing
  mapBox = { x: px - (px - mapBox.x) * k, y: py - (py - mapBox.y) * k, w, h: mapBox.h * k };
  applyBox();
}

$('map-svg').addEventListener('wheel', (ev) => {
  ev.preventDefault();
  const p = svgPoint(ev);
  zoomAt(p.x, p.y, ev.deltaY < 0 ? 0.85 : 1 / 0.85);   // zoom around the cursor
}, { passive: false });

// the buttons zoom around the middle of what you can see
const zoomMiddle = (k) => zoomAt(mapBox.x + mapBox.w / 2, mapBox.y + mapBox.h / 2, k);
$('map-zoom-in').onclick = () => zoomMiddle(0.8);
$('map-zoom-out').onclick = () => zoomMiddle(1 / 0.8);$('map-fit').onclick = () => { mapBox = { ...mapFit }; applyBox(); };

$('map-svg').addEventListener('mousedown', (ev) => {
  if (ev.button !== 0 || ev.target.closest('.mnode')) return;
  const svg = $('map-svg'), r = svg.getBoundingClientRect();
  const unitsPerPixel = Math.max(mapBox.w / r.width, mapBox.h / r.height);
  const start = { cx: ev.clientX, cy: ev.clientY, x: mapBox.x, y: mapBox.y };
  svg.classList.add('panning');
  const move = (m) => {
    mapBox.x = start.x - (m.clientX - start.cx) * unitsPerPixel;
    mapBox.y = start.y - (m.clientY - start.cy) * unitsPerPixel;
    applyBox();
  };
  const up = () => {
    removeEventListener('mousemove', move);
    removeEventListener('mouseup', up);
    svg.classList.remove('panning');
  };
  addEventListener('mousemove', move);
  addEventListener('mouseup', up);
});

// ---- the controls ----
// 'change' (not 'input'): only react once the user has finished typing or picked a suggestion
$('map-focus').addEventListener('change', () => {
  const typed = $('map-focus').value.trim().toLowerCase();
  if (!typed) { mapFocus = null; return renderMap(); }
  const hit = S.entities.find((x) => entryLabel(x).toLowerCase() === typed)
    || S.entities.find((x) => (x.ref || '').toLowerCase() === typed)
    || S.entities.find((x) => x.name.toLowerCase() === typed);
  if (!hit) return toast('No entry matches. Pick one from the suggestions.');
  mapFocus = hit._id;
  renderMap();
});
$('map-depth').onchange = () => { mapDepth = Number($('map-depth').value); renderMap(); };
$('map-type').onchange = () => { mapType =$('map-type').value; renderMap(); };
$('map-unlinked').onchange = () => { mapUnlinked =$('map-unlinked').checked; renderMap(); };
if ($('map-minor')) {$('map-minor').onchange = () => {
    mapMinor = $('map-minor').checked;
    store.set('mapMinor', mapMinor ? 'yes' : 'no');
    renderMap();
  };
}
$('map-clear').onclick = () => { mapFocus = null; renderMap(); };$('map-open').onclick = () => { if (entById(mapFocus)) openEntry(entById(mapFocus)); };
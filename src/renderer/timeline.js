// ---- the timeline: worked out from the dates you've already typed in, never stored ----
// events (entries of type Event) use their From / To dates; statements use "Events took place on" and "Statement given on"

let tlMode = 'time';                                  // 'time' = by date, 'episodes' = by episode number
const tlKinds = { event: true, happened: true, given: true };   // which kinds of item are switched on

const TL_KINDS = {
  event:    { label: 'Events',                  color: '#7FB2D0' },
  happened: { label: 'Statements: took place',  color: '#E6D27A' },
  given:    { label: 'Statements: given',       color: '#55ADB6' },
};

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// Turn whatever was typed into something sortable, or null if there's no usable year.
// Understands 2012, 2012-04, 2012-04-22, "April 22nd, 2012", "22 April 2012", "early 2010", "sometime in 1998"...
function parseWhen(text) {
  const t = String(text || '').trim().toLowerCase();
  if (!t) return null;
  let y, m = null, d = null;
  const iso = t.match(/^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/);
  if (iso) {
    y = +iso[1];
    m = iso[2] ? +iso[2] : null;
    d = iso[3] ? +iso[3] : null;
  } else {
    const year = t.match(/\b(\d{4})\b/);
    if (!year) return null;                           // "the 90s" or "unknown": no year, so it can't be placed
    y = +year[1];
    const month = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/);
    if (month) {
      m = MONTHS.indexOf(month[1]) + 1;
      const day = t.replace(year[0], ' ').match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);   // a day only counts next to a month
      if (day && +day[1] >= 1 && +day[1] <= 31) d = +day[1];
    }
  }
  if (m !== null && (m < 1 || m > 12)) return null;
  return { y, m, d, key: y * 10000 + (m || 0) * 100 + (d || 0) };   // 2012-04-22 -> 20120422, so plain number sorting works
}

// every thing that can appear on the timeline, as one flat list
function timelineItems() {
  const items = [];

  S.entities.filter((e) => e.type === 'event').forEach((e) => {
    // the dates live in `f` (fromdate / todate); e.dates is where a future schema might put them
    const from = (e.dates && e.dates.from) || (e.f && e.f.fromdate) || '';
    const to = (e.dates && e.dates.to) || (e.f && e.f.todate) || '';
    items.push({
      kind: 'event', title: e.name, sub: [e.ref, ...(e.fears || [])].join(' · '),
      label: to && to !== from ? `${from} → ${to}` : from, when: parseWhen(from),
      color: TL_KINDS.event.color, open: () => openEntry(e),
    });
  });

  S.episodes.forEach((ep) => {
    const sub = [epRef(ep), ep.giver].filter(Boolean).join(' · ');
    items.push({ kind: 'happened', title: ep.title, sub, label: ep.actualDate || '', when: parseWhen(ep.actualDate),
      color: TL_KINDS.happened.color, open: () => gotoStatement(ep._id) });
    items.push({ kind: 'given', title: ep.title, sub, label: ep.statementDate || '', when: parseWhen(ep.statementDate),
      color: TL_KINDS.given.color, open: () => gotoStatement(ep._id) });
  });
  return items;
}

function tlButton(item) {
  const b = el('button', 'tl-item');
  b.style.borderLeftColor = item.color;
  const text = el('span', 'tl-text');
  text.append(el('strong', '', item.title), el('span', '', `${TL_KINDS[item.kind].label}${item.sub ? ' · ' + item.sub : ''}`));
  b.append(el('span', 'tl-when', item.label || 'no date'), text);
  b.onclick = item.open;
  return b;
}

function renderTimeline() {
  // the on/off chips
  $('tl-filters').replaceChildren(...Object.entries(TL_KINDS).map(([key, k]) => {
    const b = el('button', 'chip' + (tlKinds[key] ? ' on' : ''), k.label);
    b.style.borderLeft = `8px solid ${k.color}`;
    b.onclick = () => { tlKinds[key] = !tlKinds[key]; renderTimeline(); };
    return b;
  }));
  $('tl-filters').hidden = tlMode === 'episodes';
  $('tl-mode').value = tlMode;

  const list = $('tl-list');
  if (tlMode === 'episodes') return renderEpisodeOrder(list);

  const items = timelineItems().filter((i) => tlKinds[i.kind]);
  // an entry with no date at all isn't "wrong", just not placeable: leave out the empty statement slots, keep unreadable text visible
  const dated = items.filter((i) => i.when).sort((a, b) => a.when.key - b.when.key || a.title.localeCompare(b.title));
  const undated = items.filter((i) => !i.when && (i.kind === 'event' || i.label)).sort((a, b) => a.title.localeCompare(b.title));

  const out = [];
  let year = null;
  dated.forEach((i) => {
    if (i.when.y !== year) { year = i.when.y; out.push(el('h3', 'tl-year', String(year))); }
    out.push(tlButton(i));
  });
  if (undated.length) {
    out.push(el('h3', 'tl-year', 'No usable date'));
    out.push(el('p', 'tl-note', 'These have no year the timeline can read. Add one (e.g. "April 2012" or "2012-04-22") to place them.'));
    undated.forEach((i) => out.push(tlButton(i)));
  }
  list.replaceChildren(...(out.length ? out : [el('p', 'empty', 'Nothing to place yet. Add dates to statements, or From / To dates to Event entries.')]));
}

// episode order: by season, then number, with both dates shown on each row
function renderEpisodeOrder(list) {
  const eps = [...S.episodes].sort((a, b) => (a.season ?? 1e9) - (b.season ?? 1e9) || (a.number ?? 1e9) - (b.number ?? 1e9));
  const out = [];
  let season;
  eps.forEach((ep) => {
    if (ep.season !== season) {
      season = ep.season;
      out.push(el('h3', 'tl-year', season == null ? 'No season' : `Season ${season}`));
    }
    const b = el('button', 'tl-item');
    b.style.borderLeftColor = TL_KINDS.given.color;
    const text = el('span', 'tl-text');
    text.append(el('strong', '', ep.title),
      el('span', '', `Took place: ${ep.actualDate || 'unknown'} · Given: ${ep.statementDate || 'unknown'}`));
    b.append(el('span', 'tl-when', epRef(ep)), text);
    b.onclick = () => gotoStatement(ep._id);
    out.push(b);
  });
  list.replaceChildren(...(out.length ? out : [el('p', 'empty', 'No statements yet.')]));
}

$('tl-mode').onchange = () => { tlMode = $('tl-mode').value; renderTimeline(); };

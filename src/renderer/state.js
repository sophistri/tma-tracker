// the single source of truth: render functions read from this
const S = { entities: [], links: [], episodes: [] };

async function refresh() {
  const [entities, links, episodes] = await Promise.all([call('getEntities'), call('getLinks'), call('listEpisodes', '')]);
  if (!entities || !links || !episodes) return; // 'call' returned null: a toast already explained why
  S.entities = entities;
  S.links = links;
  S.episodes = episodes;
  renderAll();
}

// every view that draws from S gets called here; 
function renderAll() {
  const kinds = new Set([...KINDS, ...S.links.map((l) => l.kind).filter(Boolean)]);  // to autofill kinds of relationships
  $('kinds').replaceChildren(...[...kinds].map((k) => {
    const o = document.createElement('option');
    o.value = k;
    return o;
  }));
  renderCatalog();
  renderPanel();
  renderHome();
  if (view === 'map') renderMap();            // only the visible view needs redrawing
  if (view === 'timeline') renderTimeline();
  if ($('ent-dialog').open && editId) renderRels();
}
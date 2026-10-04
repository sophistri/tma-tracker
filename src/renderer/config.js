// each category: plain-English labels, a colour, and its extra fields (stored under `f`)
const TYPES = {
  person:  { label: 'People',       one: 'Person',  color: '#E8A25E', fields: [['allegiance', 'Allegiance'], ['status', 'Status']] },
  place:   { label: 'Places',       one: 'Place',   color: '#8FC1B0', fields: [['region', 'Region']] },
  fear:    { label: 'Fears',        one: 'Fear',    color: '#E2562B', fields: [['domain', 'Domain / hallmarks']] },
  entity:  { label: 'Entities',     one: 'Entity',  color: '#D98FA6', fields: [['nature', 'Nature / avatar of'], ['status', 'Status']] },
  object:  { label: 'Objects',      one: 'Object',  color: '#C9A66B', fields: [['origin', 'Origin'], ['holder', 'Current holder']] },
  group:   { label: 'Groups',       one: 'Group',   color: '#5FA8B3', fields: [['aims', 'Aims']] },
  event:   { label: 'Events',       one: 'Event',   color: '#7EA6D0', fields: [['fromdate', 'From Date'], ['todate', 'To Date']] },
  lore:    { label: 'Lore & rules', one: 'Lore',    color: '#B79BD6', fields: [] },
  notes:   { label: 'Notes',        one: 'Note',    color: '#E3C65A', fields: [['thoughts', 'Thoughts']] },
};

const FEARS = ['The Buried', 'The Corruption', 'The Dark', 'The Desolation', 'The End', 'The Eye', 'The Flesh',
  'The Hunt', 'The Lonely', 'The Slaughter', 'The Spiral', 'The Stranger', 'The Vast', 'The Web'];

const KINDS = ['statement giver of', 'works at', 'located at', 'serves', 'avatar of', 'owns',
  'ally of', 'enemy of', 'related to', 'killed', 'trapped in', 'friend of', 'sibling of', 'colleague of', 'married to'];

// words that read the same from both ends: typing one of these ticks "Two-way" for you
const TWO_WAY_KINDS = ['friend of', 'ally of', 'enemy of', 'related to', 'sibling of', 'colleague of', 'married to'];

// look up a type, falling back to person if the stored type is unknown
const typeOf = (t) => TYPES[t] || TYPES.person;
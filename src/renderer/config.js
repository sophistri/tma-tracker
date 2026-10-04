// each category: plain-English labels, a colour, and its extra fields (stored under `f`)
const TYPES = {
  person:  { label: 'People',       one: 'Person',  color: '#FAC89A', fields: [['allegiance', 'Allegiance'], ['status', 'Status']] },
  place:   { label: 'Places',       one: 'Place',   color: '#9AC2BA', fields: [['region', 'Region']] },
  fear:    { label: 'Fears',        one: 'Fear',    color: '#F0966E', fields: [['domain', 'Domain / hallmarks']] },
  entity:  { label: 'Entities',     one: 'Entity',  color: '#E8A1B5', fields: [['nature', 'Nature / avatar of'], ['status', 'Status']] },
  object:  { label: 'Objects',      one: 'Object',  color: '#F6EBDD', fields: [['origin', 'Origin'], ['holder', 'Current holder']] },
  group:   { label: 'Groups',       one: 'Group',   color: '#55ADB6', fields: [['aims', 'Aims']] },
  event:   { label: 'Events',       one: 'Event',   color: '#7FB2D0', fields: [['fromdate', 'From Date'], ['todate', 'To Date']] },
  lore:    { label: 'Lore & rules', one: 'Lore',    color: '#C8B6E2', fields: [] },
  notes:   { label: 'Notes',        one: 'Note',    color: '#E6D27A', fields: [['thoughts', 'Thoughts']] },
};

const FEARS = ['The Buried', 'The Corruption', 'The Dark', 'The Desolation', 'The End', 'The Eye', 'The Flesh',
  'The Hunt', 'The Lonely', 'The Slaughter', 'The Spiral', 'The Stranger', 'The Vast', 'The Web'];

const KINDS = ['statement giver of', 'works at', 'located at', 'serves', 'avatar of', 'owns',
  'ally of', 'enemy of', 'related to', 'killed', 'trapped in'];

// look up a type, falling back to person if the stored type is unknown
const typeOf = (t) => TYPES[t] || TYPES.person;
const FEARS = ['The Buried', 'The Corruption', 'The Dark', 'The Desolation', 'The End', 'The Eye', 'The Flesh',
  'The Hunt', 'The Lonely', 'The Slaughter', 'The Spiral', 'The Stranger', 'The Vast', 'The Web'];

// keep only known fears, once each
const cleanFears = (list) => [...new Set((Array.isArray(list) ? list : []).filter((f) => FEARS.includes(f)))];

// trimmed, lowercase, no duplicates, at most 12
const cleanTags = (list) =>
  [...new Set((Array.isArray(list) ? list : []).map((t) => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 12);

module.exports = { cleanFears, cleanTags };
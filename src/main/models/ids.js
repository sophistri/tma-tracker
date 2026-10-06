const { randomUUID } = require('node:crypto');

// Ids are random UUIDs kept as plain text.
// When data crosses IPC it's copied, and a class instance loses its type in the copy. 
// So we send ids as strings, and the page never needs to know what they look like.

const newId = () => randomUUID();

// rejecting anything that isn't shaped like one of our ids
// checkId also protects you from a malformed id crashing a query.
const checkId = (id) => {
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(String(id))) throw new Error('Bad id: ' + id);
  return String(id);
};

// copy only the listed keys from an object -- basically a whitelist
const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));

// turn a list of {key, value} rows into a Map of key -> [values]
const groupBy = (rows, key, value) => {
  const m = new Map();
  rows.forEach((r) => m.set(r[key], [...(m.get(r[key]) || []), r[value]]));
  return m;
};

// Notes from the MongoDB version of this file, kept because they still explain the thinking:
// string -> ObjectId, rejecting anything that isn't a 24-character hex id
// So we send ids as strings and convert back with oid when we query.
// oid also protects you from a malformed id crashing a query.
// document -> same document, with _id as a plain string
// (ids are UUID strings now, so there is nothing to convert back: checkId does the "reject anything malformed" part)

module.exports = { newId, checkId, pick, groupBy };

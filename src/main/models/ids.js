const { ObjectId } = require('mongodb');

// string -> ObjectId, rejecting anything that isn't a 24-character hex id

// When data crosses IPC it's copied, and a class instance loses its type in the copy. 
// So we send ids as strings and convert back with oid when we query. 

// oid also protects you from a malformed id crashing a query.

const oid = (id) => {
  if (!/^[a-f0-9]{24}$/i.test(String(id))) throw new Error('Bad id: ' + id);
  return new ObjectId(String(id));
};

// document -> same document, with _id as a plain string
const plain = (doc) => doc && { ...doc, _id: doc._id.toString() };

// copy only the listed keys from an object -- basically a whitelist
const pick = (obj, keys) =>
  Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));

module.exports = { oid, plain, pick };
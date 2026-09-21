'use strict';

/**
 * Removes keys starting with `$` or containing `.` from user-supplied objects,
 * which blocks NoSQL operator injection (`{"$gt": ""}`) without pulling in an
 * extra dependency. Runs on body, query and params before any controller.
 */
const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && (value.constructor === Object || value.constructor === undefined);

const sanitizeValue = (value) => {
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (!isPlainObject(value)) return value;

  const clean = {};
  for (const [key, nested] of Object.entries(value)) {
    if (key.startsWith('$') || key.includes('.')) continue;
    clean[key] = sanitizeValue(nested);
  }
  return clean;
};

const sanitizeRequest = (req, _res, next) => {
  if (req.body && typeof req.body === 'object') req.body = sanitizeValue(req.body);
  if (req.params && typeof req.params === 'object') {
    // Route params are primitives; only the keys matter here.
    for (const key of Object.keys(req.params)) {
      if (key.startsWith('$')) delete req.params[key];
    }
  }
  if (req.query && typeof req.query === 'object') {
    for (const key of Object.keys(req.query)) {
      if (key.startsWith('$') || key.includes('.')) delete req.query[key];
    }
  }
  next();
};

module.exports = sanitizeRequest;

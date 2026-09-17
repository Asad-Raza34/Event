'use strict';

const crypto = require('crypto');

const slugify = (value = '') =>
  String(value)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);

/** Uppercase alphanumeric code, e.g. `ES-8F3K2Q`. */
const humanCode = (prefix = 'ES', length = 6) => {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < length; i += 1) out += alphabet[crypto.randomInt(alphabet.length)];
  return `${prefix}-${out}`;
};

const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('hex');
const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

/** Return only the whitelisted keys that are present in `source`. */
const pick = (source = {}, keys = []) =>
  keys.reduce((acc, key) => {
    if (source[key] !== undefined) acc[key] = source[key];
    return acc;
  }, {});

/** Start/end of the day in UTC — used consistently for session/appointment dates. */
const startOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};
const endOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
};
const addDays = (date, days) => {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
};

/** `HH:mm` string → minutes since midnight (used for schedule overlap checks). */
const timeToMinutes = (time = '00:00') => {
  const [h, m] = String(time).split(':').map((n) => Number.parseInt(n, 10) || 0);
  return h * 60 + m;
};

const roundCurrency = (amount) => Math.round((Number(amount) + Number.EPSILON) * 100) / 100;

const formatCurrency = (amount, currency = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(amount) || 0);

/** Case-insensitive "contains" filter for a list of string fields. */
const regexFilter = (term, fields) => {
  const safe = String(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(safe, 'i');
  return { $or: fields.map((field) => ({ [field]: regex })) };
};

module.exports = {
  slugify,
  humanCode,
  randomToken,
  sha256,
  pick,
  startOfDay,
  endOfDay,
  addDays,
  timeToMinutes,
  roundCurrency,
  formatCurrency,
  regexFilter,
};

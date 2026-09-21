'use strict';

const config = require('../config');

/**
 * Normalise `?page=&limit=` query parameters into a Mongo skip/limit pair.
 */
const getPagination = (query = {}) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const requested = Number.parseInt(query.limit, 10) || config.pagination.defaultLimit;
  const limit = Math.min(Math.max(1, requested), config.pagination.maxLimit);
  return { page, limit, skip: (page - 1) * limit };
};

const buildMeta = (total, page, limit) => {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    total,
    count: total,
    page,
    limit,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

const paginated = (items, total, page, limit) => ({ items, meta: buildMeta(total, page, limit) });

/** Safe sort parser: only allows fields present in `allowed`. */
const getSort = (query = {}, allowed = ['createdAt'], fallback = '-createdAt') => {
  const raw = String(query.sort || fallback).trim();
  const field = raw.startsWith('-') ? raw.slice(1) : raw;
  if (!allowed.includes(field)) return fallback;
  return raw;
};

/** Escape user input before using it inside a RegExp. */
const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

module.exports = { getPagination, buildMeta, paginated, getSort, escapeRegex };

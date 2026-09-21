'use strict';

const { body, param, query, oneOf } = require('express-validator');

const objectId = (field, location = 'param') => {
  const chain = location === 'body' ? body(field) : location === 'query' ? query(field) : param(field);
  return chain.isMongoId().withMessage(`${field} must be a valid identifier`);
};

const optionalObjectId = (field, location = 'body') => {
  const chain = location === 'body' ? body(field) : query(field);
  return chain.optional({ values: 'falsy' }).isMongoId().withMessage(`${field} must be a valid identifier`);
};

const pagination = () => [
  query('page').optional().isInt({ min: 1 }).withMessage('page must be a positive number').toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100').toInt(),
];

const optionalBoolean = (field, location = 'body') => {
  const chain = location === 'body' ? body(field) : query(field);
  return chain.optional({ values: 'falsy' }).isBoolean().withMessage(`${field} must be true or false`).toBoolean();
};

const optionalString = (field, { max = 500, location = 'body' } = {}) => {
  const chain = location === 'body' ? body(field) : query(field);
  return chain.optional({ values: 'falsy' }).isString().trim().isLength({ max }).withMessage(`${field} must be at most ${max} characters`);
};

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

const time = (field, { optional = false, location = 'body' } = {}) => {
  const chain = location === 'body' ? body(field) : query(field);
  return (optional ? chain.optional({ values: 'falsy' }) : chain).matches(timePattern).withMessage(`${field} must use HH:mm format`);
};

const isoDate = (field, { optional = false, location = 'body' } = {}) => {
  const chain = location === 'body' ? body(field) : query(field);
  return (optional ? chain.optional({ values: 'falsy' }) : chain).isISO8601().withMessage(`${field} must be a valid date`).toDate();
};

module.exports = { objectId, optionalObjectId, pagination, optionalBoolean, optionalString, time, isoDate, oneOf, timePattern };

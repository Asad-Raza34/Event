'use strict';

const { validationResult } = require('express-validator');
const ApiError = require('../utils/ApiError');

/**
 * Runs a list of express-validator chains and converts failures into a single
 * 422 ApiError with a per-field `details` array the client can render inline.
 */
const validate = (validations = []) => async (req, _res, next) => {
  await Promise.all(validations.map((chain) => chain.run(req)));

  const result = validationResult(req);
  if (result.isEmpty()) return next();

  const details = result.array().map((error) => ({
    field: error.path || error.param,
    message: error.msg,
    location: error.location,
  }));

  return next(
    ApiError.unprocessable(details[0]?.message || 'Please check the highlighted fields', {
      details,
      code: 'VALIDATION_ERROR',
    }),
  );
};

module.exports = validate;

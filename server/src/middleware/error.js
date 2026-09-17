'use strict';

const mongoose = require('mongoose');
const multer = require('multer');
const config = require('../config');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { sendError } = require('../utils/apiResponse');

/** Mounted after all routes: anything reaching here does not exist. */
const notFound = (req, _res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} was not found`));
};

const humanizeField = (field = 'value') =>
  String(field)
    .replace(/\./g, ' › ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (char) => char.toUpperCase());

/** Translate framework/driver errors into safe, user-facing ApiErrors. */
const normalizeError = (error) => {
  if (error instanceof ApiError) return error;

  // Duplicate key — surface which value clashed, never the raw driver dump.
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue || {})[0] || 'value';
    const value = error.keyValue ? error.keyValue[field] : undefined;
    return ApiError.conflict(
      `${humanizeField(field)}${value ? ` "${value}"` : ''} is already in use`,
      { code: 'DUPLICATE_KEY', details: [{ field, message: 'Already in use' }] },
    );
  }

  if (error.name === 'ValidationError' && error.errors) {
    const details = Object.values(error.errors).map((item) => ({ field: item.path, message: item.message }));
    return ApiError.unprocessable(details[0]?.message || 'Validation failed', { code: 'MONGOOSE_VALIDATION', details });
  }

  if (error.name === 'CastError') {
    return ApiError.badRequest(`Invalid ${error.path || 'identifier'} provided`, { code: 'INVALID_ID' });
  }

  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    return ApiError.unauthorized('Your session is no longer valid. Please sign in again.');
  }

  if (error instanceof multer.MulterError) {
    const messages = {
      LIMIT_FILE_SIZE: `File is too large. Maximum size is ${config.uploads.maxFileSizeMb}MB`,
      LIMIT_FILE_COUNT: 'Too many files uploaded at once',
      LIMIT_UNEXPECTED_FILE: 'Unexpected file field in the upload',
    };
    const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return new ApiError(status, messages[error.code] || 'File upload failed', { code: error.code });
  }

  if (error.type === 'entity.too.large') {
    return new ApiError(413, 'The request payload is too large', { code: 'PAYLOAD_TOO_LARGE' });
  }

  if (error.message === 'UnsupportedMediaType') {
    return ApiError.badRequest('Unsupported file type uploaded', { code: 'UNSUPPORTED_FILE_TYPE' });
  }

  return error;
};

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  const error = normalizeError(err);

  if (!error.isOperational) {
    logger.error(`${req.method} ${req.originalUrl} failed:`, error);
  } else if (config.env === 'development') {
    logger.warn(`${req.method} ${req.originalUrl} → ${error.statusCode}: ${error.message}`);
  }

  const statusCode = error.statusCode || 500;
  const isServerError = statusCode >= 500;
  const message = error.expose === false || isServerError ? 'Something went wrong. Please try again later.' : error.message;

  return sendError(res, {
    statusCode,
    message,
    errors: error.details || (error.code ? [{ code: error.code, message: error.message }] : null),
  });
};

module.exports = { notFound, errorHandler, normalizeError };

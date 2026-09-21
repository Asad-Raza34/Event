'use strict';

/**
 * Operational (expected) API error. Errors thrown with this class are safe to
 * surface to clients; anything else is treated as a bug and masked by the
 * error-handling middleware.
 */
class ApiError extends Error {
  constructor(statusCode, message, options = {}) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = options.details || null;
    this.code = options.code || null;
    this.isOperational = true;
    this.expose = options.expose !== false;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Invalid request', options) {
    return new ApiError(400, message, options);
  }

  static unauthorized(message = 'Authentication required', options) {
    return new ApiError(401, message, options);
  }

  static forbidden(message = 'You do not have permission to perform this action', options) {
    return new ApiError(403, message, options);
  }

  static notFound(message = 'Resource not found', options) {
    return new ApiError(404, message, options);
  }

  static conflict(message = 'Resource already exists', options) {
    return new ApiError(409, message, options);
  }

  static unprocessable(message = 'Validation failed', options) {
    return new ApiError(422, message, options);
  }

  static tooManyRequests(message = 'Too many requests, please slow down', options) {
    return new ApiError(429, message, options);
  }

  static internal(message = 'Something went wrong', options) {
    return new ApiError(500, message, options);
  }

  static notImplemented(message = 'Not implemented', options) {
    return new ApiError(501, message, options);
  }
}

module.exports = ApiError;

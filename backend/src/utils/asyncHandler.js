'use strict';

/**
 * Wraps an async Express handler and forwards rejected promises to `next`,
 * so every controller can use plain async/await without try/catch noise.
 */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;

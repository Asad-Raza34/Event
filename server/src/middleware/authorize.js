'use strict';

const ApiError = require('../utils/ApiError');

/**
 * Restrict a route to the given roles.
 * Usage: router.post('/', protect, authorize('admin'), handler)
 */
const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(ApiError.unauthorized('Authentication required. Please sign in to continue.'));
  if (roles.length && !roles.includes(req.user.role)) {
    return next(ApiError.forbidden('You do not have permission to access this resource'));
  }
  return next();
};

/** Allow admins through, otherwise require the caller to own the resource. */
const authorizeOwnerOrAdmin = (resolveOwnerId) => async (req, _res, next) => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    if (req.user.role === 'admin') return next();
    const ownerId = await resolveOwnerId(req);
    if (!ownerId || String(ownerId) !== String(req.user._id)) {
      throw ApiError.forbidden('You can only access your own records');
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { authorize, authorizeOwnerOrAdmin };

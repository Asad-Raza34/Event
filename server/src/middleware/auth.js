'use strict';

const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { verifyAccessToken } = require('../utils/tokens');

const extractToken = (req) => {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  if (req.cookies && req.cookies.access_token) return req.cookies.access_token;
  return null;
};

const loadUser = async (payload) => {
  const user = await User.findById(payload.sub).select('+tokenVersion');
  if (!user) throw ApiError.unauthorized('This account no longer exists');
  if (!user.isActive) throw ApiError.forbidden('Your account has been deactivated. Contact support for help.');
  return user;
};

/** Require a valid access token; attaches `req.user`. */
const protect = asyncHandler(async (req, _res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized('Authentication required. Please sign in to continue.');
  const payload = verifyAccessToken(token);
  req.user = await loadUser(payload);
  req.auth = { token, payload };
  return next();
});

/** Attach `req.user` when a valid token is present, but never reject. */
const optionalAuth = async (req, _res, next) => {
  try {
    const token = extractToken(req);
    if (!token) return next();
    const payload = verifyAccessToken(token);
    req.user = await loadUser(payload);
  } catch {
    req.user = null;
  }
  return next();
};

module.exports = { protect, optionalAuth, extractToken };

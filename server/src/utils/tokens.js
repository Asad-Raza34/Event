'use strict';

const jwt = require('jsonwebtoken');
const config = require('../config');
const ApiError = require('./ApiError');

const signAccessToken = (user) =>
  jwt.sign({ sub: String(user._id), role: user.role, type: 'access' }, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn,
    issuer: config.jwt.issuer,
  });

const signRefreshToken = (user) =>
  jwt.sign(
    { sub: String(user._id), type: 'refresh', ver: user.tokenVersion || 0 },
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn, issuer: config.jwt.issuer },
  );

const verifyAccessToken = (token) => {
  try {
    const payload = jwt.verify(token, config.jwt.accessSecret, { issuer: config.jwt.issuer });
    if (payload.type !== 'access') throw new Error('wrong token type');
    return payload;
  } catch (error) {
    throw ApiError.unauthorized(
      error.name === 'TokenExpiredError' ? 'Session expired, please sign in again' : 'Invalid authentication token',
      { code: error.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID' },
    );
  }
};

const verifyRefreshToken = (token) => {
  try {
    const payload = jwt.verify(token, config.jwt.refreshSecret, { issuer: config.jwt.issuer });
    if (payload.type !== 'refresh') throw new Error('wrong token type');
    return payload;
  } catch {
    throw ApiError.unauthorized('Invalid or expired session, please sign in again', { code: 'REFRESH_INVALID' });
  }
};

const refreshCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: config.isProd,
  path: config.jwt.refreshCookiePath,
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

module.exports = { signAccessToken, signRefreshToken, verifyAccessToken, verifyRefreshToken, refreshCookieOptions };

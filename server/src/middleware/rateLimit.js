'use strict';

const rateLimit = require('express-rate-limit');
const config = require('../config');

const base = {
  standardHeaders: true,
  legacyHeaders: false,
  // Tests hammer the API on purpose; limiting there would only add flakiness.
  skip: () => config.isTest,
};

const apiLimiter = rateLimit({
  ...base,
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.max,
  message: { success: false, message: 'Too many requests. Please slow down and try again shortly.' },
});

/** Stricter limiter for login/registration/password-reset attempts. */
const authLimiter = rateLimit({
  ...base,
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMax,
  message: { success: false, message: 'Too many authentication attempts. Please try again later.' },
});

/** Very strict limiter for AI chat, which may call an external provider. */
const aiLimiter = rateLimit({
  ...base,
  windowMs: 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many assistant requests. Please wait a moment.' },
});

module.exports = { apiLimiter, authLimiter, aiLimiter };

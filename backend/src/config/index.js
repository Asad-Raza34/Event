'use strict';

require('dotenv').config();

const path = require('path');

const toBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
};

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const NODE_ENV = process.env.NODE_ENV || 'development';
const isProd = NODE_ENV === 'production';
const isTest = NODE_ENV === 'test';

const warnings = [];
const secret = (envName, fallback) => {
  const value = process.env[envName];
  if (value && value.length >= 16) return value;
  if (isProd) {
    warnings.push(`${envName} is missing or too short — using an insecure development fallback.`);
  }
  return fallback;
};

const config = {
  env: NODE_ENV,
  isProd,
  isTest,
  port: toInt(process.env.PORT, 5000),
  apiPrefix: process.env.API_PREFIX || '/api',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  allowedOrigins: (process.env.CLIENT_URL || 'http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),

  db: {
    uri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/eventsphere',
    allowInMemory: toBool(process.env.ALLOW_IN_MEMORY_DB, !isProd),
    seedOnInMemory: toBool(process.env.SEED_ON_IN_MEMORY, !isProd),
  },

  jwt: {
    accessSecret: secret('JWT_ACCESS_SECRET', 'eventsphere-dev-access-secret-change-me'),
    accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    refreshSecret: secret('JWT_REFRESH_SECRET', 'eventsphere-dev-refresh-secret-change-me'),
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    issuer: process.env.JWT_ISSUER || 'eventsphere',
    refreshCookieName: 'es_refresh',
    refreshCookiePath: '/api/auth',
  },

  uploads: {
    dir: path.resolve(__dirname, '..', '..', process.env.UPLOAD_DIR || 'uploads'),
    publicPath: '/uploads',
    maxFileSizeMb: toInt(process.env.MAX_FILE_SIZE_MB, 5),
    allowedMimeTypes: [
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'image/gif',
      'image/svg+xml',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ],
  },

  payments: {
    provider: (process.env.PAYMENT_PROVIDER || 'mock').toLowerCase(),
    currency: (process.env.PAYMENT_CURRENCY || 'USD').toUpperCase(),
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    taxRatePercent: toInt(process.env.PAYMENT_TAX_PERCENT, 0),
  },

  ai: {
    provider: (process.env.AI_PROVIDER || 'local').toLowerCase(),
    openaiKey: process.env.OPENAI_API_KEY || '',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    anthropicKey: process.env.ANTHROPIC_API_KEY || '',
    anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-latest',
    maxContextItems: 40,
  },

  mail: {
    from: process.env.MAIL_FROM || 'EventSphere <no-reply@eventsphere.local>',
    host: process.env.SMTP_HOST || '',
    port: toInt(process.env.SMTP_PORT, 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    secure: toBool(process.env.SMTP_SECURE, false),
    get enabled() {
      return Boolean(this.host);
    },
  },

  demoMode: toBool(process.env.DEMO_MODE, !isProd),
  // Organizer self-registration is gated behind an invite code.
  adminInviteCode: process.env.ADMIN_INVITE_CODE || (isProd ? '' : 'EVENTSPHERE-ADMIN'),
  rateLimit: {
    windowMs: toInt(process.env.RATE_LIMIT_WINDOW_MINUTES, 15) * 60 * 1000,
    max: toInt(process.env.RATE_LIMIT_MAX, 600),
    authMax: toInt(process.env.AUTH_RATE_LIMIT_MAX, 30),
  },
  scheduler: {
    enabled: toBool(process.env.SCHEDULER_ENABLED, !isTest),
    intervalMs: toInt(process.env.SCHEDULER_INTERVAL_MS, 60 * 1000),
    sessionReminderLeadMinutes: 30,
  },
  pagination: {
    defaultLimit: 12,
    maxLimit: 100,
  },
  warnings,
};

module.exports = config;

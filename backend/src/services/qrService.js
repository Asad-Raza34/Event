'use strict';

const QRCode = require('qrcode');
const ApiError = require('../utils/ApiError');

/** Namespaced payloads keep scanned data unambiguous and easy to validate. */
const PREFIX = 'eventsphere';

const buildPassPayload = ({ registration, user, expo }) =>
  [
    PREFIX,
    'pass',
    registration.passCode,
    String(registration._id),
    String(expo?._id || registration.expo),
    String(user?._id || registration.user),
  ].join(':');

const buildBoothPayload = ({ booth, expo }) => [PREFIX, 'booth', String(booth._id), String(expo?._id || booth.expo), booth.zone, booth.number].join(':');

const buildSessionPayload = ({ session, expo }) => [PREFIX, 'session', String(session._id), String(expo?._id || session.expo)].join(':');

/** Parse a scanned string into a typed payload, or throw a 400. */
const parsePayload = (raw) => {
  if (!raw || typeof raw !== 'string') throw ApiError.badRequest('No QR value received');
  const value = raw.trim();

  // Plain JSON payloads are accepted too (useful for third-party scanners).
  if (value.startsWith('{')) {
    try {
      const parsed = JSON.parse(value);
      if (parsed && (parsed.code || parsed.passCode)) {
        return { type: parsed.type || 'pass', code: parsed.code || parsed.passCode, ...parsed };
      }
    } catch {
      /* fall through to the namespaced format */
    }
  }

  // Staff can also type the printed pass code (e.g. ES-8F3K2Q) instead of
  // scanning, so accept the raw human-readable form as well.
  const plainPass = value.match(/^ES-[A-Z0-9]{4,12}$/i);
  if (plainPass) {
    return { type: 'pass', code: value.toUpperCase() };
  }

  const parts = value.split(':');
  if (parts[0] !== PREFIX || parts.length < 3) {
    throw ApiError.badRequest('This QR code is not a valid EventSphere code');
  }

  const [, type, ...rest] = parts;
  if (type === 'pass') {
    return { type, code: rest[0], registrationId: rest[1] || null, expoId: rest[2] || null, userId: rest[3] || null };
  }
  if (type === 'booth') {
    return { type, boothId: rest[0], expoId: rest[1] || null, zone: rest[2] || null, number: rest[3] || null };
  }
  if (type === 'session') {
    return { type, sessionId: rest[0], expoId: rest[1] || null };
  }
  throw ApiError.badRequest(`Unsupported QR code type "${type}"`);
};

/** PNG data URL for embedding in the client (event pass, booth sign, badge). */
const toDataUrl = async (text, options = {}) => {
  try {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      color: { dark: '#0f172a', light: '#ffffff' },
      ...options,
    });
  } catch {
    throw ApiError.internal('Could not generate the QR code');
  }
};

/** Raw PNG buffer — used by the printable invoice/pass endpoints. */
const toBuffer = async (text, options = {}) => QRCode.toBuffer(text, { width: 320, margin: 1, ...options });

const generatePass = async ({ registration, user, expo }) => {
  const payload = buildPassPayload({ registration, user, expo });
  return { payload, dataUrl: await toDataUrl(payload) };
};

const generateBoothQr = async ({ booth, expo }) => {
  const payload = buildBoothPayload({ booth, expo });
  return { payload, dataUrl: await toDataUrl(payload) };
};

const generateSessionQr = async ({ session, expo }) => {
  const payload = buildSessionPayload({ session, expo });
  return { payload, dataUrl: await toDataUrl(payload) };
};

module.exports = {
  PREFIX,
  buildPassPayload,
  buildBoothPayload,
  buildSessionPayload,
  parsePayload,
  toDataUrl,
  toBuffer,
  generatePass,
  generateBoothQr,
  generateSessionQr,
};

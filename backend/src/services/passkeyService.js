'use strict';

const crypto = require('crypto');
const config = require('../config');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { User, WebAuthnCredential } = require('../models');

const toBase64Url = (value) => Buffer.from(value).toString('base64url');
const fromBase64Url = (value) => new Uint8Array(Buffer.from(String(value), 'base64url'));

const REGISTRATION_CHALLENGE_TTL_MS = 5 * 60 * 1000;

const webauthn = () => require('@simplewebauthn/server');

/** Load the SimpleWebAuthn verifier without leaking library internals upward. */
const safeVerify = async (fn) => {
  try {
    return await fn();
  } catch (error) {
    // The raw library error often includes ceremony jargon — keep it in the
    // server log only and answer the client with something actionable.
    logger.warn(`WebAuthn verification failed: ${error.message}`);
    throw ApiError.badRequest(
      'Biometric verification could not be completed. You can verify your account with the code sent to your e-mail.',
      { code: 'WEBAUTHN_FAILED' },
    );
  }
};

const buildUserHandle = (userId) => new Uint8Array(Buffer.from(String(userId), 'utf8'));

/** Stable device label so a user recognises which passkey they are removing. */
const buildDeviceLabel = (deviceName, attachment) => {
  const cleaned = String(deviceName || '').trim().slice(0, 60);
  if (cleaned) return cleaned;
  if (attachment === 'platform') return 'This device (biometric)';
  if (attachment === 'cross-platform') return 'Security key';
  return 'Passkey';
};

// ---------------------------------------------------------------------------
// Registration (only for fully authenticated users)
// ---------------------------------------------------------------------------

const registrationOptions = async (user) => {
  const existing = await WebAuthnCredential.find({ user: user._id }).select('credentialId transports');

  const options = await webauthn().generateRegistrationOptions({
    rpName: config.webauthn.rpName,
    rpID: config.webauthn.rpId,
    userID: buildUserHandle(user._id),
    userName: user.email,
    userDisplayName: user.name,
    attestationType: 'none',
    excludeCredentials: existing.map((credential) => ({
      id: credential.credentialId,
      transports: credential.transports?.length ? credential.transports : undefined,
    })),
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
    timeout: 120000,
  });

  // Single-use challenge kept on the user document (never returned to clients
  // beyond the options object the browser needs).
  await User.findByIdAndUpdate(user._id, {
    webauthnChallengeHash: crypto.createHash('sha256').update(options.challenge).digest('hex'),
    webauthnChallengeExpiresAt: new Date(Date.now() + REGISTRATION_CHALLENGE_TTL_MS),
  });

  return options;
};

const verifyRegistration = async (user, response, { deviceName = '', attachment = '' } = {}) => {
  const fresh = await User.findById(user._id).select('+webauthnChallengeHash +webauthnChallengeExpiresAt');
  const storedHash = fresh?.webauthnChallengeHash;
  const notExpired = fresh?.webauthnChallengeExpiresAt && fresh.webauthnChallengeExpiresAt > new Date();

  if (!storedHash || !notExpired) {
    throw ApiError.badRequest('Passkey registration session expired. Please try again.', { code: 'WEBAUTHN_CHALLENGE_EXPIRED' });
  }

  const result = await safeVerify(() =>
    webauthn().verifyRegistrationResponse({
      response,
      expectedChallenge: async (challenge) => crypto.createHash('sha256').update(challenge).digest('hex') === storedHash,
      expectedOrigin: config.webauthn.origin,
      expectedRPID: config.webauthn.rpId,
      requireUserVerification: false,
    }),
  );

  // Always burn the challenge — the ceremony is single-use.
  await User.findByIdAndUpdate(user._id, { webauthnChallengeHash: null, webauthnChallengeExpiresAt: null });

  if (!result.verified || !result.registrationInfo) {
    throw ApiError.badRequest('The passkey could not be registered. Please try again.', { code: 'WEBAUTHN_FAILED' });
  }

  const { credential, credentialDeviceType, credentialBackedUp } = result.registrationInfo;

  const record = await WebAuthnCredential.create({
    user: user._id,
    credentialId: credential.id,
    publicKey: toBase64Url(credential.publicKey),
    counter: credential.counter || 0,
    transports: credential.transports || [],
    deviceName: buildDeviceLabel(deviceName, attachment || credentialDeviceType),
    authenticatorAttachment: attachment || credentialDeviceType || '',
  });

  return WebAuthnCredential.toClient(record);
};

const listCredentials = async (userId) => {
  const credentials = await WebAuthnCredential.find({ user: userId }).sort({ createdAt: -1 });
  return credentials.map(WebAuthnCredential.toClient);
};

const removeCredential = async (userId, credentialId) => {
  const removed = await WebAuthnCredential.findOneAndDelete({ user: userId, _id: credentialId });
  if (!removed) throw ApiError.notFound('That passkey is not registered on your account.');
  return { success: true };
};

const countForUser = (userId) => WebAuthnCredential.countDocuments({ user: userId });

// ---------------------------------------------------------------------------
// Authentication (second factor of the login flow)
// ---------------------------------------------------------------------------

const authenticationOptions = async (user) => {
  const credentials = await WebAuthnCredential.find({ user: user._id }).select('credentialId transports');
  if (!credentials.length) throw ApiError.notFound('No passkey is registered for this account.');

  return webauthn().generateAuthenticationOptions({
    rpID: config.webauthn.rpId,
    allowCredentials: credentials.map((credential) => ({
      id: credential.credentialId,
      transports: credential.transports?.length ? credential.transports : undefined,
    })),
    userVerification: 'preferred',
    timeout: 120000,
  });
};

/**
 * Verify a passkey assertion for `user`. The challenge is checked against the
 * value the server generated (and must not have been used before) and the
 * stored signature counter guards against cloned authenticators.
 */
const verifyAuthentication = async (user, response, { expectedChallenge }) => {
  const credentialId = response?.id;
  if (!credentialId) {
    throw ApiError.badRequest('Biometric verification could not be completed. Please use the e-mail code instead.');
  }

  const stored = await WebAuthnCredential.findOne({ user: user._id, credentialId });
  if (!stored) {
    throw ApiError.badRequest(
      'Biometric verification could not be completed. You can verify your account with the code sent to your e-mail.',
      { code: 'WEBAUTHN_FAILED' },
    );
  }

  const result = await safeVerify(() =>
    webauthn().verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: config.webauthn.origin,
      expectedRPID: config.webauthn.rpId,
      requireUserVerification: false,
      credential: {
        id: stored.credentialId,
        publicKey: fromBase64Url(stored.publicKey),
        counter: stored.counter,
        transports: stored.transports || [],
      },
    }),
  );

  if (!result.verified) {
    throw ApiError.badRequest(
      'Biometric verification could not be completed. You can verify your account with the code sent to your e-mail.',
      { code: 'WEBAUTHN_FAILED' },
    );
  }

  const newCounter = result.authenticationInfo?.newCounter ?? stored.counter;
  await WebAuthnCredential.updateOne(
    { _id: stored._id },
    { $set: { counter: newCounter, lastUsedAt: new Date() } },
  );

  return { verified: true, credentialId: stored.credentialId };
};

module.exports = {
  registrationOptions,
  verifyRegistration,
  listCredentials,
  removeCredential,
  countForUser,
  authenticationOptions,
  verifyAuthentication,
};

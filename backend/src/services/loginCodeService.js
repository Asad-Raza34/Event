'use strict';

const crypto = require('crypto');
const config = require('../config');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { randomToken, sha256 } = require('../utils/helpers');
const { sendMail, loginCodeEmail, adminLoginCodeEmail } = require('../utils/mailer');
const { LoginVerification, User } = require('../models');

const CODE_ALPHABET = '23456789'; // no 0/1 to avoid look-alike confusion in e-mails

/** Get MFA config for a given context (admin or regular user). */
const getMfaConfig = (isAdmin = false) => {
  if (isAdmin && config.adminMfa) {
    return {
      codeLength: config.adminMfa.codeLength ?? config.mfa.codeLength,
      expiryMinutes: config.adminMfa.expiryMinutes ?? config.mfa.expiryMinutes,
      maxAttempts: config.adminMfa.maxAttempts ?? config.mfa.maxAttempts,
      resendCooldownSeconds: config.adminMfa.resendCooldownSeconds ?? config.mfa.resendCooldownSeconds,
      maxResends: config.adminMfa.maxResends ?? config.mfa.maxResends,
      challengeTtlMinutes: config.adminMfa.challengeTtlMinutes ?? config.mfa.challengeTtlMinutes,
    };
  }
  return config.mfa;
};

/** Get computed MFA constants for a given context. */
const getMfaConstants = (isAdmin = false) => {
  const mfa = getMfaConfig(isAdmin);
  return {
    codeLength: mfa.codeLength,
    challengeTtlMs: mfa.challengeTtlMinutes * 60 * 1000,
    codeTtlMs: mfa.expiryMinutes * 60 * 1000,
    resendCooldownMs: mfa.resendCooldownSeconds * 1000,
    maxAttempts: mfa.maxAttempts,
    maxResends: mfa.maxResends,
  };
};

/** Cryptographically secure numeric OTP — crypto.randomInt, never Math.random. */
const generateCode = (isAdmin = false) => {
  const { codeLength } = getMfaConstants(isAdmin);
  let code = '';
  for (let i = 0; i < codeLength; i += 1) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return code;
};

/** Per-challenge pepper: the code is hashed as salt:hash (HMAC-style). */
const hashCode = (code, salt) => sha256(`${salt}:${code}`);

/** `a***@gmail.com` — enough to recognise the inbox, useless to an attacker. */
const maskEmail = (email = '') => {
  const [local, domain] = String(email).split('@');
  if (!domain) return 'your registered e-mail address';
  const head = local.slice(0, 1);
  return `${head}${'*'.repeat(Math.max(3, Math.min(5, local.length - 1)))}@${domain}`;
};

// The hash/challenge fields are `select: false` so they never leak by accident;
// the service opts back in explicitly when it needs them.
const SECRET_FIELDS = '+codeHash +codeSalt +challengeTokenHash +webauthnChallengeHash +webauthnChallengeExpiresAt';

const findActiveChallenge = async (token) => {
  if (!token) return null;
  const challenge = await LoginVerification.findOne({ challengeTokenHash: sha256(token) }).select(SECRET_FIELDS);
  if (!challenge) return null;
  if (!challenge.isChallengeValid()) return null;
  return challenge;
};

const assertResendWindowOpen = (challenge) => {
  const constants = getMfaConstants(challenge.isAdmin);
  if (challenge.lastResendAt && Date.now() - challenge.lastResendAt.getTime() < constants.resendCooldownMs) {
    const retryAfter = Math.ceil((constants.resendCooldownMs - (Date.now() - challenge.lastResendAt.getTime())) / 1000);
    throw ApiError.tooManyRequests(
      `A new code was just sent. Please wait ${retryAfter} second${retryAfter === 1 ? '' : 's'} before requesting another.`,
      {
        code: 'RESEND_COOLDOWN',
        details: [{ field: 'resend', code: 'RESEND_COOLDOWN', retryAfterSeconds: retryAfter, message: 'Please wait before requesting another code' }],
      },
    );
  }
};

const assertResendBudgetLeft = (challenge) => {
  const constants = getMfaConstants(challenge.isAdmin);
  if (challenge.resendCount >= constants.maxResends) {
    throw ApiError.tooManyRequests(
      'Too many verification codes have been requested for this sign-in. Please sign in again to continue.',
      { code: 'RESEND_LIMIT_REACHED' },
    );
  }
};

/**
 * Create a brand-new challenge after the e-mail + password step succeeded.
 * Issues the first code and delivers it to the account's registered address.
 * @param {Object} user - The user document
 * @param {Object} options - Options including ip and isAdmin flag
 */
const createChallenge = async (user, { ip = '', isAdmin = false } = {}) => {
  // One active challenge per user: anything still open is invalidated so a
  // second concurrent login never leaves two valid codes around.
  await LoginVerification.updateMany(
    { user: user._id, usedAt: null },
    { $set: { usedAt: new Date() } },
  );

  const constants = getMfaConstants(isAdmin);
  const challengeToken = randomToken(32);
  const code = generateCode(isAdmin);
  const now = new Date();
  const codeSalt = randomToken(16);

  const challenge = await LoginVerification.create({
    user: user._id,
    challengeTokenHash: sha256(challengeToken),
    codeSalt,
    codeHash: hashCode(code, codeSalt),
    expiresAt: new Date(now.getTime() + constants.codeTtlMs),
    // The initial send starts the resend cooldown too, so the button shows a
    // countdown immediately ("Resend code in 30 seconds").
    lastResendAt: now,
    createdByIp: ip,
    isAdmin,
    purgeAt: LoginVerification.purgeDeadline(now),
  });

  // Use admin-specific email template for admin users
  const mail = isAdmin ? adminLoginCodeEmail(user, code, challenge.expiresAt) : loginCodeEmail(user, code, challenge.expiresAt);
  let delivered = false;
  try {
    ({ delivered } = await sendMail(mail));
  } catch (error) {
    // The challenge exists and can be resent; a broken provider must not
    // pretend the login succeeded nor crash the request.
    logger.error('Login code e-mail could not be sent:', error.message);
  }

  const payload = {
    challengeToken,
    maskedEmail: maskEmail(user.email),
    expiresAt: challenge.expiresAt,
    cooldownSeconds: constants.resendCooldownMs / 1000,
    codeLength: constants.codeLength,
    resendsRemaining: Math.max(0, constants.maxResends - challenge.resendCount),
    delivered,
  };

  // Demo mode (non-production): surface the code so the flow is testable
  // without SMTP. Never enabled in production, never logged.
  if (config.demoMode && !delivered) payload.devCode = code;

  return payload;
};

/**
 * Issue a NEW code for an existing challenge. The previous code is overwritten
 * immediately, so delayed e-mails carrying older codes are rejected.
 */
const resendCode = async (challengeToken) => {
  const challenge = await findActiveChallenge(challengeToken);
  if (!challenge) throw ApiError.unauthorized('This verification session has expired. Please sign in again.');

  assertResendWindowOpen(challenge);
  assertResendBudgetLeft(challenge);

  const constants = getMfaConstants(challenge.isAdmin);
  const code = generateCode(challenge.isAdmin);
  const now = new Date();
  challenge.codeSalt = randomToken(16);
  challenge.codeHash = hashCode(code, challenge.codeSalt);
  challenge.expiresAt = new Date(now.getTime() + constants.codeTtlMs);
  challenge.attempts = 0;
  challenge.resendCount += 1;
  challenge.lastResendAt = now;
  await challenge.save({ validateBeforeSave: false });

  const freshUser = await User.findById(challenge.user);
  // Use admin-specific email template for admin users
  const isAdmin = freshUser.role === 'admin';
  const mail = isAdmin ? adminLoginCodeEmail(freshUser, code, challenge.expiresAt) : loginCodeEmail(freshUser, code, challenge.expiresAt);
  let delivered = false;
  try {
    ({ delivered } = await sendMail(mail));
  } catch (error) {
    logger.error('Login code e-mail could not be sent:', error.message);
  }

  const payload = {
    maskedEmail: maskEmail(freshUser.email),
    expiresAt: challenge.expiresAt,
    cooldownSeconds: constants.resendCooldownMs / 1000,
    codeLength: constants.codeLength,
    delivered,
    resendCount: challenge.resendCount,
    resendsRemaining: Math.max(0, constants.maxResends - challenge.resendCount),
  };
  if (config.demoMode && !delivered) payload.devCode = code;

  return payload;
};

/**
 * Verify a submitted code. Returns the user when correct; throws a precise
 * ApiError otherwise. Attempt counting and expiry are both enforced here.
 */
const verifyCode = async (challengeToken, code) => {
  const challenge = await findActiveChallenge(challengeToken);
  if (!challenge) throw ApiError.unauthorized('This verification session has expired. Please sign in again.');

  if (!challenge.isCodeValid()) {
    throw ApiError.badRequest('Your verification code has expired. Request a new code to continue.', {
      code: 'OTP_EXPIRED',
    });
  }

  const constants = getMfaConstants(challenge.isAdmin);

  if (challenge.attempts >= constants.maxAttempts) {
    throw ApiError.badRequest('Too many incorrect codes. Request a new verification code to continue.', {
      code: 'OTP_LOCKED',
    });
  }

  const candidate = String(code || '').replace(/[^\d]/g, '');
  if (candidate.length !== constants.codeLength) {
    throw ApiError.badRequest(`Please enter the ${constants.codeLength}-digit verification code.`);
  }

  const matches = challenge.codeHash === hashCode(candidate, challenge.codeSalt);

  if (!matches) {
    challenge.attempts += 1;
    const remaining = Math.max(0, constants.maxAttempts - challenge.attempts);
    if (remaining === 0) {
      // The code is now unusable: every later attempt hits the attempts guard
      // above. The challenge stays open so the user can request a new code.
      await challenge.save({ validateBeforeSave: false });
      throw ApiError.badRequest(
        'Too many incorrect codes. Request a new verification code to continue.',
        { code: 'OTP_LOCKED' },
      );
    }
    await challenge.save({ validateBeforeSave: false });
    throw ApiError.badRequest(
      `That verification code is incorrect. Please check your e-mail and try again (${remaining} attempt${remaining === 1 ? '' : 's'} left).`,
      { code: 'OTP_INVALID' },
    );
  }

  challenge.usedAt = new Date();
  challenge.webauthnChallengeHash = null;
  challenge.webauthnChallengeExpiresAt = null;
  await challenge.save({ validateBeforeSave: false });

  const user = await User.findById(challenge.user);
  if (!user || !user.isActive) {
    throw ApiError.unauthorized('This account is no longer available.');
  }
  return user;
};

/**
 * Store a single-use WebAuthn assertion challenge on an open login challenge.
 * The assertion replaces the e-mail code as the second factor.
 */
const setWebAuthnChallenge = async (challengeToken, challengeValue) => {
  const challenge = await findActiveChallenge(challengeToken);
  if (!challenge) throw ApiError.unauthorized('This verification session has expired. Please sign in again.');

  challenge.webauthnChallengeHash = sha256(challengeValue);
  challenge.webauthnChallengeExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await challenge.save({ validateBeforeSave: false });
  return challenge;
};

/**
 * Consume the WebAuthn assertion challenge exactly once (replay protection).
 * Returns a verifier predicate the WebAuthn library can call with the
 * challenge recovered from the client's response — the raw value is never
 * stored, only its hash.
 */
const consumeWebAuthnChallenge = async (challenge) => {
  const stored = challenge.webauthnChallengeHash;
  const notExpired = challenge.webauthnChallengeExpiresAt && challenge.webauthnChallengeExpiresAt > new Date();
  if (!stored || !notExpired) {
    throw ApiError.badRequest(
      'Biometric verification could not be completed. Please try again or use the e-mail code.',
      { code: 'WEBAUTHN_FAILED' },
    );
  }

  challenge.webauthnChallengeHash = null;
  challenge.webauthnChallengeExpiresAt = null;
  await challenge.save({ validateBeforeSave: false });

  return (candidate) => sha256(candidate) === stored;
};

/** Mark the whole login challenge as resolved (single-use). */
const markChallengeUsed = async (challenge) => {
  challenge.usedAt = new Date();
  challenge.webauthnChallengeHash = null;
  challenge.webauthnChallengeExpiresAt = null;
  await challenge.save({ validateBeforeSave: false });
  return challenge;
};

/** Invalidate every open challenge for a user (logout, password change…). */
const revokeForUser = async (userId) => {
  await LoginVerification.updateMany({ user: userId, usedAt: null }, { $set: { usedAt: new Date() } });
};

module.exports = {
  createChallenge,
  resendCode,
  verifyCode,
  findActiveChallenge,
  setWebAuthnChallenge,
  consumeWebAuthnChallenge,
  markChallengeUsed,
  revokeForUser,
  maskEmail,
  generateCode,
};

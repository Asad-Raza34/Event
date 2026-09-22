'use strict';

const config = require('../config');
const { User, AttendeeProfile, ExhibitorProfile } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/tokens');
const { randomToken, sha256 } = require('../utils/helpers');
const { sendMail, passwordResetEmail } = require('../utils/mailer');
const notificationService = require('./notificationService');
const loginCodeService = require('./loginCodeService');
const passkeyService = require('./passkeyService');

/** Create the role-specific profile document that lives next to the user. */
const ensureProfile = async (user) => {
  if (user.role === 'attendee') {
    await AttendeeProfile.findOneAndUpdate(
      { user: user._id },
      { $setOnInsert: { user: user._id, interests: user.interests || [] } },
      { upsert: true, new: true },
    );
  }
  if (user.role === 'exhibitor') {
    await ExhibitorProfile.findOneAndUpdate(
      { user: user._id },
      {
        $setOnInsert: {
          user: user._id,
          companyName: user.organization || `${user.name}'s company`,
          contact: { email: user.email, phone: user.phone || '', city: user.city || '', country: user.country || '' },
        },
      },
      { upsert: true, new: true },
    );
  }
  return user;
};

const issueTokens = (user) => ({
  accessToken: signAccessToken(user),
  refreshToken: signRefreshToken(user),
});

const register = async (payload) => {
  const { name, email, password, role = 'attendee', phone, organization, jobTitle, city, country, interests } = payload;

  const existing = await User.findOne({ email: String(email).toLowerCase().trim() });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  if (role === 'admin') {
    const invite = payload.adminInviteCode || '';
    if (!config.adminInviteCode || invite !== config.adminInviteCode) {
      throw ApiError.forbidden('An organizer account requires a valid invitation code');
    }
  }

  const user = await User.create({
    name,
    email,
    password,
    role,
    phone,
    organization,
    jobTitle,
    city,
    country,
    interests: Array.isArray(interests) ? interests : String(interests || '').split(',').map((i) => i.trim()).filter(Boolean),
    isEmailVerified: false,
  });

  await ensureProfile(user);

  await notificationService.create({
    userId: user._id,
    type: 'system',
    title: 'Welcome to EventSphere 🎉',
    body:
      role === 'exhibitor'
        ? 'Complete your company profile, then apply to the expos you want to exhibit at.'
        : role === 'admin'
          ? 'Create your first expo and start building the floor plan.'
          : 'Browse expos, register for sessions and start connecting with exhibitors.',
    link: role === 'exhibitor' ? '/exhibitor/company' : role === 'admin' ? '/admin/expos' : '/attendee/expos',
  }).catch(() => null);

  return { user: user.toJSON(), ...issueTokens(user) };
};

/**
 * Step 1 of sign-in: verify the e-mail + password.
 * For admin users: open a temporary challenge and deliver a one-time code (2FA required).
 * For non-admin users (attendee/exhibitor): issue session immediately (no 2FA).
 * No session is issued for admin until the code or passkey is verified.
 */
const login = async ({ email, password, ip }) => {
  const user = await User.findByEmailWithPassword(email);
  if (!user) throw ApiError.unauthorized('Invalid email or password');

  const matches = await user.comparePassword(password);
  if (!matches) throw ApiError.unauthorized('Invalid email or password');
  if (!user.isActive) throw ApiError.forbidden('Your account has been deactivated. Please contact support.');

  // Admin users require second-factor authentication (OTP or WebAuthn/passkey)
  if (user.role === 'admin') {
    const [challenge, passkeyCount] = await Promise.all([
      loginCodeService.createChallenge(user, { ip, isAdmin: true }),
      passkeyService.countForUser(user._id),
    ]);

    return {
      mfaRequired: true,
      // Minimal identity for the verification screen — no role data or tokens.
      name: user.name,
      maskedEmail: challenge.maskedEmail,
      challengeToken: challenge.challengeToken,
      codeExpiresAt: challenge.expiresAt,
      cooldownSeconds: challenge.cooldownSeconds,
      codeLength: challenge.codeLength,
      resendsRemaining: challenge.resendsRemaining,
      emailDelivered: challenge.delivered,
      passkeyAvailable: passkeyCount > 0,
      ...(challenge.devCode ? { devCode: challenge.devCode } : {}),
    };
  }

  // Non-admin users (attendee, exhibitor) get direct login — no 2FA required
  const result = await finalizeLogin(user);
  return { ...result, mfaRequired: false };
};

/** Step 2 of sign-in: the e-mail code was correct — issue the real session. */
const verifyLoginCode = async ({ challengeToken, code }) => {
  const user = await loginCodeService.verifyCode(challengeToken, code);
  return finalizeLogin(user);
};

/** Resend a fresh code for an open challenge (cooldown + budget enforced). */
const resendLoginCode = async ({ challengeToken }) => loginCodeService.resendCode(challengeToken);

/** Status of an open challenge — used to restore the screen after a reload. */
const loginChallengeStatus = async (challengeToken) => {
  const challenge = await loginCodeService.findActiveChallenge(challengeToken);
  if (!challenge) return { valid: false };
  const user = await User.findById(challenge.user);
  const passkeyCount = user ? await passkeyService.countForUser(user._id) : 0;
  const mfaConfig = challenge.isAdmin && config.adminMfa ? config.adminMfa : config.mfa;
  const resendCooldownMs = (mfaConfig.resendCooldownSeconds ?? config.mfa.resendCooldownSeconds) * 1000;
  const maxResends = mfaConfig.maxResends ?? config.mfa.maxResends;
  return {
    valid: true,
    maskedEmail: user ? loginCodeService.maskEmail(user.email) : '',
    codeExpiresAt: challenge.expiresAt,
    cooldownSeconds: Math.max(
      0,
      Math.ceil((resendCooldownMs - (Date.now() - (challenge.lastResendAt?.getTime() || 0))) / 1000),
    ),
    resendsRemaining: Math.max(0, maxResends - challenge.resendCount),
    passkeyAvailable: passkeyCount > 0,
  };
};

/** Mark the login and hand out the access/refresh token pair. */
const finalizeLogin = async (user) => {
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });
  return { user: user.toJSON(), ...issueTokens(user) };
};

/** Begin a WebAuthn assertion ceremony for an open login challenge. */
const beginPasskeyLogin = async ({ challengeToken }) => {
  const challenge = await loginCodeService.findActiveChallenge(challengeToken);
  if (!challenge) throw ApiError.unauthorized('This verification session has expired. Please sign in again.');
  const user = await User.findById(challenge.user);
  if (!user || !user.isActive) throw ApiError.unauthorized('This account is no longer available.');

  const options = await passkeyService.authenticationOptions(user);
  await loginCodeService.setWebAuthnChallenge(challengeToken, options.challenge);
  return { options };
};

/** Step 2 of sign-in via device biometrics/passkey. */
const verifyPasskeyLogin = async ({ challengeToken, response }) => {
  const challenge = await loginCodeService.findActiveChallenge(challengeToken);
  if (!challenge) throw ApiError.unauthorized('This verification session has expired. Please sign in again.');
  const user = await User.findById(challenge.user);
  if (!user || !user.isActive) throw ApiError.unauthorized('This account is no longer available.');

  const expectedChallenge = await loginCodeService.consumeWebAuthnChallenge(challenge);
  await passkeyService.verifyAuthentication(user, response, { expectedChallenge });

  // A successful assertion resolves the challenge exactly like the code would.
  await loginCodeService.markChallengeUsed(challenge);
  return finalizeLogin(user);
};

/**
 * Refresh-token rotation: the client exchanges its refresh token for a new
 * pair. Tokens issued before a password change (bumped `tokenVersion`) fail.
 */
const refresh = async (token) => {
  if (!token) throw ApiError.unauthorized('No active session found');
  const payload = verifyRefreshToken(token);

  const user = await User.findById(payload.sub).select('+tokenVersion');
  if (!user || !user.isActive) throw ApiError.unauthorized('Session is no longer valid');
  if (Number(payload.ver || 0) !== Number(user.tokenVersion || 0)) {
    throw ApiError.unauthorized('Session expired, please sign in again');
  }

  return { user: user.toJSON(), ...issueTokens(user) };
};

const logout = async (userId) => {
  // Any half-finished second-factor challenge is dropped with the session.
  if (userId) await loginCodeService.revokeForUser(userId);
  return { success: true, userId };
};

/** Invalidate every refresh token for the account (all devices). */
const logoutAll = async (userId) => {
  await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } });
  return { success: true };
};

const forgotPassword = async (email) => {
  const user = await User.findOne({ email: String(email).toLowerCase().trim() });
  const genericResponse = {
    message: 'If an account exists for that email, a password reset link has been sent.',
  };
  if (!user) return genericResponse;

  const rawToken = randomToken(32);
  user.passwordResetToken = sha256(rawToken);
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${config.clientUrl}/reset-password?token=${rawToken}&email=${encodeURIComponent(user.email)}`;
  const mail = passwordResetEmail(user, resetUrl);
  const { delivered } = await sendMail({ ...mail, html: mail.text.replace(/\n/g, '<br/>') });
  logger.info(`Password reset requested for ${user.email} (delivered=${delivered})`);

  // In demo/development the link is returned so the flow is testable without SMTP.
  return config.demoMode && !delivered ? { ...genericResponse, resetToken: rawToken, resetUrl } : genericResponse;
};

const resetPassword = async ({ token, email, password }) => {
  const hashed = sha256(token);
  const query = { passwordResetToken: hashed, passwordResetExpires: { $gt: new Date() } };
  if (email) query.email = String(email).toLowerCase().trim();

  const user = await User.findOne(query).select('+passwordResetToken +passwordResetExpires +tokenVersion');
  if (!user) throw ApiError.badRequest('This password reset link is invalid or has expired');

  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.tokenVersion = Number(user.tokenVersion || 0) + 1; // log out everywhere
  await user.save();
  await loginCodeService.revokeForUser(user._id);

  await notificationService.create({
    userId: user._id,
    type: 'system',
    title: 'Your password was changed',
    body: 'If this was not you, reset your password immediately and contact support.',
    priority: 'high',
  }).catch(() => null);

  return { message: 'Password updated successfully. Please sign in with your new password.' };
};

const changePassword = async (user, { currentPassword, newPassword }) => {
  const fresh = await User.findById(user._id).select('+password +tokenVersion');
  const matches = await fresh.comparePassword(currentPassword);
  if (!matches) throw ApiError.badRequest('Your current password is incorrect');

  fresh.password = newPassword;
  fresh.tokenVersion = Number(fresh.tokenVersion || 0) + 1;
  await fresh.save();
  await loginCodeService.revokeForUser(fresh._id);

  return { message: 'Password updated successfully', ...issueTokens(fresh) };
};

const me = async (userId) => {
  const user = await User.findById(userId);
  if (!user) throw ApiError.notFound('Account not found');
  const profile =
    user.role === 'attendee'
      ? await AttendeeProfile.findOne({ user: user._id })
      : user.role === 'exhibitor'
        ? await ExhibitorProfile.findOne({ user: user._id })
        : null;
  return { user: user.toJSON(), profile: profile ? profile.toJSON() : null };
};

module.exports = {
  register,
  login,
  verifyLoginCode,
  resendLoginCode,
  loginChallengeStatus,
  beginPasskeyLogin,
  verifyPasskeyLogin,
  finalizeLogin,
  refresh,
  logout,
  logoutAll,
  forgotPassword,
  resetPassword,
  changePassword,
  me,
  ensureProfile,
  issueTokens,
};

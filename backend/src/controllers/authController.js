'use strict';

const config = require('../config');
const authService = require('../services/authService');
const passkeyService = require('../services/passkeyService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../utils/apiResponse');
const { refreshCookieOptions } = require('../utils/tokens');

const setRefreshCookie = (res, token) =>
  res.cookie(config.jwt.refreshCookieName, token, refreshCookieOptions());

const clearRefreshCookie = (res) =>
  res.clearCookie(config.jwt.refreshCookieName, { ...refreshCookieOptions(), maxAge: undefined });

const register = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.register(req.body);
  setRefreshCookie(res, refreshToken);
  return sendCreated(res, 'Account created successfully', { user, accessToken });
});

/**
 * Step 1 of sign-in. Verifies the e-mail/password pair.
 * For admin users: starts the second factor (2FA). No session issued yet.
 * For non-admin users: issues the session immediately (no 2FA).
 */
const login = asyncHandler(async (req, res) => {
  const data = await authService.login({ ...req.body, ip: req.ip || '' });

  // Non-admin users: session already issued, set refresh cookie
  if (!data.mfaRequired) {
    setRefreshCookie(res, data.refreshToken);
    return sendSuccess(res, {
      message: `Welcome back, ${data.user.name.split(' ')[0]}`,
      data: { user: data.user, accessToken: data.accessToken, mfaRequired: false },
    });
  }

  // Admin users: 2FA required, return challenge data
  return sendSuccess(res, {
    message: 'Verification code sent to your registered e-mail address',
    data,
  });
});

/** Step 2 of sign-in: verify the e-mail code and only then issue the session. */
const verifyLoginCode = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.verifyLoginCode(req.body);
  setRefreshCookie(res, refreshToken);
  return sendSuccess(res, {
    message: `Welcome back, ${user.name.split(' ')[0]}`,
    data: { user, accessToken },
  });
});

const resendLoginCode = asyncHandler(async (req, res) => {
  const data = await authService.resendLoginCode(req.body);
  return sendSuccess(res, { message: 'A new verification code has been sent', data });
});

const loginChallengeStatus = asyncHandler(async (req, res) => {
  const data = await authService.loginChallengeStatus(req.body.challengeToken);
  return sendSuccess(res, { message: data.valid ? 'Verification session active' : 'Verification session expired', data });
});

/** Begin a WebAuthn assertion ceremony (mobile / passkey second factor). */
const passkeyLoginOptions = asyncHandler(async (req, res) => {
  const data = await authService.beginPasskeyLogin(req.body);
  return sendSuccess(res, { message: 'Passkey challenge created', data });
});

/** Finish the passkey ceremony and issue the session. */
const passkeyLoginVerify = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.verifyPasskeyLogin(req.body);
  setRefreshCookie(res, refreshToken);
  return sendSuccess(res, { message: `Welcome back, ${user.name.split(' ')[0]}`, data: { user, accessToken } });
});

const refresh = asyncHandler(async (req, res) => {
  const token = req.cookies?.[config.jwt.refreshCookieName] || req.body.refreshToken;
  const { user, accessToken, refreshToken } = await authService.refresh(token);
  setRefreshCookie(res, refreshToken);
  return sendSuccess(res, { message: 'Session refreshed', data: { user, accessToken } });
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout(req.user?._id);
  clearRefreshCookie(res);
  return sendSuccess(res, { message: 'Signed out successfully', data: { success: true } });
});

const logoutAll = asyncHandler(async (req, res) => {
  await authService.logoutAll(req.user._id);
  clearRefreshCookie(res);
  return sendSuccess(res, { message: 'Signed out of all devices', data: { success: true } });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const data = await authService.forgotPassword(req.body.email);
  return sendSuccess(res, { message: data.message, data });
});

const resetPassword = asyncHandler(async (req, res) => {
  const data = await authService.resetPassword(req.body);
  clearRefreshCookie(res);
  return sendSuccess(res, { message: data.message, data });
});

const changePassword = asyncHandler(async (req, res) => {
  const { message, accessToken, refreshToken } = await authService.changePassword(req.user, req.body);
  setRefreshCookie(res, refreshToken);
  return sendSuccess(res, { message, data: { accessToken } });
});

// ---------------------------------------------------------------------------
// Passkey registration (only available to fully authenticated users)
// ---------------------------------------------------------------------------

const passkeyRegisterOptions = asyncHandler(async (req, res) => {
  const options = await passkeyService.registrationOptions(req.user);
  return sendSuccess(res, { message: 'Passkey registration challenge created', data: { options } });
});

const passkeyRegisterVerify = asyncHandler(async (req, res) => {
  const credential = await passkeyService.verifyRegistration(req.user, req.body.response, {
    deviceName: req.body.deviceName,
    attachment: req.body.attachment,
  });
  return sendCreated(res, 'Passkey registered successfully', { credential });
});

const passkeyList = asyncHandler(async (req, res) => {
  const credentials = await passkeyService.listCredentials(req.user._id);
  return sendSuccess(res, { message: 'Passkeys loaded', data: { credentials } });
});

const passkeyRemove = asyncHandler(async (req, res) => {
  const data = await passkeyService.removeCredential(req.user._id, req.params.id);
  return sendSuccess(res, { message: 'Passkey removed', data });
});

const me = asyncHandler(async (req, res) => {
  const data = await authService.me(req.user._id);
  return sendSuccess(res, { message: 'Profile loaded', data });
});

module.exports = {
  register,
  login,
  verifyLoginCode,
  resendLoginCode,
  loginChallengeStatus,
  passkeyLoginOptions,
  passkeyLoginVerify,
  passkeyRegisterOptions,
  passkeyRegisterVerify,
  passkeyList,
  passkeyRemove,
  refresh,
  logout,
  logoutAll,
  forgotPassword,
  resetPassword,
  changePassword,
  me,
};

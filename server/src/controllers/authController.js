'use strict';

const config = require('../config');
const authService = require('../services/authService');
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

const login = asyncHandler(async (req, res) => {
  const { user, accessToken, refreshToken } = await authService.login(req.body);
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
  authService.logout(req.user?._id);
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

const me = asyncHandler(async (req, res) => {
  const data = await authService.me(req.user._id);
  return sendSuccess(res, { message: 'Profile loaded', data });
});

module.exports = { register, login, refresh, logout, logoutAll, forgotPassword, resetPassword, changePassword, me };

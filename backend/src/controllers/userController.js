'use strict';

const userService = require('../services/userService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');

const getProfile = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Profile loaded', data: await userService.getProfile(req.user._id) }),
);

const updateProfile = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Profile updated', data: await userService.updateProfile(req.user, req.body) }),
);

const updatePreferences = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    message: 'Notification preferences saved',
    data: await userService.updateNotificationPreferences(req.user, req.body),
  }),
);

const uploadAvatar = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Profile picture updated', data: await userService.updateAvatar(req.user, req.file) }),
);

// Organizer endpoints -------------------------------------------------------

const listUsers = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Users loaded', data: await userService.listUsers(req.query) }),
);

const getUser = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'User loaded', data: await userService.getUser(req.params.id) }),
);

const updateUser = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'User updated', data: await userService.adminUpdateUser(req.params.id, req.body) }),
);

const setActive = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    message: req.body.isActive ? 'User activated' : 'User deactivated',
    data: await userService.setActive(req.params.id, req.body.isActive, req.user._id),
  }),
);

const stats = asyncHandler(async (_req, res) =>
  sendSuccess(res, { message: 'User statistics', data: await userService.stats() }),
);

module.exports = { getProfile, updateProfile, updatePreferences, uploadAvatar, listUsers, getUser, updateUser, setActive, stats };

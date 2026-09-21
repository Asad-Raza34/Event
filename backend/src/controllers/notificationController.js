'use strict';

const notificationService = require('../services/notificationService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');

const list = asyncHandler(async (req, res) => {
  const data = await notificationService.list(req.user._id, req.query);
  return sendSuccess(res, { message: 'Notifications loaded', data: data.items, meta: data.meta });
});

const unreadCount = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Unread count', data: { unread: await notificationService.unreadCount(req.user._id) } }),
);

const markRead = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Notifications marked as read', data: await notificationService.markRead(req.user._id, req.body.ids) }),
);

const markAllRead = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'All notifications marked as read', data: await notificationService.markAllRead(req.user._id) }),
);

const remove = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Notification dismissed', data: await notificationService.remove(req.user._id, req.params.id) }),
);

const clearRead = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Read notifications cleared', data: await notificationService.clearRead(req.user._id) }),
);

module.exports = { list, unreadCount, markRead, markAllRead, remove, clearRead };

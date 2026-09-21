'use strict';

const announcementService = require('../services/announcementService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../utils/apiResponse');

const create = asyncHandler(async (req, res) =>
  sendCreated(res, 'Announcement sent to the selected audience', await announcementService.createAnnouncement(req.body, req.user)),
);

const list = asyncHandler(async (req, res) => {
  // Supports /announcements?expo=… and the nested /expos/:expoId/announcements form.
  const data = await announcementService.listAnnouncements({ ...req.query, expo: req.params.expoId || req.query.expo });
  return sendSuccess(res, { message: 'Announcements loaded', data: data.items, meta: data.meta });
});

const update = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Announcement updated', data: await announcementService.updateAnnouncement(req.params.id, req.body, req.user) }),
);

const remove = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Announcement deleted', data: await announcementService.removeAnnouncement(req.params.id, req.user) }),
);

module.exports = { create, list, update, remove };

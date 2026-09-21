'use strict';

const expoService = require('../services/expoService');
const analyticsService = require('../services/analyticsService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../utils/apiResponse');

const list = asyncHandler(async (req, res) => {
  const includeUnpublished = Boolean(req.user && req.user.role === 'admin' && req.query.includeDrafts === 'true');
  const data = await expoService.listExpos(req.query, { includeUnpublished });
  return sendSuccess(res, { message: 'Expos loaded', data: data.items, meta: data.meta });
});

const detail = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Expo loaded', data: await expoService.getExpoDetail(req.params.id, req.user) }),
);

const create = asyncHandler(async (req, res) =>
  sendCreated(res, 'Expo created successfully', await expoService.createExpo(req.body, req.user)),
);

const update = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Expo updated successfully', data: await expoService.updateExpo(req.params.id, req.body, req.user) }),
);

const updateStatus = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    message: `Expo marked as ${req.body.status}`,
    data: await expoService.updateStatus(req.params.id, req.body.status, req.user, req.body.reason),
  }),
);

const publish = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Expo published — registration is now open', data: await expoService.publishExpo(req.params.id, req.user) }),
);

const remove = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Expo deleted successfully', data: await expoService.removeExpo(req.params.id, req.user) }),
);

const refreshStats = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Statistics refreshed', data: await expoService.refreshStats(req.params.id) }),
);

const analytics = asyncHandler(async (req, res) => {
  const data = await analyticsService.expoAnalytics(req.params.id, { days: Number(req.query.days) || 14 });
  return sendSuccess(res, { message: 'Expo analytics loaded', data });
});

module.exports = { list, detail, create, update, updateStatus, publish, remove, refreshStats, analytics };

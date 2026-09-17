'use strict';

const analyticsService = require('../services/analyticsService');
const feedbackService = require('../services/feedbackService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');

const adminOverview = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    message: 'Dashboard analytics loaded',
    data: await analyticsService.adminOverview({ days: Number(req.query.days) || 14 }),
  }),
);

const exhibitorOverview = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    message: 'Exhibitor analytics loaded',
    data: await analyticsService.exhibitorOverview(req.user, { days: Number(req.query.days) || 14 }),
  }),
);

module.exports = { adminOverview, exhibitorOverview, feedbackStats: feedbackService.feedbackStats, ticketStats: feedbackService.ticketStats };

'use strict';

const floorPlanService = require('../services/floorPlanService');
const { recordBoothVisit } = require('../services/exhibitorService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');

const getLayout = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Floor plan loaded', data: await floorPlanService.getLayout(req.params.expoId, req.user) }),
);

const updatePlan = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Floor plan updated', data: await floorPlanService.updatePlan(req.params.expoId, req.body, req.user) }),
);

/** Analytics ping used when an attendee opens a booth from the floor plan. */
const trackVisit = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    message: 'Visit recorded',
    data: await recordBoothVisit(req.params.boothId, req.user, req.body.source || 'floor_plan'),
  }),
);

module.exports = { getLayout, updatePlan, trackVisit };

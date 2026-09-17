'use strict';

const registrationService = require('../services/registrationService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../utils/apiResponse');

const register = asyncHandler(async (req, res) =>
  sendCreated(res, 'Registration successful — your event pass is ready', await registrationService.registerForExpo(req.params.expoId, req.user, req.body)),
);

const cancel = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Registration cancelled', data: await registrationService.cancelRegistration(req.params.id, req.user, req.body.reason) }),
);

const myRegistrations = asyncHandler(async (req, res) => {
  const data = await registrationService.listMyRegistrations(req.user, req.query);
  return sendSuccess(res, { message: 'Your registrations', data: data.items, meta: data.meta });
});

const detail = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Registration loaded', data: await registrationService.getRegistration(req.params.id, req.user) }),
);

const myPass = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Event pass generated', data: await registrationService.getEventPass(req.user, req.params.id || null) }),
);

const list = asyncHandler(async (req, res) => {
  const data = await registrationService.listRegistrations(req.query);
  return sendSuccess(res, { message: 'Registrations loaded', data: data.items, meta: data.meta });
});

/** Staff scanning a pass QR (or typing the pass code) at the door. */
const checkIn = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    message: 'Check-in processed',
    data: await registrationService.processCheckIn({ ...req.body, scannedBy: req.user }),
  }),
);

const checkInHistory = asyncHandler(async (req, res) => {
  const data = await registrationService.checkInHistory(req.query);
  return sendSuccess(res, { message: 'Check-in records loaded', data: data.items, meta: data.meta });
});

const activity = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Your event activity', data: await registrationService.attendeeActivity(req.user) }),
);

module.exports = { register, cancel, myRegistrations, detail, myPass, list, checkIn, checkInHistory, activity };

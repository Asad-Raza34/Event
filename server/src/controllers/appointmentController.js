'use strict';

const appointmentService = require('../services/appointmentService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../utils/apiResponse');

const createSlots = asyncHandler(async (req, res) =>
  sendCreated(res, 'Availability published', await appointmentService.createSlots(req.user, req.body)),
);

const listSlots = asyncHandler(async (req, res) => {
  const data = await appointmentService.listSlots(req.query);
  return sendSuccess(res, { message: 'Slots loaded', data: data.items, meta: data.meta });
});

const updateSlot = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Slot updated', data: await appointmentService.updateSlot(req.params.id, req.body, req.user) }),
);

const removeSlot = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Slot removed', data: await appointmentService.deleteSlot(req.params.id, req.user) }),
);

const request = asyncHandler(async (req, res) =>
  sendCreated(res, 'Appointment requested — you will be notified once it is confirmed', await appointmentService.requestAppointment(req.user, req.body)),
);

const respond = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: `Appointment ${req.body.status}`, data: await appointmentService.respond(req.params.id, req.user, req.body) }),
);

const cancel = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Appointment cancelled', data: await appointmentService.cancel(req.params.id, req.user, req.body.reason) }),
);

const complete = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Appointment marked complete', data: await appointmentService.complete(req.params.id, req.user, req.body) }),
);

const list = asyncHandler(async (req, res) => {
  const data = await appointmentService.listAppointments(req.query, req.user);
  return sendSuccess(res, { message: 'Appointments loaded', data: data.items, meta: data.meta });
});

const detail = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Appointment loaded', data: await appointmentService.getAppointment(req.params.id, req.user) }),
);

const calendar = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Calendar loaded', data: await appointmentService.calendar(req.user, req.query) }),
);

const stats = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Appointment statistics', data: await appointmentService.stats(req.query.expo) }),
);

module.exports = { createSlots, listSlots, updateSlot, removeSlot, request, respond, cancel, complete, list, detail, calendar, stats };

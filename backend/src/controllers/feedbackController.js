'use strict';

const feedbackService = require('../services/feedbackService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../utils/apiResponse');

// ---- Feedback -----------------------------------------------------------

const createFeedback = asyncHandler(async (req, res) =>
  sendCreated(res, 'Thank you — your feedback was submitted', await feedbackService.createFeedback(req.user, req.body)),
);

const listFeedback = asyncHandler(async (req, res) => {
  const data = await feedbackService.listFeedback({ ...req.query, userId: req.user?._id });
  return sendSuccess(res, { message: 'Feedback loaded', data: data.items, meta: data.meta });
});

/** Feedback the signed-in attendee submitted, regardless of their role. */
const myFeedback = asyncHandler(async (req, res) => {
  const data = await feedbackService.listFeedback({ ...req.query, mine: 'true', userId: req.user._id });
  return sendSuccess(res, { message: 'Your feedback', data: data.items, meta: data.meta });
});

const respondToFeedback = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Response saved', data: await feedbackService.respondToFeedback(req.params.id, req.user, req.body) }),
);

const feedbackStats = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Feedback statistics', data: await feedbackService.feedbackStats(req.query.expo) }),
);

// ---- Support tickets ----------------------------------------------------

const createTicket = asyncHandler(async (req, res) =>
  sendCreated(res, 'Support ticket created — our team will get back to you', await feedbackService.createTicket(req.user, req.body)),
);

const listTickets = asyncHandler(async (req, res) => {
  const data = await feedbackService.listTickets(req.query, req.user);
  return sendSuccess(res, { message: 'Tickets loaded', data: data.items, meta: data.meta });
});

const getTicket = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Ticket loaded', data: await feedbackService.getTicket(req.params.id, req.user) }),
);

const addTicketMessage = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Reply sent', data: await feedbackService.addTicketMessage(req.params.id, req.user, req.body) }),
);

const updateTicket = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Ticket updated', data: await feedbackService.updateTicket(req.params.id, req.user, req.body) }),
);

const ticketStats = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Ticket statistics', data: await feedbackService.ticketStats() }),
);

module.exports = {
  createFeedback,
  listFeedback,
  myFeedback,
  respondToFeedback,
  feedbackStats,
  createTicket,
  listTickets,
  getTicket,
  addTicketMessage,
  updateTicket,
  ticketStats,
};

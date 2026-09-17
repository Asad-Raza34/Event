'use strict';

const sessionService = require('../services/sessionService');
const reviewService = require('../services/reviewService');
const qrService = require('../services/qrService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../utils/apiResponse');

const list = asyncHandler(async (req, res) => {
  const data = await sessionService.listSessions(req.query);
  return sendSuccess(res, { message: 'Sessions loaded', data: data.items, meta: data.meta });
});

const schedule = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Schedule loaded', data: await sessionService.scheduleByDate(req.params.expoId, req.query) }),
);

const detail = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Session loaded', data: await sessionService.getSession(req.params.id, req.user) }),
);

const create = asyncHandler(async (req, res) => sendCreated(res, 'Session created', await sessionService.createSession(req.body, req.user)));

const update = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Session updated', data: await sessionService.updateSession(req.params.id, req.body, req.user) }),
);

const cancel = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Session cancelled', data: await sessionService.cancelSession(req.params.id, req.user, req.body.reason) }),
);

const remove = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Session deleted', data: await sessionService.removeSession(req.params.id, req.user) }),
);

const register = asyncHandler(async (req, res) => {
  const data = await sessionService.registerForSession(req.params.id, req.user);
  return sendCreated(res, data.waitlisted ? 'Added to the waitlist' : 'Seat confirmed', data);
});

const unregister = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Registration cancelled', data: await sessionService.unregisterFromSession(req.params.id, req.user) }),
);

const bookmark = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    message: req.body.bookmarked ? 'Session bookmarked' : 'Bookmark removed',
    data: await sessionService.toggleBookmark(req.params.id, req.user, req.body.bookmarked !== false),
  }),
);

const myAgenda = asyncHandler(async (req, res) => {
  const data = await sessionService.myAgenda(req.user, req.query);
  return sendSuccess(res, { message: 'Agenda loaded', data: data.items, meta: data.meta });
});

const rating = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Session reviews', data: await reviewService.sessionReviews(req.params.id, req.query) }),
);

const sessionQr = asyncHandler(async (req, res) => {
  const { session } = await sessionService.getSession(req.params.id);
  return sendSuccess(res, { message: 'Session QR code generated', data: await qrService.generateSessionQr({ session, expo: session.expo }) });
});

// ---- Speakers -----------------------------------------------------------

const listSpeakers = asyncHandler(async (req, res) => {
  const data = await sessionService.listSpeakers(req.query);
  return sendSuccess(res, { message: 'Speakers loaded', data: data.items, meta: data.meta });
});

const createSpeaker = asyncHandler(async (req, res) => sendCreated(res, 'Speaker added', await sessionService.createSpeaker(req.body)));

const updateSpeaker = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Speaker updated', data: await sessionService.updateSpeaker(req.params.id, req.body) }),
);

const removeSpeaker = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Speaker removed', data: await sessionService.removeSpeaker(req.params.id) }),
);

const mySpeakerSessions = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Your sessions loaded', data: await sessionService.mySessionsAsSpeaker(req.user) }),
);

const popularity = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Session popularity', data: await sessionService.popularity(req.params.expoId, Number(req.query.limit) || 8) }),
);

module.exports = {
  list,
  schedule,
  detail,
  create,
  update,
  cancel,
  remove,
  register,
  unregister,
  bookmark,
  myAgenda,
  rating,
  sessionQr,
  listSpeakers,
  createSpeaker,
  updateSpeaker,
  removeSpeaker,
  mySpeakerSessions,
  popularity,
};

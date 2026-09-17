'use strict';

const reviewService = require('../services/reviewService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../utils/apiResponse');

const create = asyncHandler(async (req, res) => sendCreated(res, 'Thanks for your review', await reviewService.createReview(req.user, req.body)));

const update = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Review updated', data: await reviewService.updateReview(req.params.id, req.user, req.body) }),
);

const remove = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Review deleted', data: await reviewService.removeReview(req.params.id, req.user) }),
);

const list = asyncHandler(async (req, res) => {
  const data = await reviewService.listReviews(req.query);
  return sendSuccess(res, { message: 'Reviews loaded', data: data.items, meta: data.meta });
});

const mine = asyncHandler(async (req, res) => {
  const data = await reviewService.myReviews(req.user, req.query);
  return sendSuccess(res, { message: 'Your reviews', data: data.items, meta: data.meta });
});

const moderate = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Review updated', data: await reviewService.moderateReview(req.params.id, req.body, req.user) }),
);

const reply = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Reply posted', data: await reviewService.addReply(req.params.id, req.user, req.body.body) }),
);

const summary = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Rating summary', data: await reviewService.ratingSummary(req.query.targetType || 'exhibitor', req.params.targetId) }),
);

module.exports = { create, update, remove, list, mine, moderate, reply, summary };

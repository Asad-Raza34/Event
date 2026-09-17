'use strict';

const aiService = require('../services/aiService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');

const chat = asyncHandler(async (req, res) =>
  sendSuccess(res, {
    message: 'Assistant reply',
    data: await aiService.answer({
      user: req.user,
      message: req.body.message,
      expoId: req.body.expoId || null,
      history: req.body.history || [],
    }),
  }),
);

const history = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Assistant history', data: await aiService.history(req.user, Number(req.query.limit) || 30) }),
);

const clearHistory = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'History cleared', data: await aiService.clearHistory(req.user) }),
);

const capabilities = asyncHandler(async (_req, res) =>
  sendSuccess(res, { message: 'Assistant capabilities', data: aiService.capabilities() }),
);

module.exports = { chat, history, clearHistory, capabilities };

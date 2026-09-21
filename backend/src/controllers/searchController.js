'use strict';

const searchService = require('../services/searchService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/apiResponse');

const search = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Search results', data: await searchService.globalSearch(req.query, req.user) }),
);

module.exports = { search };

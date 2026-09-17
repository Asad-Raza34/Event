'use strict';

const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../utils/apiResponse');
const ApiError = require('../utils/ApiError');

/** Generic single-file upload used for expo banners and ad-hoc documents. */
const single = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest('No file was uploaded');
  return sendCreated(res, 'File uploaded', {
    file: req.file.publicPath,
    name: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
  });
});

const multiple = asyncHandler(async (req, res) => {
  const files = req.files || [];
  if (!files.length) throw ApiError.badRequest('No files were uploaded');
  return sendCreated(res, 'Files uploaded', files.map((file) => ({
    file: file.publicPath,
    name: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
  })));
});

const limits = asyncHandler(async (_req, res) =>
  sendSuccess(res, {
    message: 'Upload limits',
    data: { maxFileSizeMb: require('../config').uploads.maxFileSizeMb, allowedMimeTypes: require('../config').uploads.allowedMimeTypes },
  }),
);

module.exports = { single, multiple, limits };

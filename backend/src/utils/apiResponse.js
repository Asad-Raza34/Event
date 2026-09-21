'use strict';

/**
 * Every endpoint answers with the same envelope:
 *   { success: true,  message, data, meta? }
 *   { success: false, message, errors? }
 */
const sendSuccess = (res, { statusCode = 200, message = 'Request successful', data = null, meta = undefined } = {}) => {
  const payload = { success: true, message };
  if (data !== undefined) payload.data = data;
  if (meta !== undefined) payload.meta = meta;
  return res.status(statusCode).json(payload);
};

const sendCreated = (res, message, data, meta) => sendSuccess(res, { statusCode: 201, message, data, meta });

const sendError = (res, { statusCode = 400, message = 'Something went wrong', errors = null } = {}) => {
  const payload = { success: false, message };
  if (errors) payload.errors = errors;
  return res.status(statusCode).json(payload);
};

module.exports = { sendSuccess, sendCreated, sendError };

'use strict';

const paymentService = require('../services/paymentService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../utils/apiResponse');

const create = asyncHandler(async (req, res) =>
  sendCreated(res, 'Checkout session created', await paymentService.createCharge({
    user: req.user,
    purpose: req.body.purpose,
    amount: req.body.amount,
    description: req.body.description,
    related: req.body.related || {},
    metadata: req.body.metadata || {},
    provider: req.body.provider,
  })),
);

const confirm = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Payment confirmed', data: await paymentService.confirmPayment(req.params.id, { payload: req.body }) }),
);

const fail = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Payment marked as failed', data: await paymentService.failPayment(req.params.id, req.body.reason) }),
);

const cancel = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Payment cancelled', data: await paymentService.cancelPayment(req.params.id, req.user) }),
);

const refund = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Refund issued', data: await paymentService.refundPayment(req.params.id, req.user, req.body.reason) }),
);

const list = asyncHandler(async (req, res) => {
  const data = await paymentService.listPayments(req.query);
  return sendSuccess(res, { message: 'Payments loaded', data: data.items, meta: data.meta });
});

const mine = asyncHandler(async (req, res) => {
  const data = await paymentService.myPayments(req.user, req.query);
  return sendSuccess(res, { message: 'Your payments', data: data.items, meta: data.meta });
});

const detail = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Payment loaded', data: await paymentService.getPayment(req.params.id, req.user) }),
);

/** Returns a print-ready HTML invoice (the client opens it in a new tab). */
const invoice = asyncHandler(async (req, res) => {
  const { html } = await paymentService.getInvoice(req.params.id, req.user);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(html);
});

const stats = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Payment statistics', data: await paymentService.statsByPurpose() }),
);

/** Stripe webhook — receives the raw body so signatures can be verified. */
const webhook = asyncHandler(async (req, res) => {
  const rawBody = req.rawBody || JSON.stringify(req.body || {});
  const result = await paymentService.handleWebhook(req.params.provider, {
    rawBody,
    signature: req.headers['stripe-signature'],
    headers: req.headers,
  });
  return sendSuccess(res, { message: 'Webhook processed', data: result });
});

module.exports = { create, confirm, fail, cancel, refund, list, mine, detail, invoice, stats, webhook };

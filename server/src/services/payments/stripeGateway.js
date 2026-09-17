'use strict';

const crypto = require('crypto');
const config = require('../../config');
const ApiError = require('../../utils/ApiError');
const logger = require('../../utils/logger');

/**
 * Stripe implementation of the payment gateway contract. Uses the REST API via
 * fetch (no SDK dependency) and verifies webhook signatures with the
 * documented `t=…,v1=…` scheme. Card details are handled entirely by Stripe.
 */
const name = 'stripe';
const API = 'https://api.stripe.com/v1';

const requireKey = () => {
  if (!config.payments.stripeSecretKey) {
    throw ApiError.badRequest('Stripe is selected as the payment provider but STRIPE_SECRET_KEY is not configured');
  }
  return config.payments.stripeSecretKey;
};

const request = async (path, { method = 'POST', body, idempotencyKey } = {}) => {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${requireKey()}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: body ? new URLSearchParams(body).toString() : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    logger.error(`Stripe ${path} failed:`, data.error || data);
    throw ApiError.badRequest(data.error?.message || 'The payment provider rejected this request');
  }
  return data;
};

const createCheckout = async ({ payment, user, successUrl, cancelUrl }) => {
  const session = await request('/checkout/sessions', {
    body: {
      mode: 'payment',
      'payment_method_types[0]': 'card',
      'line_items[0][quantity]': 1,
      'line_items[0][price_data][currency]': String(payment.currency).toLowerCase(),
      'line_items[0][price_data][unit_amount]': Math.round(payment.total * 100),
      'line_items[0][price_data][product_data][name]': payment.description || 'EventSphere payment',
      customer_email: user?.email || undefined,
      'metadata[paymentId]': String(payment._id),
      'metadata[userId]': String(payment.user),
      success_url: successUrl || `${config.clientUrl}/payments/success?payment=${payment._id}`,
      cancel_url: cancelUrl || `${config.clientUrl}/payments/cancel?payment=${payment._id}`,
    },
    idempotencyKey: `eventsphere-checkout-${payment._id}`,
  });

  return {
    providerRef: session.id,
    checkoutUrl: session.url,
    requiresClientConfirmation: false,
    checkout: { sessionId: session.id, amount: payment.total, currency: payment.currency },
  };
};

const confirm = async ({ payment, payload = {} }) => {
  const sessionId = payload.sessionId || payment.providerRef;
  if (!sessionId) return { status: 'pending' };

  const session = await request(`/checkout/sessions/${sessionId}`, { method: 'GET' });
  if (session.payment_status === 'paid' || session.status === 'complete') {
    return {
      status: 'paid',
      providerRef: session.id,
      transactionId: session.payment_intent || session.id,
      paidAt: new Date((session.created || Date.now() / 1000) * 1000),
      receiptUrl: session.receipt_url || '',
      raw: { mode: 'stripe', sessionStatus: session.status },
    };
  }
  if (session.status === 'expired') return { status: 'failed', failureReason: 'The checkout session expired' };
  return { status: 'pending' };
};

const refund = async ({ payment, payload = {} }) => {
  const intentId = payment.providerRef;
  if (!intentId) throw ApiError.badRequest('This payment cannot be refunded automatically');
  const refundBody = { payment_intent: intentId, ...(payload.amount ? { amount: Math.round(payload.amount * 100) } : {}) };
  const result = await request('/refunds', { body: refundBody });
  return { status: 'refunded', providerRef: result.id, refundedAt: new Date(), raw: { mode: 'stripe', refund: result.id } };
};

/** Verify Stripe's `Stripe-Signature` header without the SDK. */
const verifyWebhook = ({ rawBody, signature }) => {
  if (!config.payments.stripeWebhookSecret) return { accepted: false, reason: 'STRIPE_WEBHOOK_SECRET is not configured' };
  if (!signature) return { accepted: false, reason: 'Missing Stripe-Signature header' };

  const parts = String(signature).split(',').reduce((acc, part) => {
    const [key, value] = part.split('=');
    acc[key] = value;
    return acc;
  }, {});

  if (!parts.t || !parts.v1) return { accepted: false, reason: 'Malformed signature header' };

  const expected = crypto
    .createHmac('sha256', config.payments.stripeWebhookSecret)
    .update(`${parts.t}.${rawBody}`)
    .digest('hex');

  const valid = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
  if (!valid) return { accepted: false, reason: 'Signature verification failed' };

  try {
    return { accepted: true, event: JSON.parse(rawBody) };
  } catch {
    return { accepted: false, reason: 'Invalid JSON payload' };
  }
};

module.exports = { name, createCheckout, confirm, refund, verifyWebhook, supportsWebhooks: true };

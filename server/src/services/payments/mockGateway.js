'use strict';

const { humanCode } = require('../../utils/helpers');

/**
 * Development gateway. It mimics the shape of a hosted checkout provider
 * (create a session → confirm it) without touching any card data, so the whole
 * payment flow is testable offline. Swap in the Stripe gateway for real money.
 */
const name = 'mock';

const createCheckout = async ({ payment, user, successUrl, cancelUrl }) => {
  const providerRef = `mock_sess_${humanCode('', 12).replace('-', '').toLowerCase()}`;
  return {
    providerRef,
    /** No external page to visit — the client confirms against our own API. */
    checkoutUrl: null,
    requiresClientConfirmation: true,
    checkout: {
      sessionId: providerRef,
      amount: payment.total,
      currency: payment.currency,
      description: payment.description,
      customer: { name: user?.name, email: user?.email },
      // Simulated card form metadata (never store real card data).
      testCards: { success: '4242 4242 4242 4242', decline: '4000 0000 0000 0002' },
      successUrl: successUrl || null,
      cancelUrl: cancelUrl || null,
    },
  };
};

/** `simulate: 'failure'` lets clients exercise the decline path in demos. */
const confirm = async ({ payment, payload = {} }) => {
  if (payload.simulate === 'failure' || payload.card === '4000 0000 0000 0002') {
    return { status: 'failed', failureReason: 'Card declined (mock gateway simulation)' };
  }
  return {
    status: 'paid',
    providerRef: payment.providerRef,
    transactionId: humanCode('TXN', 10),
    paidAt: new Date(),
    receiptUrl: '',
    raw: { mode: 'mock', confirmedAt: new Date().toISOString() },
  };
};

const refund = async ({ payment }) => ({
  status: 'refunded',
  providerRef: payment.providerRef,
  refundedAt: new Date(),
  raw: { mode: 'mock' },
});

const verifyWebhook = () => ({ accepted: false, reason: 'The mock gateway does not send webhooks' });

module.exports = { name, createCheckout, confirm, refund, verifyWebhook, supportsWebhooks: false };

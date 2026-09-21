'use strict';

const config = require('../../config');
const logger = require('../../utils/logger');

const providers = {
  mock: require('./mockGateway'),
  stripe: require('./stripeGateway'),
};

/**
 * Payment gateway registry. Every gateway implements the same contract:
 *   createCheckout({payment, user, successUrl, cancelUrl})
 *   confirm({payment, payload})
 *   refund({payment, payload})
 *   verifyWebhook({rawBody, signature})
 * Adding a provider (PayPal, Paystack, …) is a new file plus one registry entry.
 */
const getGateway = (provider = null) => {
  const requested = (provider || config.payments.provider || 'mock').toLowerCase();
  const gateway = providers[requested];
  if (!gateway) {
    logger.warn(`Unknown payment provider "${requested}" — falling back to the mock gateway`);
    return providers.mock;
  }
  return gateway;
};

module.exports = { getGateway, providers, availableProviders: Object.keys(providers) };

'use strict';

const mongoose = require('mongoose');
const { humanCode } = require('../utils/helpers');

const PAYMENT_STATUS = ['pending', 'processing', 'paid', 'failed', 'cancelled', 'refunded'];
const PAYMENT_PURPOSE = ['booth_booking', 'event_ticket', 'session', 'expo_registration', 'other'];

/**
 * Payment record. No card data is ever stored — only the provider reference
 * (e.g. a Stripe Checkout session id) and the resulting transaction id.
 */
const paymentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    purpose: { type: String, enum: PAYMENT_PURPOSE, required: true, index: true },
    description: { type: String, maxlength: 300, default: '' },
    amount: { type: Number, required: true, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD', uppercase: true, maxlength: 3 },
    status: { type: String, enum: PAYMENT_STATUS, default: 'pending', index: true },
    provider: { type: String, enum: ['mock', 'stripe', 'manual'], default: 'mock', index: true },
    providerRef: { type: String, default: '', index: true },
    transactionId: { type: String, unique: true, sparse: true, index: true },
    /** Where the payment came from / what it unlocks. */
    related: {
      expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', default: null },
      booth: { type: mongoose.Schema.Types.ObjectId, ref: 'Booth', default: null },
      exhibitor: { type: mongoose.Schema.Types.ObjectId, ref: 'ExhibitorProfile', default: null },
      application: { type: mongoose.Schema.Types.ObjectId, ref: 'ExpoApplication', default: null },
      registration: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration', default: null },
      session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', default: null },
    },
    invoice: {
      number: { type: String, default: '' },
      issuedAt: { type: Date, default: null },
      billedTo: {
        name: { type: String, default: '' },
        email: { type: String, default: '' },
        company: { type: String, default: '' },
        address: { type: String, default: '' },
      },
    },
    paidAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
    refundReason: { type: String, default: '' },
    failureReason: { type: String, default: '' },
    receiptUrl: { type: String, default: '' },
    history: {
      type: [{ status: String, note: String, at: { type: Date, default: Date.now } }],
      default: [],
    },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

paymentSchema.index({ user: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ 'related.expo': 1, status: 1 });

paymentSchema.pre('save', function generateTransactionId(next) {
  if (this.status === 'paid' && !this.transactionId) {
    this.transactionId = humanCode('TXN', 10);
  }
  return next();
});

paymentSchema.virtual('isPaid').get(function isPaid() {
  return this.status === 'paid';
});

module.exports = mongoose.model('Payment', paymentSchema);
module.exports.PAYMENT_STATUS = PAYMENT_STATUS;
module.exports.PAYMENT_PURPOSE = PAYMENT_PURPOSE;

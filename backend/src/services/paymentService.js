'use strict';

const mongoose = require('mongoose');
const config = require('../config');
const { Payment, Booth, Registration, Expo, ExpoApplication, ExhibitorProfile, SessionRegistration, Session } = require('../models');
const ApiError = require('../utils/ApiError');
const logger = require('../utils/logger');
const { getPagination, buildMeta } = require('../utils/pagination');
const { roundCurrency, humanCode } = require('../utils/helpers');
const { emitToUser, EVENTS } = require('../sockets/emitter');
const notificationService = require('./notificationService');
const invoiceService = require('./invoiceService');
const { getGateway } = require('./payments');
const expoService = require('./expoService');

const withTax = (amount) => {
  const tax = roundCurrency((Number(amount) || 0) * (config.payments.taxRatePercent / 100));
  return { amount: roundCurrency(amount), tax, total: roundCurrency(amount + tax) };
};

/**
 * Create a payment + provider checkout session. Nothing is marked paid here —
 * confirmation always comes from the gateway (or its webhook).
 */
const createCharge = async ({ user, purpose, amount, description, related = {}, metadata = {}, provider = null }) => {
  const { amount: base, tax, total } = withTax(amount);
  if (total <= 0) throw ApiError.badRequest('Payment amount must be greater than zero');

  const gateway = getGateway(provider || config.payments.provider);
  const payment = await Payment.create({
    user: user._id,
    purpose,
    description,
    amount: base,
    tax,
    total,
    currency: config.payments.currency,
    status: 'pending',
    provider: gateway.name,
    related,
    metadata,
    invoice: {
      number: await invoiceService.nextInvoiceNumber(),
      issuedAt: new Date(),
      billedTo: {
        name: user.name,
        email: user.email,
        company: metadata.company || user.organization || '',
        address: metadata.address || [user.city, user.country].filter(Boolean).join(', '),
      },
    },
    history: [{ status: 'pending', note: 'Checkout session created' }],
  });

  const checkout = await gateway.createCheckout({
    payment,
    user,
    successUrl: `${config.clientUrl}/payments/success?payment=${payment._id}`,
    cancelUrl: `${config.clientUrl}/payments/cancel?payment=${payment._id}`,
  });

  payment.providerRef = checkout.providerRef;
  payment.history.push({ status: 'processing', note: `Checkout session ${checkout.providerRef}` });
  payment.status = 'processing';
  await payment.save();

  emitToUser(user._id, EVENTS.PAYMENT_UPDATED, { paymentId: payment._id, status: payment.status });

  return { payment, checkout };
};

const createBoothCharge = async (booth, userId, { note = '' } = {}) => {
  const user = await mongoose.model('User').findById(userId);
  const expo = await Expo.findById(booth.expo);
  const profile = await ExhibitorProfile.findOne({ user: userId });

  const charge = await createCharge({
    user,
    purpose: 'booth_booking',
    amount: Number(booth.price || 0),
    description: `Booth ${booth.zone}-${booth.number} — ${expo?.title || 'expo'} booth booking`,
    related: { expo: booth.expo, booth: booth._id, exhibitor: profile?._id || null },
    metadata: {
      boothNumber: `${booth.zone}-${booth.number}`,
      expoTitle: expo?.title || '',
      company: profile?.companyName || '',
      note,
    },
  });
  return charge.payment;
};

const createExpoTicketCharge = async (registration, expo, user) => {
  const charge = await createCharge({
    user,
    purpose: 'event_ticket',
    amount: Number(expo.ticketPrice || 0),
    description: `${expo.title} — event pass (${registration.passType})`,
    related: { expo: expo._id, registration: registration._id },
    metadata: { passCode: registration.passCode, expoTitle: expo.title },
  });
  registration.payment = charge.payment._id;
  await registration.save();
  return charge.payment;
};

const createSessionCharge = async (session, user) => {
  const expo = await Expo.findById(session.expo);
  return createCharge({
    user,
    purpose: 'session',
    amount: Number(session.price || 0),
    description: `${session.title} — ${expo?.title || 'session'} registration`,
    related: { expo: session.expo, session: session._id },
    metadata: { sessionTitle: session.title },
  });
};

/** Side effects that happen once money is genuinely received. */
const fulfill = async (payment) => {
  if (payment.purpose === 'booth_booking' && payment.related.booth) {
    const booth = await Booth.findById(payment.related.booth);
    if (booth && booth.exhibitor) {
      booth.status = 'occupied';
      booth.assignedAt = booth.assignedAt || new Date();
      await booth.save();
      await expoService.refreshStats(booth.expo);
      emitToUser(payment.user, EVENTS.BOOTH_UPDATED, { boothId: booth._id, status: booth.status });
    }
  }

  if (payment.related.registration) {
    const registration = await Registration.findById(payment.related.registration);
    if (registration) {
      registration.status = 'confirmed';
      registration.paymentStatus = 'paid';
      registration.payment = payment._id;
      await registration.save();
      await expoService.refreshStats(registration.expo);
    }
  }

  if (payment.related.application) {
    await ExpoApplication.updateOne({ _id: payment.related.application }, { $set: { payment: payment._id } });
  }

  if (payment.related.expo) {
    await Expo.updateOne({ _id: payment.related.expo }, { $inc: { 'stats.revenue': payment.total } });
  }
};

const confirmPayment = async (paymentId, { payload = {}, system = false } = {}) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw ApiError.notFound('Payment not found');
  if (payment.status === 'paid') return payment;

  const gateway = getGateway(payment.provider);
  const result = await gateway.confirm({ payment, payload });

  if (result.status === 'failed') return failPayment(paymentId, result.failureReason || 'Payment failed');
  if (result.status !== 'paid') {
    payment.history.push({ status: payment.status, note: 'Gateway still processing' });
    await payment.save();
    return payment;
  }

  payment.status = 'paid';
  payment.transactionId = payment.transactionId || result.transactionId || humanCode('TXN', 10);
  payment.providerRef = result.providerRef || payment.providerRef;
  payment.paidAt = result.paidAt || new Date();
  payment.receiptUrl = result.receiptUrl || '';
  payment.invoice.issuedAt = payment.invoice.issuedAt || new Date();
  payment.history.push({ status: 'paid', note: `Confirmed by ${gateway.name}${system ? ' (webhook)' : ''}` });
  await payment.save();

  await fulfill(payment);

  await notificationService.create({
    userId: payment.user,
    type: 'payment_confirmed',
    title: 'Payment confirmed',
    body: `${payment.description} — ${payment.currency} ${payment.total.toFixed(2)} (${payment.transactionId}).`,
    link: '/attendee/payments',
    priority: 'high',
    data: { paymentId: payment._id },
  });

  emitToUser(payment.user, EVENTS.PAYMENT_UPDATED, { paymentId: payment._id, status: 'paid' });
  return payment;
};

const failPayment = async (paymentId, reason = 'Payment failed') => {
  const payment = await Payment.findByIdAndUpdate(
    paymentId,
    {
      $set: { status: 'failed', failureReason: reason },
      $push: { history: { status: 'failed', note: reason } },
    },
    { new: true },
  );
  if (!payment) throw ApiError.notFound('Payment not found');

  await notificationService.create({
    userId: payment.user,
    type: 'payment_failed',
    title: 'Payment failed',
    body: `${payment.description} could not be completed. ${reason}`,
    priority: 'high',
    link: '/attendee/payments',
  });
  emitToUser(payment.user, EVENTS.PAYMENT_UPDATED, { paymentId: payment._id, status: 'failed' });
  return payment;
};

const cancelPayment = async (paymentId, user) => {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw ApiError.notFound('Payment not found');
  if (String(payment.user) !== String(user._id) && user.role !== 'admin') throw ApiError.forbidden('This payment belongs to another user');
  if (payment.status === 'paid') throw ApiError.badRequest('Paid transactions must be refunded, not cancelled');

  payment.status = 'cancelled';
  payment.history.push({ status: 'cancelled', note: 'Cancelled by user' });
  await payment.save();
  emitToUser(payment.user, EVENTS.PAYMENT_UPDATED, { paymentId: payment._id, status: 'cancelled' });
  return payment;
};

/** Organizer-initiated refund that also reverses the fulfilled side effects. */
const refundPayment = async (paymentId, user, reason = '') => {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw ApiError.notFound('Payment not found');
  if (payment.status !== 'paid') throw ApiError.badRequest('Only paid transactions can be refunded');

  const gateway = getGateway(payment.provider);
  try {
    const result = await gateway.refund({ payment });
    payment.refundedAt = result.refundedAt || new Date();
  } catch (error) {
    logger.warn(`Gateway refund failed for ${payment._id}: ${error.message} — marked locally`);
    payment.refundedAt = new Date();
  }

  payment.status = 'refunded';
  payment.refundReason = reason;
  payment.history.push({ status: 'refunded', note: reason || 'Refunded by organizer' });
  await payment.save();

  if (payment.related.booth) {
    const booth = await Booth.findById(payment.related.booth);
    if (booth && String(booth.exhibitor)) {
      // eslint-disable-next-line global-require
      await require('./boothService').releaseBooth(booth._id, user, 'Booth booking refunded');
    }
  }

  if (payment.related.registration) {
    await Registration.updateOne({ _id: payment.related.registration }, { $set: { paymentStatus: 'refunded', status: 'cancelled' } });
  }

  await Expo.updateOne({ _id: payment.related.expo }, { $inc: { 'stats.revenue': -payment.total } });

  await notificationService.create({
    userId: payment.user,
    type: 'payment_confirmed',
    title: 'Refund issued',
    body: `${payment.description} was refunded. ${reason}`.trim(),
    priority: 'high',
    link: '/attendee/payments',
  });

  emitToUser(payment.user, EVENTS.PAYMENT_UPDATED, { paymentId: payment._id, status: 'refunded' });
  return payment;
};

const listPayments = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.purpose) filter.purpose = query.purpose;
  if (query.expo) filter['related.expo'] = query.expo;
  if (query.user) filter.user = query.user;

  const [items, total, totals] = await Promise.all([
    Payment.find(filter)
      .populate('user', 'name email organization avatar')
      .populate('related.expo', 'title slug')
      .populate('related.booth', 'number zone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Payment.countDocuments(filter),
    Payment.aggregate([
      { $match: { status: 'paid' } },
      { $group: { _id: null, revenue: { $sum: '$total' }, count: { $sum: 1 } } },
    ]),
  ]);

  return {
    items,
    meta: {
      ...buildMeta(total, page, limit),
      revenue: totals[0]?.revenue || 0,
      paidCount: totals[0]?.count || 0,
      currency: config.payments.currency,
    },
  };
};

const myPayments = (user, query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { user: user._id };
  if (query.status) filter.status = query.status;
  return Promise.all([
    Payment.find(filter)
      .populate('related.expo', 'title slug')
      .populate('related.booth', 'number zone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Payment.countDocuments(filter),
  ]).then(([items, total]) => ({
    items,
    meta: { ...buildMeta(total, page, limit), spent: items.filter((p) => p.status === 'paid').reduce((s, p) => s + p.total, 0) },
  }));
};

const getPayment = async (id, user) => {
  const payment = await Payment.findById(id)
    .populate('user', 'name email organization')
    .populate('related.expo', 'title slug')
    .populate('related.booth', 'number zone');
  if (!payment) throw ApiError.notFound('Payment not found');
  if (String(payment.user._id) !== String(user._id) && user.role !== 'admin') {
    throw ApiError.forbidden('This transaction belongs to another account');
  }
  return payment;
};

const getInvoice = async (id, user) => {
  const payment = await getPayment(id, user);
  return { payment, html: invoiceService.renderInvoiceHtml(payment) };
};

const statsByPurpose = () =>
  Payment.aggregate([
    { $match: { status: 'paid' } },
    { $group: { _id: '$purpose', revenue: { $sum: '$total' }, count: { $sum: 1 } } },
    { $sort: { revenue: -1 } },
    { $project: { _id: 0, purpose: '$_id', revenue: 1, count: 1 } },
  ]);

/** Pending checkouts older than a day are considered abandoned. */
const expireStalePayments = async (hours = 24) => {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
  const result = await Payment.updateMany(
    { status: { $in: ['pending', 'processing'] }, createdAt: { $lt: cutoff } },
    { $set: { status: 'cancelled', failureReason: 'Checkout expired' }, $push: { history: { status: 'cancelled', note: 'Checkout expired' } } },
  );
  return result.modifiedCount || 0;
};

/** Stripe (or any gateway) webhook entry point. */
const handleWebhook = async (provider, { rawBody, signature, headers }) => {
  const gateway = getGateway(provider);
  if (!gateway.supportsWebhooks) throw ApiError.badRequest(`${gateway.name} does not send webhooks`);

  const verification = gateway.verifyWebhook({ rawBody, signature, headers });
  if (!verification.accepted) throw ApiError.badRequest(verification.reason || 'Invalid webhook signature');

  const event = verification.event;
  const sessionId = event?.data?.object?.id;
  if (!sessionId) return { handled: false, reason: 'Event has no session id' };

  const payment = await Payment.findOne({ providerRef: sessionId });
  if (!payment) return { handled: false, reason: 'No matching payment' };

  if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
    await confirmPayment(payment._id, { payload: { sessionId }, system: true });
    return { handled: true, paymentId: payment._id, action: 'paid' };
  }
  if (event.type === 'checkout.session.expired') {
    await failPayment(payment._id, 'Checkout session expired');
    return { handled: true, paymentId: payment._id, action: 'failed' };
  }
  return { handled: false, reason: `Unhandled event type ${event.type}` };
};

module.exports = {
  createCharge,
  createBoothCharge,
  createExpoTicketCharge,
  createSessionCharge,
  confirmPayment,
  failPayment,
  cancelPayment,
  refundPayment,
  listPayments,
  myPayments,
  getPayment,
  getInvoice,
  statsByPurpose,
  expireStalePayments,
  handleWebhook,
  withTax,
};

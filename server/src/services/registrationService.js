'use strict';

const mongoose = require('mongoose');
const {
  Registration,
  Expo,
  User,
  AttendeeProfile,
  Booth,
  Session,
  SessionRegistration,
  CheckIn,
  Appointment,
  Payment,
} = require('../models');
const ApiError = require('../utils/ApiError');
const { getPagination, buildMeta, escapeRegex } = require('../utils/pagination');
const { startOfDay } = require('../utils/helpers');
const { emitToExpo, EVENTS } = require('../sockets/emitter');
const notificationService = require('./notificationService');
const qrService = require('./qrService');
const expoService = require('./expoService');

// ---------------------------------------------------------------------------
// Expo registration
// ---------------------------------------------------------------------------

const registerForExpo = async (expoId, user, payload = {}) => {
  const expo = await Expo.findById(expoId);
  if (!expo) throw ApiError.notFound('Expo not found');
  if (expo.status === 'cancelled') throw ApiError.badRequest('This expo has been cancelled');
  if (!expo.isRegistrationOpen()) {
    throw ApiError.badRequest(
      expo.registrationDeadline && new Date() > expo.registrationDeadline
        ? 'Registration for this expo has closed'
        : 'Registration for this expo is not open yet',
    );
  }

  const existing = await Registration.findOne({ user: user._id, expo: expo._id });
  if (existing && existing.status !== 'cancelled') throw ApiError.conflict('You are already registered for this expo');

  const confirmedCount = await Registration.countDocuments({ expo: expo._id, status: { $in: ['confirmed', 'attended'] } });
  if (expo.maxAttendees > 0 && confirmedCount >= expo.maxAttendees) {
    throw ApiError.conflict('This expo has reached its maximum number of attendees');
  }

  const price = Number(expo.ticketPrice || 0);
  const details = {
    fullName: payload.fullName || user.name,
    email: payload.email || user.email,
    phone: payload.phone || user.phone || '',
    organization: payload.organization || user.organization || '',
    jobTitle: payload.jobTitle || user.jobTitle || '',
    country: payload.country || user.country || '',
    dietaryRequirements: payload.dietaryRequirements || '',
    accessibilityNeeds: payload.accessibilityNeeds || '',
  };

  const registration = existing
    ? Object.assign(existing, {
        status: price > 0 ? 'pending' : 'confirmed',
        attendeeDetails: details,
        interests: payload.interests || user.interests || [],
        passType: payload.passType || existing.passType || 'standard',
        amount: price,
        paymentStatus: price > 0 ? 'pending' : 'not_required',
        cancelledAt: null,
        cancelReason: '',
      })
    : new Registration({
        user: user._id,
        expo: expo._id,
        attendeeDetails: details,
        interests: payload.interests || user.interests || [],
        passType: payload.passType || 'standard',
        source: user.role === 'admin' ? 'admin' : 'web',
        amount: price,
        currency: expo.currency || 'USD',
        status: price > 0 ? 'pending' : 'confirmed',
        paymentStatus: price > 0 ? 'pending' : 'not_required',
      });

  await registration.save();

  if (price > 0) {
    // eslint-disable-next-line global-require
    const payment = await require('./paymentService').createExpoTicketCharge(registration, expo, user);
    registration.payment = payment._id;
    await registration.save();
  }

  await Promise.all([
    expoService.refreshStats(expo._id),
    AttendeeProfile.findOneAndUpdate({ user: user._id }, { $inc: { 'stats.exposRegistered': 1 } }, { upsert: true }),
  ]);

  await notificationService.create({
    userId: user._id,
    type: 'expo_registration',
    title: price > 0 ? `Complete your registration for ${expo.title}` : `You're registered for ${expo.title}`,
    body:
      price > 0
        ? `Your pass is reserved. Pay ${expo.currency} ${price} to receive your event QR pass.`
        : `Your event pass is ready — open "Event Pass" to see your QR code.`,
    link: '/attendee/pass',
    priority: 'high',
    data: { expoId: expo._id, registrationId: registration._id },
  });

  emitToExpo(expo._id, EVENTS.EXPO_UPDATED, { expoId: expo._id, action: 'registration' });
  return registration;
};

const cancelRegistration = async (registrationId, user, reason = '') => {
  const registration = await Registration.findById(registrationId).populate('expo', 'title slug');
  if (!registration) throw ApiError.notFound('Registration not found');
  if (String(registration.user) !== String(user._id) && user.role !== 'admin') {
    throw ApiError.forbidden('You can only cancel your own registration');
  }
  if (registration.status === 'cancelled') throw ApiError.badRequest('This registration is already cancelled');

  registration.status = 'cancelled';
  registration.cancelledAt = new Date();
  registration.cancelReason = reason || 'Cancelled by attendee';
  await registration.save();

  await expoService.refreshStats(registration.expo._id);
  await notificationService.create({
    userId: registration.user,
    type: 'schedule_changed',
    title: `Registration cancelled — ${registration.expo.title}`,
    body: 'Your pass is no longer valid. You can register again while registration is open.',
    data: { expoId: registration.expo._id },
  });
  return registration;
};

const listMyRegistrations = async (user, query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { user: user._id };
  if (query.status) filter.status = query.status;
  if (query.upcoming === 'true') filter.status = { $in: ['confirmed', 'pending'] };

  const [items, total] = await Promise.all([
    Registration.find(filter)
      .populate('expo', 'title slug startDate endDate status location banner theme category')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Registration.countDocuments(filter),
  ]);
  return { items: items.filter((i) => i.expo), meta: buildMeta(total, page, limit) };
};

const getRegistration = async (id, user) => {
  const query = mongoose.isValidObjectId(id) ? { _id: id } : { passCode: id };
  const registration = await Registration.findOne(query)
    .populate('expo', 'title slug startDate endDate status location banner theme category organizer')
    .populate('user', 'name email avatar phone organization');
  if (!registration) throw ApiError.notFound('Registration not found');
  const isOwner = String(registration.user._id) === String(user._id);
  if (!isOwner && user.role !== 'admin') throw ApiError.forbidden('This pass belongs to another attendee');
  return registration;
};

/** Digital event pass: registration details plus a freshly generated QR image. */
const getEventPass = async (user, registrationId = null) => {
  const filter = registrationId
    ? { _id: registrationId, user: user._id }
    : { user: user._id, status: { $in: ['confirmed', 'attended'] } };
  const registration = await Registration.findOne(filter)
    .populate('expo', 'title slug startDate endDate status location banner theme')
    .sort({ createdAt: -1 });
  if (!registration) throw ApiError.notFound('No active event pass found. Register for an expo first.');

  const pass = await qrService.generatePass({ registration, user, expo: registration.expo });
  await Registration.updateOne({ _id: registration._id }, { $set: { badgeIssuedAt: new Date() } });
  return { registration, qr: pass, holder: { name: user.name, email: user.email, avatar: user.avatar } };
};

const listRegistrations = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.expo) filter.expo = query.expo;
  if (query.status) filter.status = query.status;
  if (query.checkedIn === 'true') filter.checkedIn = true;
  if (query.passType) filter.passType = query.passType;

  if (query.q) {
    const regex = new RegExp(escapeRegex(query.q), 'i');
    const users = await User.find({ $or: [{ name: regex }, { email: regex }, { organization: regex }] }).select('_id');
    filter.$or = [{ user: { $in: users.map((u) => u._id) } }, { passCode: regex }, { 'attendeeDetails.organization': regex }];
  }

  const [items, total] = await Promise.all([
    Registration.find(filter)
      .populate('user', 'name email avatar organization phone')
      .populate('expo', 'title slug startDate status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Registration.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(total, page, limit) };
};

// ---------------------------------------------------------------------------
// QR check-in
// ---------------------------------------------------------------------------

/**
 * Validate a scanned code and record a check-in. Idempotent for event
 * check-ins (re-scanning the same pass returns `alreadyCheckedIn`).
 */
const processCheckIn = async ({ code, expoId = null, type = 'event', boothId = null, sessionId = null, method = 'qr', scannedBy = null, device = '' }) => {
  const parsed = qrService.parsePayload(code);
  const effectiveType = parsed.type === 'booth' ? 'booth' : parsed.type === 'session' ? 'session' : type;

  if (effectiveType === 'booth') {
    const booth = await Booth.findById(parsed.boothId || boothId).populate('expo', 'title slug').populate('exhibitor', 'companyName logo');
    if (!booth) throw ApiError.notFound('Booth not found for this code');

    // Attendees can only check in at a booth if they hold a valid event pass.
    const registration = await Registration.findOne({ expo: booth.expo._id, user: scannedBy?._id, status: { $in: ['confirmed', 'attended'] } });
    const checkIn = await CheckIn.create({
      expo: booth.expo._id,
      user: scannedBy?._id || registration?.user,
      registration: registration?._id || null,
      type: 'booth',
      booth: booth._id,
      code: code.slice(0, 120),
      method,
      scannedBy: scannedBy?._id || null,
      scannerName: scannedBy?.name || '',
      device,
      note: registration ? 'Booth visit recorded' : 'Booth QR scanned without an event pass',
    });
    await Booth.updateOne({ _id: booth._id }, { $inc: { 'traffic.checkIns': 1 } });
    return { type: 'booth', booth, checkIn, alreadyCheckedIn: false };
  }

  if (effectiveType === 'session') {
    const session = await Session.findById(parsed.sessionId || sessionId).populate('expo', 'title slug');
    if (!session) throw ApiError.notFound('Session not found for this code');

    const target = await User.findOne({ _id: scannedBy?._id }).select('name');
    const record = await SessionRegistration.findOneAndUpdate(
      { user: scannedBy?._id, session: session._id },
      { $set: { registered: true, status: 'attended', attendedAt: new Date(), expo: session.expo._id } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const checkIn = await CheckIn.create({
      expo: session.expo._id,
      user: scannedBy?._id,
      type: 'session',
      session: session._id,
      code: code.slice(0, 120),
      method,
      scannedBy: scannedBy?._id || null,
      scannerName: target?.name || '',
      device,
      note: 'Session attendance recorded',
    });
    return { type: 'session', session, registration: record, checkIn, alreadyCheckedIn: false };
  }

  // ---- Event pass ---------------------------------------------------------
  const registration = await Registration.findOne({ passCode: parsed.code })
    .populate('expo', 'title slug startDate endDate status location')
    .populate('user', 'name email avatar organization');
  if (!registration) throw ApiError.notFound('This pass code is not recognised');
  if (registration.status === 'cancelled') throw ApiError.badRequest('This registration has been cancelled');
  if (registration.status === 'pending') throw ApiError.badRequest('Payment for this pass is still pending');
  if (expoId && String(registration.expo._id) !== String(expoId)) {
    throw ApiError.badRequest(`This pass belongs to "${registration.expo.title}", not the selected expo`);
  }

  if (registration.checkedIn) {
    const existing = await CheckIn.findOne({ registration: registration._id, type: 'event' }).sort({ checkedInAt: -1 });
    await Registration.updateOne({ _id: registration._id }, { $inc: { checkInCount: 1 } });
    return { type: 'event', registration, checkIn: existing, alreadyCheckedIn: true };
  }

  registration.checkedIn = true;
  registration.checkedInAt = new Date();
  registration.checkInCount = (registration.checkInCount || 0) + 1;
  if (registration.status === 'confirmed') registration.status = 'attended';
  await registration.save();

  const checkIn = await CheckIn.create({
    expo: registration.expo._id,
    user: registration.user._id,
    registration: registration._id,
    type: 'event',
    code: registration.passCode,
    method,
    scannedBy: scannedBy?._id || null,
    scannerName: scannedBy?.name || '',
    device,
  });

  await AttendeeProfile.findOneAndUpdate({ user: registration.user._id }, { $inc: { 'stats.checkIns': 1 } }, { upsert: true });
  await notificationService.create({
    userId: registration.user._id,
    type: 'system',
    title: `Checked in at ${registration.expo.title}`,
    body: 'Enjoy the expo! Your pass is now marked as used.',
    data: { expoId: registration.expo._id },
  });

  return { type: 'event', registration, checkIn, alreadyCheckedIn: false };
};

const checkInHistory = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.expo) filter.expo = query.expo;
  if (query.type) filter.type = query.type;
  if (query.from || query.to) {
    filter.checkedInAt = {};
    if (query.from) filter.checkedInAt.$gte = new Date(query.from);
    if (query.to) filter.checkedInAt.$lte = new Date(query.to);
  }
  if (query.booth) filter.booth = query.booth;

  const [items, total] = await Promise.all([
    CheckIn.find(filter)
      .populate('user', 'name email avatar organization')
      .populate('booth', 'number zone name')
      .populate('session', 'title startTime')
      .populate('expo', 'title slug')
      .sort({ checkedInAt: -1 })
      .skip(skip)
      .limit(limit),
    CheckIn.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(total, page, limit) };
};

/** Everything an attendee has done — powers "My activity". */
const attendeeActivity = async (user) => {
  const [registrations, sessions, appointments, checkIns, payments, profile] = await Promise.all([
    Registration.find({ user: user._id }).populate('expo', 'title slug startDate endDate status banner location').sort({ createdAt: -1 }),
    SessionRegistration.find({ user: user._id })
      .populate({ path: 'session', select: 'title type date startTime endTime location', populate: { path: 'expo', select: 'title slug' } })
      .sort({ createdAt: -1 }),
    Appointment.find({ attendee: user._id })
      .populate('exhibitor', 'companyName logo slug')
      .populate('expo', 'title slug')
      .sort({ date: -1 }),
    CheckIn.find({ user: user._id }).populate('expo', 'title slug').sort({ checkedInAt: -1 }).limit(50),
    Payment.find({ user: user._id }).sort({ createdAt: -1 }).limit(50),
    AttendeeProfile.findOne({ user: user._id }),
  ]);

  const stats = {
    expos: registrations.filter((r) => r.status !== 'cancelled').length,
    sessions: sessions.filter((s) => s.registered && s.status !== 'cancelled').length,
    bookmarks: sessions.filter((s) => s.bookmarked).length,
    appointments: appointments.length,
    checkIns: checkIns.filter((c) => c.type === 'event').length,
    totalSpent: payments.filter((p) => p.status === 'paid').reduce((sum, p) => sum + (p.total || 0), 0),
    upcoming: registrations.filter((r) => r.expo && new Date(r.expo.startDate) >= startOfDay(new Date()) && r.status !== 'cancelled').length,
  };

  return { registrations, sessions, appointments, checkIns, payments, profile, stats };
};

module.exports = {
  registerForExpo,
  cancelRegistration,
  listMyRegistrations,
  getRegistration,
  getEventPass,
  listRegistrations,
  processCheckIn,
  checkInHistory,
  attendeeActivity,
};

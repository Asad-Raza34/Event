'use strict';

const mongoose = require('mongoose');
const {
  Expo,
  FloorPlan,
  Booth,
  Session,
  Registration,
  ExpoApplication,
  Announcement,
  User,
} = require('../models');
const ApiError = require('../utils/ApiError');
const { getPagination, buildMeta, getSort, escapeRegex } = require('../utils/pagination');
const { pick } = require('../utils/helpers');
const { emitToExpo, emitToAll, EVENTS } = require('../sockets/emitter');
const notificationService = require('./notificationService');

const EDITABLE = [
  'title',
  'description',
  'summary',
  'theme',
  'category',
  'tags',
  'startDate',
  'endDate',
  'registrationDeadline',
  'location',
  'banner',
  'themeColors',
  'maxAttendees',
  'ticketPrice',
  'currency',
  'boothPriceFrom',
  'status',
  'contactEmail',
  'contactPhone',
  'isFeatured',
];

const SORTABLE = ['createdAt', 'startDate', 'title', 'stats.registrations'];

const assertOwner = (expo, user) => {
  if (!user || user.role !== 'admin') throw ApiError.forbidden('Only organizers can manage expos');
  if (!expo.isOwner(user)) throw ApiError.forbidden('You can only manage expos you organize');
  return true;
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const listExpos = async (query = {}, options = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};

  // Public browsing hides drafts and cancelled expos unless asked for explicitly.
  if (query.status) {
    filter.status = { $in: String(query.status).split(',').map((s) => s.trim()) };
  } else if (!options.includeUnpublished) {
    filter.status = { $in: ['upcoming', 'ongoing', 'completed'] };
  }

  if (query.category) filter.category = query.category;
  if (query.city) filter['location.city'] = new RegExp(escapeRegex(query.city), 'i');
  if (query.country) filter['location.country'] = new RegExp(escapeRegex(query.country), 'i');
  if (query.organizer) filter.organizer = query.organizer;
  if (query.featured === 'true') filter.isFeatured = true;

  if (query.from || query.to) {
    filter.startDate = {};
    if (query.from) filter.startDate.$gte = new Date(query.from);
    if (query.to) filter.startDate.$lte = new Date(query.to);
  }

  if (query.upcoming === 'true') {
    filter.startDate = { ...(filter.startDate || {}), $gte: new Date() };
  }
  if (query.registrationOpen === 'true') {
    filter.registrationDeadline = { $gte: new Date() };
    filter.status = { $in: ['upcoming', 'ongoing'] };
  }

  if (query.q) {
    const regex = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ title: regex }, { description: regex }, { theme: regex }, { tags: regex }, { 'location.city': regex }];
  }

  const [items, total] = await Promise.all([
    Expo.find(filter)
      .select('-__v')
      .populate('organizer', 'name email avatar organization')
      .sort(getSort(query, SORTABLE, query.upcoming === 'true' ? 'startDate' : '-createdAt'))
      .skip(skip)
      .limit(limit),
    Expo.countDocuments(filter),
  ]);

  return { items, meta: buildMeta(total, page, limit) };
};

const findExpo = async (identifier) => {
  const isObjectId = mongoose.isValidObjectId(identifier);
  const expo = await Expo.findOne(isObjectId ? { _id: identifier } : { slug: identifier })
    .populate('organizer', 'name email avatar organization phone')
    .populate('floorPlan');
  if (!expo) throw ApiError.notFound('Expo not found');
  return expo;
};

const getExpoDetail = async (identifier, user) => {
  const expo = await findExpo(identifier);
  const [booths, sessions, exhibitorCount, registration] = await Promise.all([
    Booth.countDocuments({ expo: expo._id }),
    Session.find({ expo: expo._id })
      .populate('speakers', 'name photo title organization')
      .sort({ date: 1, startTime: 1 }),
    ExpoApplication.countDocuments({ expo: expo._id, status: 'approved' }),
    user ? Registration.findOne({ expo: expo._id, user: user._id }) : null,
  ]);

  const stats = {
    ...(expo.stats.toObject?.() ?? expo.stats),
    booths,
    sessions: sessions.length,
    exhibitors: exhibitorCount,
  };

  return {
    expo,
    sessions,
    stats,
    myRegistration: registration ? registration.toJSON() : null,
    isOwner: user ? expo.isOwner(user) : false,
  };
};

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

const createExpo = async (payload, user) => {
  const data = pick(payload, EDITABLE);
  const expo = await Expo.create({ ...data, organizer: user._id, status: data.status || 'draft' });

  // Every expo gets a floor plan so booths can be laid out immediately.
  const floorPlan = await FloorPlan.create({
    expo: expo._id,
    name: `${expo.title} — Main Hall`,
    zones: [
      { name: 'A', color: '#6366f1', description: 'Premium front-of-house zone' },
      { name: 'B', color: '#06b6d4', description: 'Central showcase zone' },
      { name: 'C', color: '#f59e0b', description: 'Startup & innovation zone' },
      { name: 'D', color: '#10b981', description: 'Workshop and meeting zone' },
    ],
    amenities: [
      { name: 'Main Entrance', type: 'entrance', x: 1, y: 1 },
      { name: 'Registration Desk', type: 'service', x: 3, y: 1 },
      { name: 'Cafeteria', type: 'food', x: 17, y: 12 },
      { name: 'Restrooms', type: 'facility', x: 10, y: 13 },
    ],
    updatedBy: user._id,
  });
  expo.floorPlan = floorPlan._id;
  await expo.save();

  await notificationService.create({
    userId: user._id,
    type: 'system',
    title: 'Expo created',
    body: `"${expo.title}" was created as a draft. Add booths and sessions, then publish it.`,
    link: `/admin/expos/${expo._id}`,
    data: { expoId: expo._id },
  });

  return expo;
};

const updateExpo = async (id, payload, user) => {
  const expo = await Expo.findById(id);
  if (!expo) throw ApiError.notFound('Expo not found');
  assertOwner(expo, user);

  const data = pick(payload, EDITABLE);
  const previousSchedule = `${expo.startDate}-${expo.endDate}`;
  Object.assign(expo, data);
  await expo.save();

  const scheduleChanged = `${expo.startDate}-${expo.endDate}` !== previousSchedule;
  emitToExpo(expo._id, EVENTS.EXPO_UPDATED, { expoId: expo._id, action: 'updated' });
  if (scheduleChanged) {
    await notifyExpoAudience(expo, {
      type: 'schedule_changed',
      title: `${expo.title}: dates updated`,
      body: `The expo now runs ${new Date(expo.startDate).toDateString()} → ${new Date(expo.endDate).toDateString()}.`,
    });
  }
  return expo;
};

const updateStatus = async (id, status, user, reason = '') => {
  const allowed = ['draft', 'upcoming', 'ongoing', 'completed', 'cancelled'];
  if (!allowed.includes(status)) throw ApiError.badRequest(`Invalid expo status "${status}"`);

  const expo = await Expo.findById(id);
  if (!expo) throw ApiError.notFound('Expo not found');
  assertOwner(expo, user);

  expo.status = status;
  if (status === 'upcoming' && !expo.publishedAt) expo.publishedAt = new Date();
  if (status === 'cancelled') expo.cancelledReason = reason;
  await expo.save();

  emitToExpo(expo._id, EVENTS.EXPO_UPDATED, { expoId: expo._id, action: 'updated' });
  emitToAll(EVENTS.EXPO_UPDATED, { expoId: expo._id, action: 'updated' });

  const messages = {
    upcoming: { title: `${expo.title} is open for registration`, body: 'Registration is now live — reserve your pass.' },
    ongoing: { title: `${expo.title} has started`, body: 'Check the schedule and floor plan for today.' },
    completed: { title: `${expo.title} has ended`, body: 'Thanks for joining! Share your feedback to help us improve.' },
    cancelled: { title: `${expo.title} has been cancelled`, body: reason || 'The organizer cancelled this expo.' },
  };

  if (messages[status]) {
    await notifyExpoAudience(expo, {
      type: status === 'cancelled' ? 'schedule_changed' : 'expo_published',
      title: messages[status].title,
      body: messages[status].body,
      priority: status === 'cancelled' ? 'high' : 'normal',
    });
  }

  return expo;
};

const publishExpo = (id, user) => updateStatus(id, 'upcoming', user);

const removeExpo = async (id, user) => {
  const expo = await Expo.findById(id);
  if (!expo) throw ApiError.notFound('Expo not found');
  assertOwner(expo, user);

  const attendees = await Registration.find({ expo: id, status: { $ne: 'cancelled' } }).select('user');
  await Promise.all([
    Booth.deleteMany({ expo: id }),
    Session.deleteMany({ expo: id }),
    FloorPlan.deleteMany({ expo: id }),
    ExpoApplication.deleteMany({ expo: id }),
    Announcement.deleteMany({ expo: id }),
    Registration.updateMany({ expo: id }, { $set: { status: 'cancelled', cancelledAt: new Date(), cancelReason: 'Expo removed by organizer' } }),
  ]);

  await expo.deleteOne();
  emitToExpo(id, EVENTS.EXPO_UPDATED, { expoId: id, action: 'deleted' });
  emitToAll(EVENTS.EXPO_UPDATED, { expoId: id, action: 'deleted' });

  await notificationService.createMany(attendees.map((r) => r.user), {
    type: 'schedule_changed',
    title: `${expo.title} was removed`,
    body: 'The organizer removed this expo. Your registration has been cancelled.',
    priority: 'high',
  });

  return { message: 'Expo deleted successfully', id };
};

/** Notify everyone involved in an expo (attendees, exhibitors, speakers). */
const notifyExpoAudience = async (expo, payload) => {
  const [registrations, applications] = await Promise.all([
    Registration.find({ expo: expo._id, status: { $ne: 'cancelled' } }).select('user'),
    ExpoApplication.find({ expo: expo._id, status: 'approved' }).select('applicant'),
  ]);
  const recipients = [...new Set([...registrations.map((r) => String(r.user)), ...applications.map((a) => String(a.applicant))])];
  await notificationService.createMany(recipients, { ...payload, data: { expoId: expo._id }, link: `/expos/${expo.slug}` });
  return recipients.length;
};

// ---------------------------------------------------------------------------
// Maintenance / scheduler support
// ---------------------------------------------------------------------------

const refreshStats = async (expoId) => {
  const [registrations, exhibitors, booths, sessions] = await Promise.all([
    Registration.countDocuments({ expo: expoId, status: { $ne: 'cancelled' } }),
    ExpoApplication.countDocuments({ expo: expoId, status: 'approved' }),
    Booth.countDocuments({ expo: expoId }),
    Session.countDocuments({ expo: expoId, status: { $ne: 'cancelled' } }),
  ]);
  const expo = await Expo.findByIdAndUpdate(
    expoId,
    { $set: { 'stats.registrations': registrations, 'stats.exhibitors': exhibitors, 'stats.booths': booths, 'stats.sessions': sessions } },
    { new: true },
  );
  return expo;
};

/** Drafts stay drafts until published; dates drive upcoming → ongoing → completed. */
const syncStatuses = async () => {
  const now = new Date();
  const results = await Promise.all([
    Expo.updateMany(
      { status: 'upcoming', startDate: { $lte: now }, endDate: { $gte: now }, publishedAt: { $ne: null } },
      { $set: { status: 'ongoing' } },
    ),
    Expo.updateMany({ status: 'ongoing', endDate: { $lt: now } }, { $set: { status: 'completed' } }),
  ]);
  return { started: results[0].modifiedCount || 0, completed: results[1].modifiedCount || 0 };
};

const organizerOptions = () => User.find({ role: 'admin' }).select('name email organization');

module.exports = {
  listExpos,
  findExpo,
  getExpoDetail,
  createExpo,
  updateExpo,
  updateStatus,
  publishExpo,
  removeExpo,
  refreshStats,
  notifyExpoAudience,
  syncStatuses,
  organizerOptions,
  assertOwner,
};

'use strict';

const mongoose = require('mongoose');
const { Session, SessionRegistration, Speaker, Expo, ExpoApplication, Registration } = require('../models');
const ApiError = require('../utils/ApiError');
const { getPagination, buildMeta, escapeRegex } = require('../utils/pagination');
const { pick, timeToMinutes, startOfDay, addDays } = require('../utils/helpers');
const { emitToExpo, EVENTS } = require('../sockets/emitter');
const notificationService = require('./notificationService');
const expoService = require('./expoService');

const EDITABLE = [
  'title',
  'description',
  'type',
  'category',
  'level',
  'date',
  'startTime',
  'endTime',
  'speakers',
  'location',
  'capacity',
  'status',
  'tags',
  'isFeatured',
  'requiresRegistration',
  'price',
  'materials',
];

const requireExpoForUser = async (expoId, user) => {
  const expo = await Expo.findById(expoId);
  if (!expo) throw ApiError.notFound('Expo not found');
  if (!user || user.role !== 'admin' || !expo.isOwner(user)) {
    throw ApiError.forbidden('Only the organizing team can manage this expo schedule');
  }
  return expo;
};

const assertNoRoomConflict = async ({ expo, date, startTime, endTime, room, excludeId }) => {
  if (!room) return;
  const sameDayStart = startOfDay(date);
  const sameDayEnd = addDays(sameDayStart, 1);
  const candidates = await Session.find({
    expo,
    date: { $gte: sameDayStart, $lt: sameDayEnd },
    'location.room': room,
    status: { $ne: 'cancelled' },
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  }).select('title startTime endTime location.room');

  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  const clash = candidates.find((item) => {
    const otherStart = timeToMinutes(item.startTime);
    const otherEnd = timeToMinutes(item.endTime);
    return start < otherEnd && otherStart < end;
  });
  if (clash) {
    throw ApiError.conflict(`"${room}" is already booked for "${clash.title}" (${clash.startTime}–${clash.endTime})`);
  }
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const listSessions = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};

  if (query.expo) filter.expo = query.expo;
  if (query.type) filter.type = { $in: String(query.type).split(',') };
  if (query.category) filter.category = query.category;
  if (query.level) filter.level = query.level;
  if (query.speaker) filter.speakers = query.speaker;
  if (query.status) filter.status = query.status;
  else if (!query.includeCancelled) filter.status = { $ne: 'cancelled' };
  if (query.featured === 'true') filter.isFeatured = true;

  const now = new Date();
  if (query.when === 'today') {
    filter.date = { $gte: startOfDay(now), $lt: addDays(startOfDay(now), 1) };
  } else if (query.when === 'tomorrow') {
    filter.date = { $gte: addDays(startOfDay(now), 1), $lt: addDays(startOfDay(now), 2) };
  } else if (query.when === 'upcoming') {
    filter.date = { $gte: startOfDay(now) };
  }
  if (query.date) filter.date = { $gte: startOfDay(query.date), $lt: addDays(startOfDay(query.date), 1) };
  if (query.from || query.to) {
    filter.date = {
      ...(filter.date || {}),
      ...(query.from ? { $gte: startOfDay(query.from) } : {}),
      ...(query.to ? { $lte: addDays(startOfDay(query.to), 1) } : {}),
    };
  }
  if (query.availableOnly === 'true') {
    filter.$expr = { $lt: ['$registeredCount', '$capacity'] };
  }
  if (query.q) {
    const regex = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ title: regex }, { description: regex }, { tags: regex }, { category: regex }, { 'location.room': regex }];
  }
  if (query.withSeatsLeft === 'true') {
    filter.$expr = { $lt: ['$registeredCount', '$capacity'] };
  }

  const [items, total] = await Promise.all([
    Session.find(filter)
      .populate('speakers', 'name photo title organization expertise')
      .populate('expo', 'title slug startDate endDate status location themeColors')
      .sort({ date: 1, startTime: 1 })
      .skip(skip)
      .limit(limit),
    Session.countDocuments(filter),
  ]);

  return { items, meta: buildMeta(total, page, limit) };
};

const getSession = async (id, user = null) => {
  const session = await Session.findById(id)
    .populate('speakers', 'name photo title organization bio expertise socials')
    .populate('expo', 'title slug startDate endDate status location')
    .populate('location.booth', 'number zone name');
  if (!session) throw ApiError.notFound('Session not found');

  const [registration, bookmarkCount, attendeeCount] = await Promise.all([
    user ? SessionRegistration.findOne({ user: user._id, session: session._id }) : null,
    SessionRegistration.countDocuments({ session: session._id, bookmarked: true }),
    SessionRegistration.countDocuments({ session: session._id, registered: true, status: { $ne: 'cancelled' } }),
  ]);

  return {
    session,
    myRegistration: registration ? registration.toJSON() : null,
    stats: {
      registered: attendeeCount,
      bookmarks: bookmarkCount,
      seatsRemaining: Math.max(0, session.capacity - attendeeCount),
      fillRate: session.capacity ? Math.round((attendeeCount / session.capacity) * 100) : 0,
    },
  };
};

/** Sessions grouped by calendar day for the schedule view. */
const scheduleByDate = async (expoId, query = {}) => {
  const { items } = await listSessions({ ...query, expo: expoId, limit: 200 });
  const grouped = items.reduce((acc, session) => {
    const key = new Date(session.date).toISOString().slice(0, 10);
    acc[key] = acc[key] || [];
    acc[key].push(session);
    return acc;
  }, {});
  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, sessions]) => ({ date, sessions }));
};

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

const createSession = async (payload, user) => {
  const expo = await requireExpoForUser(payload.expo, user);
  if (timeToMinutes(payload.endTime) <= timeToMinutes(payload.startTime)) {
    throw ApiError.badRequest('End time must be after the start time');
  }
  await assertNoRoomConflict({ expo: expo._id, date: payload.date, startTime: payload.startTime, endTime: payload.endTime, room: payload.location?.room });

  const session = await Session.create({
    ...pick(payload, EDITABLE),
    expo: expo._id,
    createdBy: user._id,
    location: { venue: expo.location?.venue || '', ...(payload.location || {}) },
    registeredCount: 0,
  });

  await expoService.refreshStats(expo._id);
  emitToExpo(expo._id, EVENTS.SCHEDULE_UPDATED, { expoId: expo._id, action: 'created', sessionId: session._id });
  return session;
};

const updateSession = async (id, payload, user) => {
  const session = await Session.findById(id);
  if (!session) throw ApiError.notFound('Session not found');
  const expo = await requireExpoForUser(session.expo, user);

  const before = `${session.date}|${session.startTime}|${session.endTime}|${session.location?.room}`;
  const nextDate = payload.date || session.date;
  const nextStart = payload.startTime || session.startTime;
  const nextEnd = payload.endTime || session.endTime;
  if (timeToMinutes(nextEnd) <= timeToMinutes(nextStart)) throw ApiError.badRequest('End time must be after the start time');

  await assertNoRoomConflict({
    expo: expo._id,
    date: nextDate,
    startTime: nextStart,
    endTime: nextEnd,
    room: payload.location?.room ?? session.location?.room,
    excludeId: session._id,
  });

  Object.assign(session, pick(payload, EDITABLE));
  await session.save();

  const after = `${session.date}|${session.startTime}|${session.endTime}|${session.location?.room}`;
  emitToExpo(expo._id, EVENTS.SCHEDULE_UPDATED, { expoId: expo._id, action: 'updated', sessionId: session._id });

  if (before !== after) {
    const registrations = await SessionRegistration.find({ session: session._id, registered: true, status: { $ne: 'cancelled' } }).select('user');
    await notificationService.createMany(registrations.map((r) => r.user), {
      type: 'schedule_changed',
      title: `Schedule change: ${session.title}`,
      body: `Now on ${new Date(session.date).toDateString()} from ${session.startTime} to ${session.endTime}${session.location?.room ? ` in ${session.location.room}` : ''}.`,
      priority: 'high',
      link: `/expos/${expo.slug}/schedule`,
      data: { sessionId: session._id, expoId: expo._id },
    });
    session.reminderSentAt = null; // allow a fresh reminder for the new slot
    await session.save();
  }

  return session;
};

const cancelSession = async (id, user, reason = '') => {
  const session = await Session.findById(id);
  if (!session) throw ApiError.notFound('Session not found');
  const expo = await requireExpoForUser(session.expo, user);

  session.status = 'cancelled';
  session.cancellationReason = reason;
  await session.save();

  const registrations = await SessionRegistration.find({ session: session._id, registered: true, status: { $ne: 'cancelled' } }).select('user');
  await SessionRegistration.updateMany({ session: session._id, status: { $ne: 'cancelled' } }, { $set: { status: 'cancelled', registered: false } });

  await notificationService.createMany(registrations.map((r) => r.user), {
    type: 'session_cancelled',
    title: `Cancelled: ${session.title}`,
    body: reason || 'This session was cancelled by the organizer. Any seat reservation has been released.',
    priority: 'high',
    link: `/expos/${expo.slug}/schedule`,
    data: { sessionId: session._id, expoId: expo._id },
  });

  emitToExpo(expo._id, EVENTS.SCHEDULE_UPDATED, { expoId: expo._id, action: 'cancelled', sessionId: session._id });
  await expoService.refreshStats(expo._id);
  return session;
};

const removeSession = async (id, user) => {
  const session = await Session.findById(id);
  if (!session) throw ApiError.notFound('Session not found');
  const expo = await requireExpoForUser(session.expo, user);
  await SessionRegistration.deleteMany({ session: session._id });
  await session.deleteOne();
  emitToExpo(expo._id, EVENTS.SCHEDULE_UPDATED, { expoId: expo._id, action: 'deleted', sessionId: session._id });
  await expoService.refreshStats(expo._id);
  return { message: 'Session deleted', id };
};

/** Register (or waitlist) the current user for a session. */
const registerForSession = async (sessionId, user) => {
  const session = await Session.findById(sessionId).populate('expo', 'title slug');
  if (!session) throw ApiError.notFound('Session not found');
  if (session.status === 'cancelled') throw ApiError.badRequest('This session has been cancelled');

  const existing = await SessionRegistration.findOne({ user: user._id, session: session._id });
  if (existing?.registered && existing.status !== 'cancelled') {
    throw ApiError.conflict('You are already registered for this session');
  }

  const registeredCount = await SessionRegistration.countDocuments({ session: session._id, registered: true, status: { $ne: 'cancelled' } });
  const full = registeredCount >= session.capacity;
  const status = full ? 'waitlisted' : 'registered';

  const record = await SessionRegistration.findOneAndUpdate(
    { user: user._id, session: session._id },
    {
      $set: {
        expo: session.expo._id,
        registered: !full,
        status,
        registeredAt: new Date(),
        cancelReason: '',
      },
      $setOnInsert: { bookmarked: false },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  session.registeredCount = full ? registeredCount : registeredCount + 1;
  session.waitlistCount = full ? (session.waitlistCount || 0) + 1 : session.waitlistCount;
  await session.save();

  await notificationService.create({
    userId: user._id,
    type: 'session_registered',
    title: full ? `Waitlisted: ${session.title}` : `Seat confirmed: ${session.title}`,
    body: full
      ? 'This session is full — you are on the waitlist and we will notify you if a seat opens up.'
      : `${new Date(session.date).toDateString()} • ${session.startTime}–${session.endTime}${session.location?.room ? ` • ${session.location.room}` : ''}`,
    link: '/attendee/sessions',
    data: { sessionId: session._id, expoId: session.expo._id },
  });

  emitToExpo(session.expo._id, EVENTS.SCHEDULE_UPDATED, { expoId: session.expo._id, action: 'registration', sessionId: session._id });
  return { registration: record, waitlisted: full, session };
};

const unregisterFromSession = async (sessionId, user) => {
  const session = await Session.findById(sessionId);
  if (!session) throw ApiError.notFound('Session not found');

  const record = await SessionRegistration.findOne({ user: user._id, session: session._id });
  if (!record || (!record.registered && record.status === 'cancelled')) {
    throw ApiError.badRequest('You are not registered for this session');
  }

  const wasRegistered = record.registered;
  record.registered = false;
  record.status = 'cancelled';
  record.cancelReason = 'Cancelled by attendee';
  await record.save();

  if (wasRegistered) {
    session.registeredCount = Math.max(0, (session.registeredCount || 1) - 1);
    // Promote the first person on the waitlist, if any.
    const next = await SessionRegistration.findOne({ session: session._id, status: 'waitlisted' }).sort({ registeredAt: 1 });
    if (next) {
      next.registered = true;
      next.status = 'registered';
      next.registeredAt = new Date();
      await next.save();
      session.waitlistCount = Math.max(0, (session.waitlistCount || 1) - 1);
      session.registeredCount += 1;
      await notificationService.create({
        userId: next.user,
        type: 'session_registered',
        title: `A seat opened for ${session.title}`,
        body: 'You moved off the waitlist — your seat is confirmed.',
        priority: 'high',
      });
    }
    await session.save();
  }

  return { message: 'Registration cancelled' };
};

/** Bookmarking keeps the record (and any seat) intact — it only saves for later. */
const toggleBookmark = async (sessionId, user, bookmarked = true) => {
  const session = await Session.findById(sessionId);
  if (!session) throw ApiError.notFound('Session not found');

  const record = await SessionRegistration.findOneAndUpdate(
    { user: user._id, session: session._id },
    { $set: { bookmarked, expo: session.expo } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
  return record;
};

const myAgenda = async (user, query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { user: user._id };
  if (query.kind === 'bookmarks') filter.bookmarked = true;
  else if (query.kind === 'registered') { filter.registered = true; filter.status = { $ne: 'cancelled' }; }
  else filter.$or = [{ registered: true, status: { $ne: 'cancelled' } }, { bookmarked: true }];

  const [items, total] = await Promise.all([
    SessionRegistration.find(filter)
      .populate({
        path: 'session',
        populate: [
          { path: 'speakers', select: 'name photo title organization' },
          { path: 'expo', select: 'title slug startDate endDate status location' },
        ],
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    SessionRegistration.countDocuments(filter),
  ]);

  return { items: items.filter((i) => i.session), meta: buildMeta(total, page, limit) };
};

// ---------------------------------------------------------------------------
// Speakers
// ---------------------------------------------------------------------------

const listSpeakers = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.q) {
    const regex = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ name: regex }, { organization: regex }, { expertise: regex }];
  }
  if (query.expertise) filter.expertise = query.expertise;
  const [items, total] = await Promise.all([
    Speaker.find(filter).sort({ isFeatured: -1, name: 1 }).skip(skip).limit(limit),
    Speaker.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(total, page, limit) };
};

const createSpeaker = async (payload) =>
  Speaker.create(pick(payload, ['name', 'title', 'organization', 'bio', 'photo', 'email', 'expertise', 'socials', 'isFeatured', 'user']));

const updateSpeaker = async (id, payload) => {
  const speaker = await Speaker.findByIdAndUpdate(id, pick(payload, ['name', 'title', 'organization', 'bio', 'photo', 'email', 'expertise', 'socials', 'isFeatured', 'user']), {
    new: true,
    runValidators: true,
  });
  if (!speaker) throw ApiError.notFound('Speaker not found');
  return speaker;
};

const removeSpeaker = async (id) => {
  const speaker = await Speaker.findById(id);
  if (!speaker) throw ApiError.notFound('Speaker not found');
  await Session.updateMany({ speakers: id }, { $pull: { speakers: id } });
  await speaker.deleteOne();
  return { message: 'Speaker removed', id };
};

/** Sessions starting inside the reminder window that still need a notification. */
const dueReminders = async (leadMinutes = 30) => {
  const now = new Date();
  const horizon = new Date(now.getTime() + leadMinutes * 60 * 1000);
  const sessions = await Session.find({
    status: 'scheduled',
    reminderSentAt: null,
    date: { $gte: startOfDay(now), $lte: addDays(startOfDay(now), 1) },
  }).populate('expo', 'title slug');

  return sessions.filter((session) => {
    const start = session.getDateTime();
    return start > now && start <= horizon;
  });
};

const popularity = async (expoId, limit = 8) =>
  Session.aggregate([
    { $match: { expo: new mongoose.Types.ObjectId(String(expoId)), status: { $ne: 'cancelled' } } },
    { $sort: { registeredCount: -1 } },
    { $limit: limit },
    { $project: { title: 1, type: 1, registeredCount: 1, capacity: 1, date: 1, startTime: 1 } },
  ]);

const mySessionsAsSpeaker = async (user) => {
  const speaker = await Speaker.findOne({ user: user._id });
  if (!speaker) return { speaker: null, sessions: [] };
  const sessions = await Session.find({ speakers: speaker._id }).populate('expo', 'title slug startDate').sort({ date: 1, startTime: 1 });
  return { speaker, sessions };
};

module.exports = {
  listSessions,
  getSession,
  scheduleByDate,
  createSession,
  updateSession,
  cancelSession,
  removeSession,
  registerForSession,
  unregisterFromSession,
  toggleBookmark,
  myAgenda,
  listSpeakers,
  createSpeaker,
  updateSpeaker,
  removeSpeaker,
  dueReminders,
  popularity,
  mySessionsAsSpeaker,
  attendeeIdsForSession: async (sessionId) =>
    (await SessionRegistration.find({ session: sessionId, registered: true, status: { $ne: 'cancelled' } }).select('user')).map((r) => r.user),
};

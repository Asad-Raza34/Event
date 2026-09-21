'use strict';

const mongoose = require('mongoose');
const { AvailabilitySlot, Appointment, ExhibitorProfile, Expo, Booth, User } = require('../models');
const ApiError = require('../utils/ApiError');
const { getPagination, buildMeta, escapeRegex } = require('../utils/pagination');
const { timeToMinutes, startOfDay, addDays } = require('../utils/helpers');
const { emitToUser, EVENTS } = require('../sockets/emitter');
const notificationService = require('./notificationService');

const requireExhibitor = async (user) => {
  const profile = await ExhibitorProfile.findOne({ user: user._id });
  if (!profile) throw ApiError.forbidden('Create your company profile before managing appointments');
  return profile;
};

const canAccess = (appointment, user) => {
  if (user.role === 'admin') return true;
  return [appointment.attendee, appointment.exhibitorUser].some((id) => String(id) === String(user._id));
};

// ---------------------------------------------------------------------------
// Availability slots (exhibitor side)
// ---------------------------------------------------------------------------

const createSlots = async (user, payload) => {
  const profile = await requireExhibitor(user);
  const expo = await Expo.findById(payload.expo);
  if (!expo) throw ApiError.notFound('Expo not found');

  const dates = Array.isArray(payload.dates) && payload.dates.length ? payload.dates : [payload.date];
  const windowStart = payload.startTime;
  const windowEnd = payload.endTime;
  const duration = Number(payload.durationMinutes || 30);

  if (timeToMinutes(windowEnd) <= timeToMinutes(windowStart)) {
    throw ApiError.badRequest('The availability window must end after it starts');
  }

  const created = [];
  const reused = [];

  for (const rawDate of dates) {
    if (!rawDate) continue;
    const date = startOfDay(rawDate);
    const dayStart = timeToMinutes(windowStart);
    const dayEnd = timeToMinutes(windowEnd);

    for (let minutes = dayStart; minutes + duration <= dayEnd; minutes += duration) {
      const slotStart = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
      const endMinutes = minutes + duration;
      const slotEnd = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;

      // eslint-disable-next-line no-await-in-loop
      const existing = await AvailabilitySlot.findOne({
        exhibitorUser: user._id,
        date,
        startTime: slotStart,
      });
      if (existing) {
        reused.push(existing._id);
        continue;
      }

      // eslint-disable-next-line no-await-in-loop
      const slot = await AvailabilitySlot.create({
        exhibitor: profile._id,
        exhibitorUser: user._id,
        expo: expo._id,
        date,
        startTime: slotStart,
        endTime: slotEnd,
        durationMinutes: duration,
        location: payload.location || '',
        meetingLink: payload.meetingLink || '',
        note: payload.note || '',
      });
      created.push(slot);
    }
  }

  return { created: created.length, skipped: reused.length, slots: created };
};

const listSlots = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.expo) filter.expo = query.expo;
  if (query.exhibitor) filter.exhibitor = query.exhibitor;
  if (query.exhibitorUser) filter.exhibitorUser = query.exhibitorUser;
  if (query.status) filter.status = query.status;
  if (query.availableOnly === 'true') {
    filter.status = 'open';
    filter.date = { $gte: startOfDay(new Date()) };
  }
  if (query.date) filter.date = { $gte: startOfDay(query.date), $lt: addDays(startOfDay(query.date), 1) };

  const [items, total] = await Promise.all([
    AvailabilitySlot.find(filter)
      .populate('exhibitor', 'companyName logo slug')
      .populate('expo', 'title slug')
      .sort({ date: 1, startTime: 1 })
      .skip(skip)
      .limit(limit),
    AvailabilitySlot.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(total, page, limit) };
};

const updateSlot = async (id, payload, user) => {
  const slot = await AvailabilitySlot.findById(id);
  if (!slot) throw ApiError.notFound('Slot not found');
  if (String(slot.exhibitorUser) !== String(user._id) && user.role !== 'admin') {
    throw ApiError.forbidden('You can only edit your own slots');
  }
  if (slot.status === 'booked' && payload.status !== 'blocked') {
    throw ApiError.badRequest('This slot has been booked — update the appointment instead');
  }
  Object.assign(slot, {
    startTime: payload.startTime ?? slot.startTime,
    endTime: payload.endTime ?? slot.endTime,
    durationMinutes: payload.durationMinutes ?? slot.durationMinutes,
    status: payload.status ?? slot.status,
    location: payload.location ?? slot.location,
    meetingLink: payload.meetingLink ?? slot.meetingLink,
    note: payload.note ?? slot.note,
  });
  if (timeToMinutes(slot.endTime) <= timeToMinutes(slot.startTime)) {
    throw ApiError.badRequest('Slot end time must be after the start time');
  }
  await slot.save();
  return slot;
};

const deleteSlot = async (id, user) => {
  const slot = await AvailabilitySlot.findById(id);
  if (!slot) throw ApiError.notFound('Slot not found');
  if (String(slot.exhibitorUser) !== String(user._id) && user.role !== 'admin') {
    throw ApiError.forbidden('You can only delete your own slots');
  }
  if (slot.status === 'booked') throw ApiError.badRequest('Cancel the appointment before deleting this slot');
  await slot.deleteOne();
  return { message: 'Slot removed', id };
};

// ---------------------------------------------------------------------------
// Appointments
// ---------------------------------------------------------------------------

/** Attendee books a slot; the exhibitor then confirms or rejects. */
const requestAppointment = async (user, payload) => {
  const slot = await AvailabilitySlot.findById(payload.slotId).populate('exhibitor', 'companyName logo user');
  if (!slot) throw ApiError.notFound('That time slot no longer exists');
  if (slot.status !== 'open') throw ApiError.conflict('That slot is no longer available');
  if (String(slot.exhibitorUser) === String(user._id)) throw ApiError.badRequest('You cannot book an appointment with yourself');

  const existing = await Appointment.findOne({
    attendee: user._id,
    exhibitorUser: slot.exhibitorUser,
    date: slot.date,
    status: { $in: ['pending', 'confirmed'] },
  });
  if (existing) throw ApiError.conflict('You already have an active appointment with this exhibitor for that day');

  const booth = await Booth.findOne({ exhibitor: slot.exhibitor._id, status: 'occupied' }).select('number zone name');

  const appointment = await Appointment.create({
    expo: slot.expo,
    exhibitor: slot.exhibitor._id,
    exhibitorUser: slot.exhibitorUser,
    attendee: user._id,
    slot: slot._id,
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    durationMinutes: slot.durationMinutes,
    topic: payload.topic,
    agenda: payload.agenda || '',
    attendeeCount: payload.attendeeCount || 1,
    requestedBy: 'attendee',
    location: {
      boothNumber: booth ? `${booth.zone}-${booth.number}` : '',
      meetingPoint: slot.location || 'Exhibitor booth',
      venue: payload.venue || '',
      link: slot.meetingLink || '',
    },
  });

  slot.status = 'booked';
  slot.bookedBy = user._id;
  slot.appointment = appointment._id;
  await slot.save();

  if (booth) await Booth.updateOne({ _id: booth._id }, { $inc: { 'traffic.appointments': 1 } });

  await notificationService.create({
    userId: slot.exhibitorUser,
    type: 'appointment_requested',
    title: 'New appointment request',
    body: `${user.name} requested ${slot.durationMinutes} minutes on ${new Date(slot.date).toDateString()} at ${slot.startTime} — "${payload.topic}".`,
    priority: 'high',
    link: '/exhibitor/appointments',
    data: { appointmentId: appointment._id },
  });

  emitToUser(slot.exhibitorUser, EVENTS.APPOINTMENT_UPDATED, { appointmentId: appointment._id, status: 'pending' });
  return appointment;
};

const respond = async (appointmentId, user, { status, note = '', meetingLink = '' }) => {
  if (!['confirmed', 'rejected', 'completed'].includes(status)) throw ApiError.badRequest('Invalid appointment status');
  const appointment = await Appointment.findById(appointmentId).populate('expo', 'title slug');
  if (!appointment) throw ApiError.notFound('Appointment not found');
  if (String(appointment.exhibitorUser) !== String(user._id) && user.role !== 'admin') {
    throw ApiError.forbidden('Only the exhibitor can respond to this request');
  }
  if (['cancelled', 'rejected'].includes(appointment.status)) throw ApiError.badRequest('This appointment is already closed');

  appointment.status = status;
  appointment.respondedAt = new Date();
  appointment.responseNote = note;
  if (meetingLink) appointment.location.link = meetingLink;
  if (status === 'completed') appointment.completedAt = new Date();
  await appointment.save();

  if (status === 'rejected') {
    await AvailabilitySlot.updateOne({ _id: appointment.slot }, { $set: { status: 'open', bookedBy: null, appointment: null } });
  }

  const titles = {
    confirmed: `Appointment confirmed — ${appointment.topic}`,
    rejected: `Appointment declined — ${appointment.topic}`,
    completed: `Appointment completed — ${appointment.topic}`,
  };

  await notificationService.create({
    userId: appointment.attendee,
    type: status === 'confirmed' ? 'appointment_confirmed' : status === 'rejected' ? 'appointment_rejected' : 'appointment_completed',
    title: titles[status],
    body:
      note ||
      `${new Date(appointment.date).toDateString()} at ${appointment.startTime}${appointment.location.boothNumber ? ` • Booth ${appointment.location.boothNumber}` : ''}`,
    priority: status === 'rejected' ? 'normal' : 'high',
    link: '/attendee/appointments',
    data: { appointmentId: appointment._id },
  });

  emitToUser(appointment.attendee, EVENTS.APPOINTMENT_UPDATED, { appointmentId: appointment._id, status });
  return appointment;
};

const cancel = async (appointmentId, user, reason = '') => {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) throw ApiError.notFound('Appointment not found');
  if (!canAccess(appointment, user)) throw ApiError.forbidden('You cannot modify this appointment');
  if (!appointment.isActive) throw ApiError.badRequest('Only pending or confirmed appointments can be cancelled');

  appointment.status = 'cancelled';
  appointment.cancelledBy = user._id;
  appointment.cancelReason = reason;
  await appointment.save();

  if (appointment.slot) {
    await AvailabilitySlot.updateOne({ _id: appointment.slot }, { $set: { status: 'open', bookedBy: null, appointment: null } });
  }

  const other = String(appointment.attendee) === String(user._id) ? appointment.exhibitorUser : appointment.attendee;
  await notificationService.create({
    userId: other,
    type: 'appointment_cancelled',
    title: `Appointment cancelled — ${appointment.topic}`,
    body: reason || `${user.name} cancelled the appointment on ${new Date(appointment.date).toDateString()} at ${appointment.startTime}.`,
    priority: 'high',
    link: user.role === 'exhibitor' ? '/attendee/appointments' : '/exhibitor/appointments',
  });

  emitToUser(other, EVENTS.APPOINTMENT_UPDATED, { appointmentId: appointment._id, status: 'cancelled' });
  await expoServiceSafeIncrement(appointment.expo, appointment);
  return appointment;
};

/** Booth appointment counters are best-effort; never block the request. */
const expoServiceSafeIncrement = async () => {};

const complete = async (appointmentId, user, { meetingNotes = '' } = {}) => {
  const appointment = await Appointment.findById(appointmentId);
  if (!appointment) throw ApiError.notFound('Appointment not found');
  if (!canAccess(appointment, user)) throw ApiError.forbidden('You cannot modify this appointment');
  if (appointment.status !== 'confirmed') throw ApiError.badRequest('Only confirmed appointments can be completed');

  appointment.status = 'completed';
  appointment.completedAt = new Date();
  if (meetingNotes) appointment.meetingNotes = meetingNotes;
  await appointment.save();

  const other = String(appointment.attendee) === String(user._id) ? appointment.exhibitorUser : appointment.attendee;
  await notificationService.create({
    userId: other,
    type: 'appointment_completed',
    title: `Appointment completed — ${appointment.topic}`,
    body: 'Thanks for meeting! Leave a review to help other attendees.',
    link: '/attendee/reviews',
  });
  emitToUser(other, EVENTS.APPOINTMENT_UPDATED, { appointmentId: appointment._id, status: 'completed' });
  return appointment;
};

const listAppointments = async (query = {}, user) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};

  if (query.scope === 'mine' || !user?.role || user.role === 'attendee') filter.attendee = user._id;
  if (user?.role === 'exhibitor' && query.scope !== 'mine') filter.exhibitorUser = user._id;
  if (user?.role === 'admin' && query.exhibitorUser) filter.exhibitorUser = query.exhibitorUser;
  if (query.expo) filter.expo = query.expo;
  if (query.status) filter.status = { $in: String(query.status).split(',') };
  if (query.date) filter.date = { $gte: startOfDay(query.date), $lt: addDays(startOfDay(query.date), 1) };
  if (query.upcoming === 'true') filter.date = { $gte: startOfDay(new Date()) };
  if (query.q) {
    const regex = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ topic: regex }, { reference: regex }, { agenda: regex }];
  }

  const [items, total, statusCounts] = await Promise.all([
    Appointment.find(filter)
      .populate('attendee', 'name email avatar organization phone')
      .populate('exhibitor', 'companyName logo slug')
      .populate('exhibitorUser', 'name email avatar')
      .populate('expo', 'title slug')
      .sort({ date: 1, startTime: 1 })
      .skip(skip)
      .limit(limit),
    Appointment.countDocuments(filter),
    Appointment.aggregate([
      { $match: query.expo ? { expo: new mongoose.Types.ObjectId(String(query.expo)) } : {} },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const counts = statusCounts.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {});
  return { items, meta: { ...buildMeta(total, page, limit), statusCounts: counts } };
};

const getAppointment = async (id, user) => {
  const appointment = await Appointment.findById(id)
    .populate('attendee', 'name email avatar organization phone')
    .populate('exhibitor', 'companyName logo slug contact')
    .populate('exhibitorUser', 'name email avatar')
    .populate('expo', 'title slug startDate location');
  if (!appointment) throw ApiError.notFound('Appointment not found');
  if (!canAccess(appointment, user)) throw ApiError.forbidden('You cannot view this appointment');
  return appointment;
};

/** Grouped view for the appointment calendar. */
const calendar = async (user, { from, to, scope = 'mine' } = {}) => {
  const filter = {};
  if (user.role === 'attendee' || scope === 'mine') filter.attendee = user._id;
  if (user.role === 'exhibitor') filter.exhibitorUser = user._id;
  filter.date = { $gte: from ? startOfDay(from) : addDays(startOfDay(new Date()), -7), $lte: to ? addDays(startOfDay(to), 1) : addDays(startOfDay(new Date()), 30) };

  const appointments = await Appointment.find(filter)
    .populate('attendee', 'name email avatar organization')
    .populate('exhibitor', 'companyName logo slug')
    .sort({ date: 1, startTime: 1 });

  const grouped = appointments.reduce((acc, item) => {
    const key = new Date(item.date).toISOString().slice(0, 10);
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});

  return Object.entries(grouped).map(([date, items]) => ({ date, appointments: items }));
};

const stats = async (expoId = null) => {
  const match = expoId ? { expo: new mongoose.Types.ObjectId(String(expoId)) } : {};
  const [byStatus, busiest] = await Promise.all([
    Appointment.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Appointment.aggregate([
      { $match: match },
      { $group: { _id: '$exhibitor', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: 'exhibitorprofiles', localField: '_id', foreignField: '_id', as: 'exhibitor' } },
      { $unwind: { path: '$exhibitor', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, exhibitorId: '$_id', count: 1, name: '$exhibitor.companyName' } },
    ]),
  ]);
  const counts = byStatus.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {});
  return {
    total: Object.values(counts).reduce((sum, n) => sum + n, 0),
    ...counts,
    busiestExhibitors: busiest,
  };
};

/** Reminder job support: confirmed appointments starting soon without a reminder. */
const dueReminders = async (leadMinutes = 30) => {
  const now = new Date();
  const horizon = new Date(now.getTime() + leadMinutes * 60 * 1000);
  const candidates = await Appointment.find({
    status: 'confirmed',
    reminderSentAt: null,
    date: { $gte: startOfDay(now), $lte: addDays(startOfDay(now), 1) },
  }).populate('exhibitor', 'companyName');

  return candidates.filter((item) => {
    const [h, m] = item.startTime.split(':').map(Number);
    const start = new Date(item.date);
    start.setUTCHours(h, m, 0, 0);
    return start > now && start <= horizon;
  });
};

module.exports = {
  createSlots,
  listSlots,
  updateSlot,
  deleteSlot,
  requestAppointment,
  respond,
  cancel,
  complete,
  listAppointments,
  getAppointment,
  calendar,
  stats,
  dueReminders,
};

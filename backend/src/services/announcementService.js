'use strict';

const { Announcement, Expo, Registration, ExpoApplication, User } = require('../models');
const ApiError = require('../utils/ApiError');
const { getPagination, buildMeta } = require('../utils/pagination');
const { emitToExpo, EVENTS } = require('../sockets/emitter');
const notificationService = require('./notificationService');

const requireExpoForUser = async (expoId, user) => {
  const expo = await Expo.findById(expoId);
  if (!expo) throw ApiError.notFound('Expo not found');
  if (!user || user.role !== 'admin' || !expo.isOwner(user)) {
    throw ApiError.forbidden('Only the organizing team can post announcements for this expo');
  }
  return expo;
};

const resolveAudience = async (expoId, audience) => {
  if (audience === 'attendees') {
    const registrations = await Registration.find({ expo: expoId, status: { $ne: 'cancelled' } }).select('user');
    return registrations.map((r) => String(r.user));
  }
  if (audience === 'exhibitors') {
    const applications = await ExpoApplication.find({ expo: expoId, status: 'approved' }).select('applicant');
    return applications.map((a) => String(a.applicant));
  }
  if (audience === 'speakers') {
    const admins = await User.find({ role: 'admin' }).select('_id');
    return admins.map((a) => String(a._id));
  }
  const [registrations, applications] = await Promise.all([
    Registration.find({ expo: expoId, status: { $ne: 'cancelled' } }).select('user'),
    ExpoApplication.find({ expo: expoId, status: 'approved' }).select('applicant'),
  ]);
  return [...new Set([...registrations.map((r) => String(r.user)), ...applications.map((a) => String(a.applicant))])];
};

const createAnnouncement = async (payload, user) => {
  const expo = await requireExpoForUser(payload.expo, user);
  const recipients = await resolveAudience(expo._id, payload.audience || 'all');

  const announcement = await Announcement.create({
    expo: expo._id,
    author: user._id,
    title: payload.title,
    body: payload.body,
    audience: payload.audience || 'all',
    priority: payload.priority || 'normal',
    pinned: Boolean(payload.pinned),
    channel: payload.channel || 'in_app',
    expiresAt: payload.expiresAt || null,
    recipientCount: recipients.length,
  });

  await notificationService.createMany(recipients, {
    type: 'announcement',
    title: payload.title,
    body: payload.body.slice(0, 500),
    priority: payload.priority === 'urgent' ? 'high' : 'normal',
    link: `/expos/${expo.slug}`,
    data: { expoId: expo._id, announcementId: announcement._id },
    createdBy: user._id,
  });

  emitToExpo(expo._id, EVENTS.ANNOUNCEMENT_NEW, {
    announcement: announcement.toJSON(),
    expoId: expo._id,
  });

  return announcement;
};

const listAnnouncements = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.expo) filter.expo = query.expo;
  if (query.audience) filter.audience = { $in: [query.audience, 'all'] };
  if (query.active === 'true') filter.$or = [{ expiresAt: null }, { expiresAt: { $gte: new Date() } }];

  const [items, total] = await Promise.all([
    Announcement.find(filter)
      .populate('author', 'name avatar role')
      .populate('expo', 'title slug')
      .sort({ pinned: -1, publishedAt: -1 })
      .skip(skip)
      .limit(limit),
    Announcement.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(total, page, limit) };
};

const updateAnnouncement = async (id, payload, user) => {
  const announcement = await Announcement.findById(id);
  if (!announcement) throw ApiError.notFound('Announcement not found');
  await requireExpoForUser(announcement.expo, user);
  Object.assign(announcement, {
    title: payload.title ?? announcement.title,
    body: payload.body ?? announcement.body,
    audience: payload.audience ?? announcement.audience,
    priority: payload.priority ?? announcement.priority,
    pinned: payload.pinned ?? announcement.pinned,
    expiresAt: payload.expiresAt ?? announcement.expiresAt,
  });
  await announcement.save();
  return announcement;
};

const removeAnnouncement = async (id, user) => {
  const announcement = await Announcement.findById(id);
  if (!announcement) throw ApiError.notFound('Announcement not found');
  await requireExpoForUser(announcement.expo, user);
  await announcement.deleteOne();
  return { message: 'Announcement deleted', id };
};

module.exports = { createAnnouncement, listAnnouncements, updateAnnouncement, removeAnnouncement, resolveAudience };

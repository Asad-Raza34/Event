'use strict';

const { Notification } = require('../models');
const { getPagination, buildMeta } = require('../utils/pagination');
const ApiError = require('../utils/ApiError');
const { emitToUser, EVENTS } = require('../sockets/emitter');

/**
 * Creates a notification and pushes it to the user's socket room.
 * `dedupeKey` makes creation idempotent: a repeated key is silently ignored,
 * which keeps scheduled jobs (session reminders, status changes) safe to re-run.
 */
const create = async ({
  userId,
  type = 'system',
  title,
  body = '',
  data = {},
  link = '',
  priority = 'normal',
  dedupeKey = null,
  createdBy = null,
  silent = false,
} = {}) => {
  if (!userId || !title) return null;
  try {
    const notification = await Notification.create({
      user: userId,
      type,
      title,
      body,
      data,
      link,
      priority,
      dedupeKey,
      createdBy,
    });
    if (!silent) emitToUser(userId, EVENTS.NOTIFICATION_NEW, notification.toJSON());
    return notification;
  } catch (error) {
    if (error.code === 11000) return null; // duplicate dedupeKey — already delivered
    throw error;
  }
};

/** Fan-out helper: one payload, many recipients, failures never break the caller. */
const createMany = async (userIds = [], payload = {}) => {
  const unique = [...new Set(userIds.filter(Boolean).map(String))];
  const created = [];
  for (const userId of unique) {
    // Sequential to keep the dedupe index meaningful; batches are small.
    // eslint-disable-next-line no-await-in-loop
    const item = await create({ ...payload, userId }).catch(() => null);
    if (item) created.push(item);
  }
  return created;
};

const list = async (userId, query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { user: userId };
  if (query.unread === 'true' || query.unread === true) filter.read = false;
  if (query.type) filter.type = query.type;

  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: userId, read: false }),
  ]);

  return { items, meta: { ...buildMeta(total, page, limit), unread } };
};

const unreadCount = (userId) => Notification.countDocuments({ user: userId, read: false });

const markRead = async (userId, ids = []) => {
  const filter = { user: userId, read: false };
  if (Array.isArray(ids) && ids.length) filter._id = { $in: ids };
  const result = await Notification.updateMany(filter, { $set: { read: true, readAt: new Date() } });
  emitToUser(userId, EVENTS.NOTIFICATION_READ, { ids, all: !ids.length });
  return { modified: result.modifiedCount || 0, unread: await unreadCount(userId) };
};

const markAllRead = (userId) => markRead(userId, []);

const remove = async (userId, id) => {
  const notification = await Notification.findOneAndDelete({ _id: id, user: userId });
  if (!notification) throw ApiError.notFound('Notification not found');
  return notification;
};

const clearRead = async (userId) => {
  const result = await Notification.deleteMany({ user: userId, read: true });
  return { deleted: result.deletedCount || 0 };
};

module.exports = { create, createMany, list, unreadCount, markRead, markAllRead, remove, clearRead };

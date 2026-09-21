'use strict';

const mongoose = require('mongoose');
const { Feedback, SupportTicket, Expo, User } = require('../models');
const ApiError = require('../utils/ApiError');
const { getPagination, buildMeta, escapeRegex } = require('../utils/pagination');
const notificationService = require('./notificationService');

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

const createFeedback = async (user, payload) => {
  if (payload.expo) {
    const exists = await Expo.exists({ _id: payload.expo });
    if (!exists) throw ApiError.notFound('Expo not found');
  }

  const feedback = await Feedback.create({
    user: user?._id || null,
    name: payload.isAnonymous ? 'Anonymous' : payload.name || user?.name || 'Anonymous',
    email: payload.isAnonymous ? '' : payload.email || user?.email || '',
    expo: payload.expo || null,
    session: payload.session || null,
    category: payload.category || 'general',
    subject: payload.subject,
    message: payload.message,
    rating: payload.rating || null,
    isAnonymous: Boolean(payload.isAnonymous),
    tags: payload.tags || [],
  });

  const organizers = await User.find({ role: 'admin' }).select('_id');
  await notificationService.createMany(organizers.map((o) => o._id), {
    type: 'system',
    title: `New ${feedback.category} feedback`,
    body: feedback.subject,
    link: '/admin/feedback',
    data: { feedbackId: feedback._id },
  });

  return feedback;
};

const listFeedback = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.category) filter.category = query.category;
  if (query.expo) filter.expo = query.expo;
  if (query.mine === 'true') filter.user = query.userId;
  if (query.q) {
    const regex = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ subject: regex }, { message: regex }, { name: regex }];
  }

  const [items, total, byStatus] = await Promise.all([
    Feedback.find(filter)
      .populate('user', 'name email role avatar')
      .populate('expo', 'title slug')
      .populate('respondedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Feedback.countDocuments(filter),
    Feedback.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  return { items, meta: { ...buildMeta(total, page, limit), statusCounts: byStatus.reduce((a, i) => ({ ...a, [i._id]: i.count }), {}) } };
};

const respondToFeedback = async (id, admin, { response = '', status }) => {
  const feedback = await Feedback.findById(id);
  if (!feedback) throw ApiError.notFound('Feedback not found');

  if (status && !['new', 'reviewed', 'resolved', 'archived'].includes(status)) throw ApiError.badRequest('Invalid feedback status');
  if (response) {
    feedback.response = response;
    feedback.respondedBy = admin._id;
    feedback.respondedAt = new Date();
  }
  feedback.status = status || (response ? 'reviewed' : feedback.status);
  await feedback.save();

  if (feedback.user && response) {
    await notificationService.create({
      userId: feedback.user,
      type: 'system',
      title: 'Reply to your feedback',
      body: response.slice(0, 200),
      link: '/attendee/feedback',
      createdBy: admin._id,
      data: { feedbackId: feedback._id },
    });
  }
  return feedback;
};

const feedbackStats = async (expoId = null) => {
  const match = expoId ? { expo: new mongoose.Types.ObjectId(String(expoId)) } : {};
  const [byCategory, byStatus, average] = await Promise.all([
    Feedback.aggregate([{ $match: match }, { $group: { _id: '$category', count: { $sum: 1 } } }]),
    Feedback.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Feedback.aggregate([{ $match: { ...match, rating: { $ne: null } } }, { $group: { _id: null, avg: { $avg: '$rating' } } }]),
  ]);
  return {
    byCategory: byCategory.map((c) => ({ category: c._id, count: c.count })),
    byStatus: byStatus.map((s) => ({ status: s._id, count: s.count })),
    averageRating: Math.round((average[0]?.avg || 0) * 10) / 10,
  };
};

// ---------------------------------------------------------------------------
// Support tickets
// ---------------------------------------------------------------------------

const createTicket = async (user, payload) => {
  const ticket = await SupportTicket.create({
    user: user._id,
    subject: payload.subject,
    description: payload.description,
    category: payload.category || 'other',
    priority: payload.priority || 'medium',
    relatedExpo: payload.relatedExpo || null,
    attachments: payload.attachments || [],
    messages: [
      {
        author: user._id,
        authorName: user.name,
        authorRole: user.role,
        body: payload.description,
        isStaff: user.role === 'admin',
      },
    ],
  });

  const organizers = await User.find({ role: 'admin' }).select('_id');
  await notificationService.createMany(organizers.map((o) => o._id), {
    type: 'support_ticket_update',
    title: `New ${ticket.priority} priority ticket`,
    body: `${ticket.ticketNumber}: ${ticket.subject}`,
    priority: ticket.priority === 'urgent' ? 'high' : 'normal',
    link: '/admin/support',
    data: { ticketId: ticket._id },
  });

  return ticket;
};

const listTickets = async (query = {}, user) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};

  const isStaff = user?.role === 'admin';
  if (!isStaff) filter.user = user?._id;
  else if (query.userId) filter.user = query.userId;
  if (query.status) filter.status = query.status;
  if (query.priority) filter.priority = query.priority;
  if (query.category) filter.category = query.category;
  if (query.assignedTo) filter.assignedTo = query.assignedTo;
  if (query.q) {
    const regex = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ subject: regex }, { description: regex }, { ticketNumber: regex }];
  }

  const [items, total, byStatus] = await Promise.all([
    SupportTicket.find(filter)
      .populate('user', 'name email role avatar organization')
      .populate('assignedTo', 'name email')
      .sort({ lastActivityAt: -1 })
      .skip(skip)
      .limit(limit),
    SupportTicket.countDocuments(filter),
    SupportTicket.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  return {
    items,
    meta: {
      ...buildMeta(total, page, limit),
      statusCounts: byStatus.reduce((a, i) => ({ ...a, [i._id]: i.count }), {}),
      isStaff,
    },
  };
};

const getTicket = async (id, user) => {
  const ticket = await SupportTicket.findById(id)
    .populate('user', 'name email role avatar organization')
    .populate('assignedTo', 'name email')
    .populate('relatedExpo', 'title slug')
    .populate('messages.author', 'name role avatar');
  if (!ticket) throw ApiError.notFound('Support ticket not found');
  if (user.role !== 'admin' && String(ticket.user._id) !== String(user._id)) {
    throw ApiError.forbidden('This ticket belongs to another account');
  }
  return ticket;
};

const addTicketMessage = async (ticketId, user, payload) => {
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw ApiError.notFound('Support ticket not found');
  if (user.role !== 'admin' && String(ticket.user) !== String(user._id)) {
    throw ApiError.forbidden('This ticket belongs to another account');
  }
  if (ticket.status === 'closed') throw ApiError.badRequest('Closed tickets cannot receive new messages');

  const isStaff = user.role === 'admin';
  ticket.messages.push({
    author: user._id,
    authorName: user.name,
    authorRole: user.role,
    body: payload.body,
    isStaff,
    attachments: payload.attachments || [],
  });
  ticket.lastActivityAt = new Date();

  // A user reply reopens the conversation for the support team.
  if (!isStaff && ['resolved', 'closed'].includes(ticket.status)) ticket.status = 'open';
  if (isStaff && ticket.status === 'open') ticket.status = 'in_progress';
  await ticket.save();

  const notifyUser = isStaff ? ticket.user : null;
  if (notifyUser) {
    await notificationService.create({
      userId: notifyUser,
      type: 'support_ticket_update',
      title: `Support replied to ${ticket.ticketNumber}`,
      body: payload.body.slice(0, 200),
      link: '/attendee/support',
      data: { ticketId: ticket._id },
    });
  } else {
    const organizers = await User.find({ role: 'admin' }).select('_id');
    await notificationService.createMany(organizers.map((o) => o._id), {
      type: 'support_ticket_update',
      title: `New reply on ${ticket.ticketNumber}`,
      body: `${user.name}: ${payload.body.slice(0, 160)}`,
      link: '/admin/support',
      data: { ticketId: ticket._id },
    });
  }

  return getTicket(ticket._id, user);
};

const updateTicket = async (ticketId, admin, payload) => {
  const ticket = await SupportTicket.findById(ticketId);
  if (!ticket) throw ApiError.notFound('Support ticket not found');

  if (payload.status && !['open', 'in_progress', 'resolved', 'closed'].includes(payload.status)) {
    throw ApiError.badRequest('Invalid ticket status');
  }

  if (payload.status) {
    ticket.status = payload.status;
    if (payload.status === 'resolved') ticket.resolvedAt = new Date();
    if (payload.status === 'closed') {
      ticket.closedAt = new Date();
      ticket.resolvedAt = ticket.resolvedAt || new Date();
    }
    if (['open', 'in_progress'].includes(payload.status)) {
      ticket.resolvedAt = null;
      ticket.closedAt = null;
    }
  }
  if (payload.priority) ticket.priority = payload.priority;
  if (payload.assignedTo !== undefined) ticket.assignedTo = payload.assignedTo || null;
  if (payload.satisfactionRating) ticket.satisfactionRating = payload.satisfactionRating;
  ticket.lastActivityAt = new Date();
  await ticket.save();

  if (payload.status) {
    await notificationService.create({
      userId: ticket.user,
      type: 'support_ticket_update',
      title: `Ticket ${ticket.ticketNumber} is now ${payload.status.replace('_', ' ')}`,
      body: payload.note || `Your support ticket status changed to ${payload.status.replace('_', ' ')}.`,
      link: '/attendee/support',
      createdBy: admin._id,
      data: { ticketId: ticket._id },
    });
  }

  return ticket;
};

const ticketStats = async () => {
  const [byStatus, byPriority, byCategory, avgResolution] = await Promise.all([
    SupportTicket.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    SupportTicket.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }]),
    SupportTicket.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
    SupportTicket.aggregate([
      { $match: { resolvedAt: { $ne: null } } },
      { $project: { hours: { $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 3600000] } } },
      { $group: { _id: null, avgHours: { $avg: '$hours' } } },
    ]),
  ]);
  return {
    byStatus: byStatus.reduce((a, i) => ({ ...a, [i._id]: i.count }), {}),
    byPriority: byPriority.reduce((a, i) => ({ ...a, [i._id]: i.count }), {}),
    byCategory: byCategory.map((c) => ({ category: c._id, count: c.count })),
    averageResolutionHours: Math.round((avgResolution[0]?.avgHours || 0) * 10) / 10,
    total: byStatus.reduce((sum, i) => sum + i.count, 0),
  };
};

module.exports = {
  createFeedback,
  listFeedback,
  respondToFeedback,
  feedbackStats,
  createTicket,
  listTickets,
  getTicket,
  addTicketMessage,
  updateTicket,
  ticketStats,
};

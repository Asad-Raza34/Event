'use strict';

const mongoose = require('mongoose');
const { Conversation, Message, User, ExhibitorProfile, Booth } = require('../models');
const ApiError = require('../utils/ApiError');
const { getPagination, buildMeta, escapeRegex } = require('../utils/pagination');
const { emitToConversation, emitToUser, EVENTS, presence } = require('../sockets/emitter');
const notificationService = require('./notificationService');

const populateConversation = (query) =>
  query
    .populate('participants', 'name avatar role organization lastSeenAt')
    .populate('expo', 'title slug')
    .populate('exhibitor', 'companyName logo slug')
    .populate({ path: 'lastMessage', select: 'body sender createdAt attachments' });

/** Find (or create) the single conversation for a pair of users. */
const getOrCreateConversation = async (user, { participantId, expoId = null, exhibitorId = null, message = null }) => {
  if (!participantId) throw ApiError.badRequest('Choose someone to chat with');
  if (String(participantId) === String(user._id)) throw ApiError.badRequest('You cannot start a conversation with yourself');

  const participant = await User.findById(participantId).select('name role avatar organization');
  if (!participant || !participant.isActive) throw ApiError.notFound('That user is not available');

  const pairKey = Conversation.buildPairKey(user._id, participantId);
  let conversation = await Conversation.findOne({ pairKey });

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [user._id, participantId],
      pairKey,
      expo: expoId,
      exhibitor: exhibitorId,
      unreadCounts: { [String(user._id)]: 0, [String(participantId)]: 0 },
      lastMessagePreview: '',
    });
  } else if (!conversation.expo && expoId) {
    conversation.expo = expoId;
    await conversation.save();
  }

  if (message) await sendMessage({ conversationId: conversation._id, senderId: user._id, body: message });

  const fresh = await populateConversation(Conversation.findById(conversation._id));
  return { conversation: fresh, participant: await decoratePresence(participant) };
};

const decoratePresence = async (userDoc) => {
  const obj = userDoc.toJSON ? userDoc.toJSON() : { ...userDoc };
  obj.isOnline = presence.isOnline(obj._id);
  if (obj.role === 'exhibitor') {
    const profile = await ExhibitorProfile.findOne({ user: obj._id }).select('companyName logo slug');
    obj.exhibitorProfile = profile || null;
  }
  return obj;
};

const listConversations = async (user, query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { participants: user._id };
  if (query.archived !== 'true') filter.archivedBy = { $ne: user._id };

  const [items, total] = await Promise.all([
    populateConversation(Conversation.find(filter).sort({ lastMessageAt: -1 }).skip(skip).limit(limit)),
    Conversation.countDocuments(filter),
  ]);

  const conversations = items.map((conversation) => {
    const json = conversation.toJSON();
    json.otherParticipant = json.participants.find((p) => String(p._id) !== String(user._id)) || null;
    json.unreadCount = conversation.unreadFor(user._id);
    if (json.otherParticipant) json.otherParticipant.isOnline = presence.isOnline(json.otherParticipant._id);
    return json;
  });

  const unreadTotal = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  return { items: conversations, meta: { ...buildMeta(total, page, limit), unreadTotal } };
};

const getConversation = async (conversationId, user, query = {}) => {
  const conversation = await populateConversation(Conversation.findById(conversationId));
  if (!conversation) throw ApiError.notFound('Conversation not found');
  if (!conversation.participants.some((p) => String(p._id) === String(user._id))) {
    throw ApiError.forbidden('You are not part of this conversation');
  }

  const { page, limit, skip } = getPagination({ limit: query.limit || 40, page: query.page || 1 });
  const filter = { conversation: conversation._id, deletedFor: { $ne: user._id } };
  if (query.before) {
    const anchor = await Message.findById(query.before).select('createdAt');
    if (anchor) filter.createdAt = { $lt: anchor.createdAt };
  }

  const messages = await Message.find(filter).populate('sender', 'name avatar role').sort({ createdAt: -1 }).skip(skip).limit(limit);

  const json = conversation.toJSON();
  json.otherParticipant = json.participants.find((p) => String(p._id) !== String(user._id)) || null;
  if (json.otherParticipant) json.otherParticipant.isOnline = presence.isOnline(json.otherParticipant._id);
  json.unreadCount = conversation.unreadFor(user._id);

  return {
    conversation: json,
    messages: messages.reverse(),
    meta: { limit, page, hasMore: messages.length === limit },
  };
};

const assertParticipant = async (conversationId, userId) => {
  const conversation = await Conversation.findById(conversationId);
  if (!conversation) throw ApiError.notFound('Conversation not found');
  if (!conversation.participants.some((id) => String(id) === String(userId))) {
    throw ApiError.forbidden('You are not part of this conversation');
  }
  return conversation;
};

const sendMessage = async ({ conversationId, senderId, body = '', attachments = [] }) => {
  const conversation = await assertParticipant(conversationId, senderId);
  const text = String(body || '').trim();
  if (!text && (!attachments || !attachments.length)) throw ApiError.badRequest('Type a message before sending');

  const message = await Message.create({
    conversation: conversation._id,
    sender: senderId,
    body: text,
    attachments,
    readBy: [senderId],
  });

  const others = conversation.participants.map(String).filter((id) => id !== String(senderId));
  others.forEach((id) => {
    conversation.unreadCounts.set(id, (conversation.unreadCounts.get(id) || 0) + 1);
    conversation.archivedBy = (conversation.archivedBy || []).filter((a) => String(a) !== id);
  });

  conversation.lastMessage = message._id;
  conversation.lastMessageAt = new Date();
  conversation.lastMessagePreview = (text || '📎 Attachment').slice(0, 160);
  conversation.lastSender = senderId;
  await conversation.save();

  const populated = await Message.findById(message._id).populate('sender', 'name avatar role');
  const payload = populated.toJSON();

  emitToConversation(conversation._id, EVENTS.MESSAGE_NEW, { ...payload, conversationId: conversation._id });
  conversation.participants.forEach((id) => {
    emitToUser(id, EVENTS.CONVERSATION_UPDATED, {
      conversationId: conversation._id,
      lastMessagePreview: conversation.lastMessagePreview,
      lastMessageAt: conversation.lastMessageAt,
    });
  });

  const sender = await User.findById(senderId).select('name');
  await Promise.all(
    others.map((id) =>
      notificationService.create({
        userId: id,
        type: 'new_message',
        title: `New message from ${sender?.name || 'a user'}`,
        body: text.slice(0, 140) || 'Sent an attachment',
        link: `/messages?conversation=${conversation._id}`,
        data: { conversationId: conversation._id },
      }).catch(() => null),
    ),
  );

  return payload;
};

const markRead = async ({ conversationId, userId }) => {
  const conversation = await assertParticipant(conversationId, userId);
  await Message.updateMany({ conversation: conversation._id, readBy: { $ne: userId } }, { $addToSet: { readBy: userId } });
  conversation.unreadCounts.set(String(userId), 0);
  await conversation.save();

  const payload = { conversationId: conversation._id, userId, readAt: new Date() };
  emitToConversation(conversation._id, EVENTS.MESSAGE_READ, payload);
  return payload;
};

const deleteMessage = async (messageId, user) => {
  const message = await Message.findById(messageId);
  if (!message) throw ApiError.notFound('Message not found');
  await assertParticipant(message.conversation, user._id);
  if (String(message.sender) === String(user._id)) {
    await message.deleteOne();
    return { message: 'Message deleted for everyone', id: messageId };
  }
  message.deletedFor.addToSet(user._id);
  await message.save();
  return { message: 'Message hidden for you', id: messageId };
};

const archiveConversation = async (conversationId, user, archived = true) => {
  const conversation = await assertParticipant(conversationId, user._id);
  if (archived) conversation.archivedBy.addToSet(user._id);
  else conversation.archivedBy = conversation.archivedBy.filter((id) => String(id) !== String(user._id));
  await conversation.save();
  return { archived };
};

const unreadTotal = async (userId) => {
  const conversations = await Conversation.find({ participants: userId }).select('unreadCounts');
  return conversations.reduce((sum, c) => sum + c.unreadFor(userId), 0);
};

const searchMessages = async (user, q) => {
  if (!q) throw ApiError.badRequest('Enter a search term');
  const conversations = await Conversation.find({ participants: user._id }).select('_id');
  const regex = new RegExp(escapeRegex(q), 'i');
  const messages = await Message.find({ conversation: { $in: conversations.map((c) => c._id) }, body: regex })
    .populate('sender', 'name avatar')
    .populate('conversation', 'participants')
    .sort({ createdAt: -1 })
    .limit(40);
  return messages;
};

/** Attendee/exhibitor directory of people the user can legitimately chat with. */
const contactSuggestions = async (user) => {
  const filter = { isActive: true, _id: { $ne: user._id } };
  if (user.role === 'attendee') filter.role = { $in: ['exhibitor', 'admin'] };
  else if (user.role === 'exhibitor') filter.role = { $in: ['attendee', 'exhibitor', 'admin'] };
  const users = await User.find(filter).select('name role avatar organization').sort({ name: 1 }).limit(50);

  const contacts = await Promise.all(
    users.map(async (candidate) => {
      const obj = candidate.toJSON();
      obj.isOnline = presence.isOnline(obj._id);
      if (obj.role === 'exhibitor') {
        const profile = await ExhibitorProfile.findOne({ user: obj._id }).select('companyName logo slug');
        obj.companyName = profile?.companyName || obj.organization;
        obj.logo = profile?.logo || '';
      }
      return obj;
    }),
  );
  return contacts;
};

const startFromExhibitor = async (user, exhibitorId, message) => {
  const profile = await ExhibitorProfile.findById(exhibitorId).select('user companyName logo');
  if (!profile) throw ApiError.notFound('Exhibitor not found');
  const booth = await Booth.findOne({ exhibitor: profile._id, status: 'occupied' }).populate('expo', 'title slug');
  return getOrCreateConversation(user, {
    participantId: profile.user,
    exhibitorId: profile._id,
    expoId: booth?.expo?._id || null,
    message,
  });
};

module.exports = {
  getOrCreateConversation,
  listConversations,
  getConversation,
  sendMessage,
  markRead,
  deleteMessage,
  archiveConversation,
  unreadTotal,
  searchMessages,
  contactSuggestions,
  startFromExhibitor,
  assertParticipant,
};

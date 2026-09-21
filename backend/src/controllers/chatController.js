'use strict';

const chatService = require('../services/chatService');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess, sendCreated } = require('../utils/apiResponse');
const { presence } = require('../sockets/emitter');

const startConversation = asyncHandler(async (req, res) => {
  const { conversation, participant } = await chatService.getOrCreateConversation(req.user, req.body);
  return sendCreated(res, 'Conversation ready', { conversation, participant });
});

const startWithExhibitor = asyncHandler(async (req, res) => {
  const data = await chatService.startFromExhibitor(req.user, req.params.exhibitorId, req.body.message);
  return sendCreated(res, 'Conversation ready', data);
});

const list = asyncHandler(async (req, res) => {
  const data = await chatService.listConversations(req.user, req.query);
  return sendSuccess(res, { message: 'Conversations loaded', data: data.items, meta: data.meta });
});

const detail = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Conversation loaded', data: await chatService.getConversation(req.params.id, req.user, req.query) }),
);

const send = asyncHandler(async (req, res) =>
  sendCreated(res, 'Message sent', await chatService.sendMessage({
    conversationId: req.params.id,
    senderId: req.user._id,
    body: req.body.body,
    attachments: req.body.attachments,
  })),
);

const markRead = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Marked as read', data: await chatService.markRead({ conversationId: req.params.id, userId: req.user._id }) }),
);

const removeMessage = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Message removed', data: await chatService.deleteMessage(req.params.messageId, req.user) }),
);

const archive = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: req.body.archived ? 'Conversation archived' : 'Conversation restored', data: await chatService.archiveConversation(req.params.id, req.user, req.body.archived !== false) }),
);

const unread = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Unread count', data: { unread: await chatService.unreadTotal(req.user._id), online: presence.onlineIds() } }),
);

const search = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Search results', data: await chatService.searchMessages(req.user, req.query.q) }),
);

const contacts = asyncHandler(async (req, res) =>
  sendSuccess(res, { message: 'Contacts loaded', data: await chatService.contactSuggestions(req.user) }),
);

module.exports = { startConversation, startWithExhibitor, list, detail, send, markRead, removeMessage, archive, unread, search, contacts };

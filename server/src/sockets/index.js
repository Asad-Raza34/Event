'use strict';

const { Server } = require('socket.io');
const config = require('../config');
const logger = require('../utils/logger');
const { verifyAccessToken } = require('../utils/tokens');
const { User, Conversation } = require('../models');
const chatService = require('../services/chatService');
const emitter = require('./emitter');

const { EVENTS, presence } = emitter;

/** Attach Socket.IO to the HTTP server and wire every real-time channel. */
const initSockets = (httpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: config.allowedOrigins, credentials: true },
    maxHttpBufferSize: 1e6,
  });

  emitter.setIO(io);

  // ---- Handshake authentication (JWT in `auth.token`) ---------------------
  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers?.authorization || '').replace(/^Bearer\s+/i, '') ||
        null;
      if (!token) return next(new Error('Authentication required'));
      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.sub).select('name role avatar');
      if (!user || !user.isActive) return next(new Error('Authentication failed'));
      socket.user = { id: String(user._id), name: user.name, role: user.role, avatar: user.avatar };
      return next();
    } catch {
      return next(new Error('Authentication failed'));
    }
  });

  io.on('connection', async (socket) => {
    const { id: userId } = socket.user;
    socket.join(emitter.userRoom(userId));
    presence.add(userId, socket.id);

    logger.socket(`connected ${socket.user.name} (${socket.user.role}) — ${presence.onlineIds().length} online`);

    // Join every conversation room so new messages arrive without a page reload.
    try {
      const conversations = await Conversation.find({ participants: userId }).select('_id expo');
      conversations.forEach((conversation) => socket.join(emitter.conversationRoom(conversation._id)));
      conversations.filter((c) => c.expo).forEach((c) => socket.join(emitter.expoRoom(c.expo)));
    } catch (error) {
      logger.error('socket conversation join failed:', error.message);
    }

    socket.emit(EVENTS.PRESENCE_LIST, { online: presence.onlineIds() });
    socket.broadcast.emit(EVENTS.PRESENCE_UPDATE, { userId, online: true });
    User.findByIdAndUpdate(userId, { lastSeenAt: new Date() }).catch(() => {});

    // ---- Chat -------------------------------------------------------------
    socket.on('conversation:join', (payload = {}) => {
      if (payload.conversationId) socket.join(emitter.conversationRoom(payload.conversationId));
    });

    // chatService persists the message and pushes `message:new` to the room,
    // so the handler only needs to acknowledge the sender.
    socket.on('message:send', async (payload = {}, ack) => {
      try {
        const message = await chatService.sendMessage({
          conversationId: payload.conversationId,
          senderId: userId,
          body: payload.body,
          attachments: payload.attachments,
        });
        if (typeof ack === 'function') ack({ success: true, data: message });
      } catch (error) {
        if (typeof ack === 'function') ack({ success: false, message: error.message });
      }
    });

    socket.on('message:read', async (payload = {}, ack) => {
      try {
        const result = await chatService.markRead({ conversationId: payload.conversationId, userId });
        if (typeof ack === 'function') ack({ success: true, data: result });
      } catch (error) {
        if (typeof ack === 'function') ack({ success: false, message: error.message });
      }
    });

    socket.on('typing:start', (payload = {}) => {
      socket.to(emitter.conversationRoom(payload.conversationId)).emit(EVENTS.TYPING_START, {
        conversationId: payload.conversationId,
        userId,
        name: socket.user.name,
      });
    });

    socket.on('typing:stop', (payload = {}) => {
      socket.to(emitter.conversationRoom(payload.conversationId)).emit(EVENTS.TYPING_STOP, {
        conversationId: payload.conversationId,
        userId,
      });
    });

    // ---- Live update subscriptions ---------------------------------------
    ['expo:subscribe', 'expo:unsubscribe'].forEach((event) => {
      socket.on(event, (payload = {}) => {
        if (!payload.expoId) return;
        const room = emitter.expoRoom(payload.expoId);
        if (event === 'expo:subscribe') socket.join(room);
        else socket.leave(room);
      });
    });

    socket.on('disconnect', async () => {
      const wentOffline = presence.remove(userId, socket.id);
      if (wentOffline) {
        socket.broadcast.emit(EVENTS.PRESENCE_UPDATE, { userId, online: false });
        await User.findByIdAndUpdate(userId, { lastSeenAt: new Date() }).catch(() => {});
      }
      logger.socket(`disconnected ${socket.user.name}`);
    });
  });

  return io;
};

module.exports = { initSockets, ...emitter };

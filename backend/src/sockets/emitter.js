'use strict';

/**
 * Holds the Socket.IO server instance so any service can push real-time
 * events without importing the socket bootstrap (avoids circular imports).
 * Every emitter is a no-op when sockets are not initialised (tests, scripts).
 */

let io = null;
/** userId → Set<socketId> */
const onlineUsers = new Map();

const EVENTS = {
  NOTIFICATION_NEW: 'notification:new',
  NOTIFICATION_READ: 'notification:read',
  MESSAGE_NEW: 'message:new',
  MESSAGE_READ: 'message:read',
  TYPING_START: 'typing:start',
  TYPING_STOP: 'typing:stop',
  PRESENCE_UPDATE: 'presence:update',
  PRESENCE_LIST: 'presence:list',
  CONVERSATION_UPDATED: 'conversation:updated',
  EXPO_UPDATED: 'expo:updated',
  BOOTH_UPDATED: 'booth:updated',
  SCHEDULE_UPDATED: 'schedule:updated',
  ANNOUNCEMENT_NEW: 'announcement:new',
  APPOINTMENT_UPDATED: 'appointment:updated',
  PAYMENT_UPDATED: 'payment:updated',
};

const setIO = (server) => {
  io = server;
  return io;
};

const getIO = () => io;

const userRoom = (userId) => `user:${userId}`;
const expoRoom = (expoId) => `expo:${expoId}`;
const conversationRoom = (conversationId) => `conversation:${conversationId}`;

const emitToUser = (userId, event, payload) => {
  if (!io || !userId) return;
  io.to(userRoom(userId)).emit(event, payload);
};

const emitToUsers = (userIds = [], event, payload) => {
  const unique = [...new Set(userIds.filter(Boolean).map(String))];
  unique.forEach((id) => emitToUser(id, event, payload));
};

const emitToExpo = (expoId, event, payload) => {
  if (!io || !expoId) return;
  io.to(expoRoom(expoId)).emit(event, payload);
};

const emitToConversation = (conversationId, event, payload) => {
  if (!io || !conversationId) return;
  io.to(conversationRoom(conversationId)).emit(event, payload);
};

const emitToAll = (event, payload) => {
  if (!io) return;
  io.emit(event, payload);
};

const presence = {
  add(userId, socketId) {
    const key = String(userId);
    if (!onlineUsers.has(key)) onlineUsers.set(key, new Set());
    onlineUsers.get(key).add(socketId);
  },
  remove(userId, socketId) {
    const key = String(userId);
    const set = onlineUsers.get(key);
    if (!set) return false;
    set.delete(socketId);
    if (set.size === 0) {
      onlineUsers.delete(key);
      return true; // user fully offline
    }
    return false;
  },
  isOnline: (userId) => onlineUsers.has(String(userId)),
  onlineIds: () => [...onlineUsers.keys()],
};

module.exports = {
  EVENTS,
  setIO,
  getIO,
  userRoom,
  expoRoom,
  conversationRoom,
  emitToUser,
  emitToUsers,
  emitToExpo,
  emitToConversation,
  emitToAll,
  presence,
};

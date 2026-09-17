import { io } from 'socket.io-client';
import { getToken } from './api';

let socket = null;

/**
 * One shared Socket.IO connection per browser session. The JWT is sent in the
 * handshake and the server validates it before joining any rooms.
 */
export const connectSocket = () => {
  const token = getToken();
  if (!token) return null;

  if (socket?.connected && socket.auth?.token === token) return socket;

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(import.meta.env.VITE_API_URL || undefined, {
    path: '/socket.io',
    auth: { token },
    transports: ['websocket', 'polling'],
    withCredentials: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 1200,
  });

  return socket;
};

export const getSocket = () => socket;

export const disconnectSocket = () => {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
};

/** Subscribe to an event and get an unsubscribe function back. */
export const onSocketEvent = (event, handler) => {
  const instance = getSocket();
  if (!instance) return () => {};
  instance.on(event, handler);
  return () => instance.off(event, handler);
};

export const SOCKET_EVENTS = {
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

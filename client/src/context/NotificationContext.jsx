import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../lib/api';
import { SOCKET_EVENTS } from '../lib/socket';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { useToast } from './ToastContext';

const NotificationContext = createContext(null);

const CATEGORY_LABELS = {
  new_message: 'Messages',
  session_reminder: 'Reminders',
  appointment_requested: 'Appointments',
  appointment_confirmed: 'Appointments',
  appointment_rejected: 'Appointments',
  appointment_cancelled: 'Appointments',
  announcement: 'Announcements',
};

export const NotificationProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const { subscribe } = useSocket();
  const toast = useToast();
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (params = {}) => {
      if (!isAuthenticated) return [];
      setLoading(true);
      try {
        const response = await api.notifications.list(params);
        setNotifications(response.data || []);
        setUnread(response.meta?.unread ?? 0);
        return response.data || [];
      } catch {
        return [];
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      setUnread(0);
      return;
    }
    load({ limit: 30 });
  }, [isAuthenticated, load]);

  // Realtime pushes: new notification arrives with a toast for high priority.
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    return subscribe(SOCKET_EVENTS.NOTIFICATION_NEW, (notification) => {
      setNotifications((current) => [notification, ...current].slice(0, 50));
      setUnread((current) => current + 1);
      if (notification.priority === 'high') {
        toast.info(notification.title, { title: 'EventSphere' });
      }
    });
  }, [isAuthenticated, subscribe, toast]);

  useEffect(
    () =>
      subscribe(SOCKET_EVENTS.NOTIFICATION_READ, () => {
        load({ limit: 30 });
      }),
    [subscribe, load],
  );

  const bumpUnread = useCallback((delta) => setUnread((current) => Math.max(0, current + delta)), []);

  const markRead = useCallback(
    async (ids) => {
      await api.notifications.markRead(ids);
      setNotifications((current) => current.map((item) => (!ids?.length || ids.includes(item._id) ? { ...item, read: true } : item)));
      const response = await api.notifications.unreadCount();
      setUnread(response.data.unread);
    },
    [],
  );

  const markAllRead = useCallback(async () => {
    await api.notifications.markAllRead();
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    setUnread(0);
  }, []);

  const dismiss = useCallback(
    async (id) => {
      await api.notifications.remove(id);
      setNotifications((current) => current.filter((item) => item._id !== id));
      const response = await api.notifications.unreadCount();
      setUnread(response.data.unread);
    },
    [],
  );

  const clearRead = useCallback(async () => {
    await api.notifications.clearRead();
    setNotifications((current) => current.filter((item) => !item.read));
  }, []);

  const value = useMemo(
    () => ({ notifications, unread, loading, load, markRead, markAllRead, dismiss, clearRead, bumpUnread, categoryLabels: CATEGORY_LABELS }),
    [notifications, unread, loading, load, markRead, markAllRead, dismiss, clearRead, bumpUnread],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used inside <NotificationProvider>');
  return context;
};

export default NotificationContext;

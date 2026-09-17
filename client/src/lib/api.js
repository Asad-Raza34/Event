import axios from 'axios';

const baseURL = `${import.meta.env.VITE_API_URL || ''}/api`;

export const TOKEN_KEY = 'eventsphere-token';

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
};

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable (private mode) — the app still works for the session */
  }
};

const client = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 30000,
});

client.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** A single in-flight refresh shared by every 401 that happens at once. */
let refreshPromise = null;

const refreshSession = async () => {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${baseURL}/auth/refresh`, {}, { withCredentials: true })
      .then((response) => {
        const token = response.data?.data?.accessToken || null;
        setToken(token);
        return token;
      })
      .catch(() => {
        setToken(null);
        return null;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
};

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    const status = response?.status;

    // Expired access token: refresh once and replay the original request.
    if (status === 401 && config && !config.__retried && !String(config.url).includes('/auth/')) {
      config.__retried = true;
      const token = await refreshSession();
      if (token) {
        config.headers = { ...config.headers, Authorization: `Bearer ${token}` };
        return client(config);
      }
      window.dispatchEvent(new CustomEvent('eventsphere:session-expired'));
    }

    const payload = response?.data || {};
    const normalized = {
      status: status || 0,
      message:
        payload.message ||
        (status === 0 ? 'Cannot reach the server. Check your connection and try again.' : 'Something went wrong. Please try again.'),
      errors: payload.errors || null,
      fieldErrors: Array.isArray(payload.errors)
        ? payload.errors.reduce((acc, item) => {
            if (item?.field) acc[item.field] = item.message || 'Invalid value';
            return acc;
          }, {})
        : {},
      isNetworkError: status === 0,
    };

    return Promise.reject(normalized);
  },
);

const get = (url, params) => client.get(url, { params }).then((response) => response.data);
const post = (url, data, config) => client.post(url, data, config).then((response) => response.data);
const patch = (url, data) => client.patch(url, data).then((response) => response.data);
const put = (url, data) => client.put(url, data).then((response) => response.data);
const del = (url) => client.delete(url).then((response) => response.data);

/** Every backend endpoint the client uses, grouped by domain. */
export const api = {
  client,

  auth: {
    register: (payload) => post('/auth/register', payload),
    login: (payload) => post('/auth/login', payload),
    logout: () => post('/auth/logout', {}),
    logoutAll: () => post('/auth/logout-all', {}),
    refresh: () => post('/auth/refresh', {}),
    me: () => get('/auth/me'),
    forgotPassword: (email) => post('/auth/forgot-password', { email }),
    resetPassword: (payload) => post('/auth/reset-password', payload),
    changePassword: (payload) => post('/auth/change-password', payload),
  },

  users: {
    me: () => get('/users/me'),
    updateMe: (payload) => patch('/users/me', payload),
    updatePreferences: (payload) => patch('/users/me/notification-preferences', payload),
    uploadAvatar: (file) => {
      const form = new FormData();
      form.append('avatar', file);
      return post('/users/me/avatar', form);
    },
    list: (params) => get('/users', params),
    stats: () => get('/users/stats'),
    detail: (id) => get(`/users/${id}`),
    update: (id, payload) => patch(`/users/${id}`, payload),
    setActive: (id, isActive) => patch(`/users/${id}/status`, { isActive }),
  },

  expos: {
    list: (params) => get('/expos', params),
    detail: (id) => get(`/expos/${id}`),
    create: (payload) => post('/expos', payload),
    update: (id, payload) => patch(`/expos/${id}`, payload),
    updateStatus: (id, payload) => patch(`/expos/${id}/status`, payload),
    publish: (id) => post(`/expos/${id}/publish`, {}),
    remove: (id) => del(`/expos/${id}`),
    analytics: (id, params) => get(`/expos/${id}/analytics`, params),
    schedule: (id, params) => get(`/expos/${id}/sessions`, params),
    floorPlan: (id) => get(`/expos/${id}/floor-plan`),
    updateFloorPlan: (id, payload) => put(`/expos/${id}/floor-plan`, payload),
    booths: (id, params) => get(`/expos/${id}/booths`, params),
    bulkBooths: (id, payload) => post(`/expos/${id}/booths/bulk`, payload),
    occupancy: (id) => get(`/expos/${id}/occupancy`),
    announcements: (id, params) => get(`/expos/${id}/announcements`, params),
    createAnnouncement: (id, payload) => post(`/expos/${id}/announcements`, payload),
    updateAnnouncement: (announcementId, payload) => patch(`/expos/announcements/${announcementId}`, payload),
    removeAnnouncement: (announcementId) => del(`/expos/announcements/${announcementId}`),
    sessionPopularity: (id) => get(`/expos/${id}/session-popularity`),
    register: (id, payload) => post(`/expos/${id}/register`, payload),
  },

  exhibitors: {
    directory: (params) => get('/exhibitors', params),
    detail: (id, params) => get(`/exhibitors/${id}`, params),
    reviews: (id, params) => get(`/exhibitors/${id}/reviews`, params),
    ratingSummary: (id) => get(`/exhibitors/${id}/rating-summary`),
    availableSlots: (id, params) => get(`/exhibitors/${id}/available-slots`, params),
    workspace: () => get('/exhibitors/me/workspace'),
    updateProfile: (payload) => patch('/exhibitors/me/profile', payload),
    uploadLogo: (file) => {
      const form = new FormData();
      form.append('logo', file);
      return post('/exhibitors/me/logo', form);
    },
    uploadBanner: (file) => {
      const form = new FormData();
      form.append('banner', file);
      return post('/exhibitors/me/banner', form);
    },
    products: (params) => get('/exhibitors/me/products', params),
    createProduct: (payload) => post('/exhibitors/me/products', payload),
    updateProduct: (id, payload) => patch(`/exhibitors/me/products/${id}`, payload),
    removeProduct: (id) => del(`/exhibitors/me/products/${id}`),
    addStaff: (payload) => post('/exhibitors/me/staff', payload),
    updateStaff: (id, payload) => patch(`/exhibitors/me/staff/${id}`, payload),
    removeStaff: (id) => del(`/exhibitors/me/staff/${id}`),
    addDocument: (file, meta = {}) => {
      const form = new FormData();
      form.append('file', file);
      Object.entries(meta).forEach(([key, value]) => form.append(key, value));
      return post('/exhibitors/me/documents', form);
    },
    removeDocument: (id) => del(`/exhibitors/me/documents/${id}`),
    apply: (payload) => post('/exhibitors/me/applications', payload),
    myApplications: (params) => get('/exhibitors/me/applications', params),
    withdraw: (id) => del(`/exhibitors/me/applications/${id}`),
    myExpos: () => get('/exhibitors/me/expos'),
    analytics: (params) => get('/analytics/exhibitor', params),
    applications: (params) => get('/exhibitors/admin/applications', params),
    reviewApplication: (id, payload) => patch(`/exhibitors/admin/applications/${id}`, payload),
    reviewDocument: (id, documentId, payload) => patch(`/exhibitors/admin/${id}/documents/${documentId}`, payload),
    setVerification: (id, payload) => patch(`/exhibitors/admin/${id}/verification`, payload),
  },

  products: {
    list: (params) => get('/exhibitors/products', params),
  },

  booths: {
    list: (params) => get('/booths', params),
    detail: (id) => get(`/booths/${id}`),
    find: (params) => get('/booths/find', params),
    pending: (params) => get('/booths/pending', params),
    create: (payload) => post('/booths', payload),
    update: (id, payload) => patch(`/booths/${id}`, payload),
    updateStatus: (id, payload) => patch(`/booths/${id}/status`, payload),
    remove: (id) => del(`/booths/${id}`),
    request: (id, payload) => post(`/booths/${id}/request`, payload),
    approve: (id, payload) => post(`/booths/${id}/approve`, payload),
    reject: (id, payload) => post(`/booths/${id}/reject`, payload),
    assign: (id, payload) => post(`/booths/${id}/assign`, payload),
    release: (id, payload) => post(`/booths/${id}/release`, payload),
    qr: (id) => get(`/booths/${id}/qr`),
    trackVisit: (id, payload) => post(`/booths/${id}/visit`, payload),
  },

  sessions: {
    list: (params) => get('/sessions', params),
    detail: (id) => get(`/sessions/${id}`),
    create: (payload) => post('/sessions', payload),
    update: (id, payload) => patch(`/sessions/${id}`, payload),
    cancel: (id, payload) => post(`/sessions/${id}/cancel`, payload),
    remove: (id) => del(`/sessions/${id}`),
    register: (id) => post(`/sessions/${id}/register`, {}),
    unregister: (id) => del(`/sessions/${id}/register`),
    bookmark: (id, bookmarked) => post(`/sessions/${id}/bookmark`, { bookmarked }),
    agenda: (params) => get('/sessions/agenda/me', params),
    reviews: (id, params) => get(`/sessions/${id}/reviews`, params),
    qr: (id) => get(`/sessions/${id}/qr`),
  },

  speakers: {
    list: (params) => get('/speakers', params),
    create: (payload) => post('/speakers', payload),
    update: (id, payload) => patch(`/speakers/${id}`, payload),
    remove: (id) => del(`/speakers/${id}`),
    mySessions: () => get('/speakers/me/sessions'),
  },

  registrations: {
    mine: (params) => get('/registrations/me', params),
    activity: () => get('/registrations/me/activity'),
    pass: (id) => get(id ? `/registrations/pass/${id}` : '/registrations/pass'),
    detail: (id) => get(`/registrations/${id}`),
    cancel: (id, payload) => patch(`/registrations/${id}/cancel`, payload),
    list: (params) => get('/registrations', params),
  },

  checkIns: {
    scan: (payload) => post('/check-ins', payload),
    list: (params) => get('/check-ins', params),
    mine: () => get('/check-ins/me'),
  },

  appointments: {
    list: (params) => get('/appointments', params),
    detail: (id) => get(`/appointments/${id}`),
    request: (payload) => post('/appointments', payload),
    respond: (id, payload) => patch(`/appointments/${id}/respond`, payload),
    cancel: (id, payload) => patch(`/appointments/${id}/cancel`, payload),
    complete: (id, payload) => patch(`/appointments/${id}/complete`, payload),
    calendar: (params) => get('/appointments/calendar', params),
    stats: (params) => get('/appointments/stats', params),
    slots: (params) => get('/availability-slots', params),
    createSlots: (payload) => post('/availability-slots', payload),
    updateSlot: (id, payload) => patch(`/availability-slots/${id}`, payload),
    removeSlot: (id) => del(`/availability-slots/${id}`),
  },

  chat: {
    conversations: (params) => get('/conversations', params),
    conversation: (id, params) => get(`/conversations/${id}`, params),
    start: (payload) => post('/conversations', payload),
    startWithExhibitor: (exhibitorId, payload) => post(`/conversations/with-exhibitor/${exhibitorId}`, payload),
    send: (id, payload) => post(`/conversations/${id}/messages`, payload),
    markRead: (id) => patch(`/conversations/${id}/read`, {}),
    archive: (id, archived) => patch(`/conversations/${id}/archive`, { archived }),
    removeMessage: (messageId) => del(`/conversations/messages/${messageId}`),
    unread: () => get('/conversations/unread'),
    search: (q) => get('/conversations/search', { q }),
    contacts: () => get('/conversations/contacts'),
  },

  notifications: {
    list: (params) => get('/notifications', params),
    unreadCount: () => get('/notifications/unread-count'),
    markRead: (ids) => patch('/notifications/read', { ids }),
    markAllRead: () => patch('/notifications/read-all', {}),
    remove: (id) => del(`/notifications/${id}`),
    clearRead: () => del('/notifications/read'),
  },

  payments: {
    mine: (params) => get('/payments/me', params),
    list: (params) => get('/payments', params),
    detail: (id) => get(`/payments/${id}`),
    checkout: (payload) => post('/payments/checkout', payload),
    confirm: (id, payload = {}) => post(`/payments/${id}/confirm`, payload),
    cancel: (id) => post(`/payments/${id}/cancel`, {}),
    refund: (id, payload) => post(`/payments/${id}/refund`, payload),
    fail: (id, payload) => post(`/payments/${id}/fail`, payload),
    stats: () => get('/payments/stats'),
    invoiceUrl: (id) => `${baseURL}/payments/${id}/invoice`,
    invoiceHtml: (id) => client.get(`/payments/${id}/invoice`, { responseType: 'text' }).then((response) => response.data),
  },

  reviews: {
    list: (params) => get('/reviews', params),
    mine: (params) => get('/reviews/me', params),
    create: (payload) => post('/reviews', payload),
    update: (id, payload) => patch(`/reviews/${id}`, payload),
    remove: (id) => del(`/reviews/${id}`),
    reply: (id, body) => post(`/reviews/${id}/replies`, { body }),
    moderate: (id, status) => patch(`/reviews/${id}/moderate`, { status }),
    summary: (targetId, targetType = 'exhibitor') => get(`/reviews/summary/${targetId}`, { targetType }),
  },

  feedback: {
    create: (payload) => post('/feedback', payload),
    list: (params) => get('/feedback', params),
    mine: (params) => get('/feedback/me', params),
    respond: (id, payload) => patch(`/feedback/${id}`, payload),
    stats: (params) => get('/feedback/stats', params),
  },

  tickets: {
    create: (payload) => post('/tickets', payload),
    list: (params) => get('/tickets', params),
    detail: (id) => get(`/tickets/${id}`),
    reply: (id, payload) => post(`/tickets/${id}/messages`, payload),
    update: (id, payload) => patch(`/tickets/${id}`, payload),
    stats: () => get('/tickets/stats'),
  },

  analytics: {
    admin: (params) => get('/analytics/admin', params),
    exhibitor: (params) => get('/analytics/exhibitor', params),
    feedback: (params) => get('/analytics/feedback', params),
    tickets: () => get('/analytics/tickets'),
  },

  assistant: {
    capabilities: () => get('/ai/capabilities'),
    chat: (payload) => post('/ai/chat', payload),
    history: (params) => get('/ai/history', params),
    clear: () => del('/ai/history'),
  },

  search: {
    global: (params) => get('/search', params),
  },

  uploads: {
    image: (file) => {
      const form = new FormData();
      form.append('file', file);
      return post('/uploads/image', form);
    },
    document: (file) => {
      const form = new FormData();
      form.append('file', file);
      return post('/uploads/document', form);
    },
    chat: (files) => {
      const form = new FormData();
      files.forEach((file) => form.append('files', file));
      return post('/uploads/chat', form);
    },
  },

  health: () => get('/health'),
};

export default api;

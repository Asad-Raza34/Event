/** Join class names, ignoring falsy values. */
export const cn = (...values) => values.filter(Boolean).join(' ');

const FALLBACK = '—';

export const formatDate = (value, options = {}) => {
  if (!value) return FALLBACK;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return FALLBACK;
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', ...options });
};

export const formatDateTime = (value) => {
  if (!value) return FALLBACK;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return FALLBACK;
  return `${date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} · ${date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

export const formatTime = (value) => {
  if (!value) return FALLBACK;
  if (typeof value === 'string' && /^\d{1,2}:\d{2}$/.test(value)) {
    const [hours, minutes] = value.split(':').map(Number);
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`;
  }
  return formatDateTime(value);
};

export const formatRange = (start, end) => {
  if (!start) return FALLBACK;
  const from = new Date(start);
  const to = end ? new Date(end) : null;
  if (!to) return formatDate(from);
  const sameMonth = from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear();
  return sameMonth
    ? `${formatDate(from, { year: undefined })} – ${formatDate(to)}`
    : `${formatDate(from)} – ${formatDate(to)}`;
};

export const formatCurrency = (amount, currency = 'USD') => {
  const value = Number(amount);
  if (!Number.isFinite(value)) return FALLBACK;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: value % 1 === 0 ? 0 : 2 }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
};

export const formatNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? new Intl.NumberFormat('en-US').format(numeric) : FALLBACK;
};

export const compactNumber = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return FALLBACK;
  return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(numeric);
};

export const relativeTime = (value) => {
  if (!value) return FALLBACK;
  const date = new Date(value);
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const units = [
    ['year', 1000 * 60 * 60 * 24 * 365],
    ['month', 1000 * 60 * 60 * 24 * 30],
    ['week', 1000 * 60 * 60 * 24 * 7],
    ['day', 1000 * 60 * 60 * 24],
    ['hour', 1000 * 60 * 60],
    ['minute', 1000 * 60],
  ];
  const formatter = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });
  for (const [unit, ms] of units) {
    if (abs >= ms) return formatter.format(Math.round(diff / ms), unit);
  }
  return 'just now';
};

export const initials = (name = '') =>
  String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';

export const mediaUrl = (path) => {
  if (!path) return '';
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  const base = import.meta.env.VITE_API_URL || '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
};

export const titleCase = (value = '') =>
  String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

export const statusTone = (status) => {
  const tones = {
    available: 'success',
    confirmed: 'success',
    approved: 'success',
    published: 'success',
    paid: 'success',
    resolved: 'success',
    occupied: 'brand',
    ongoing: 'brand',
    registered: 'brand',
    in_progress: 'brand',
    processing: 'warning',
    pending: 'warning',
    reserved: 'warning',
    under_review: 'warning',
    waitlisted: 'warning',
    draft: 'neutral',
    upcoming: 'info',
    completed: 'neutral',
    attended: 'success',
    open: 'info',
    scheduled: 'info',
    maintenance: 'danger',
    rejected: 'danger',
    cancelled: 'danger',
    cancelled_expo: 'danger',
    failed: 'danger',
    refunded: 'info',
    closed: 'neutral',
    archived: 'neutral',
    hidden: 'neutral',
    flagged: 'danger',
  };
  return tones[status] || 'neutral';
};

/** Group an array of records by a date field (`YYYY-MM-DD`). */
export const groupByDate = (items = [], field = 'date') =>
  items.reduce((acc, item) => {
    const key = new Date(item[field]).toISOString().slice(0, 10);
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});

export const truncate = (value = '', length = 120) =>
  value.length > length ? `${value.slice(0, length).trimEnd()}…` : value;

export const timeUntil = (value) => {
  if (!value) return '';
  const diff = new Date(value).getTime() - Date.now();
  if (diff <= 0) return 'now';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `in ${days}d ${hours}h`;
  const minutes = Math.floor((diff % 3600000) / 60000);
  return `in ${hours}h ${minutes}m`;
};

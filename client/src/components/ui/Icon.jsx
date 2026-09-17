/** Minimal, dependency-free icon set (stroke based, inherits text colour). */
const ICONS = {
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  chart: 'M3 20h18M7 20v-7M12 20V8M17 20v-4',
  calendar: 'M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  users: 'M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 20c0-3 2.7-5 6-5s6 2 6 5M16 11a3 3 0 1 0 0-6M22 20c0-2.6-2-4.5-5-4.9',
  building: 'M4 21V4a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v17M15 9h4a1 1 0 0 1 1 1v11M8 7h3M8 11h3M8 15h3M18 13h1M18 17h1M3 21h18',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2ZM9 4v14M15 6v14',
  layers: 'M12 3 3 8l9 5 9-5-9-5ZM3 12l9 5 9-5M3 16l9 5 9-5',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  mic: 'M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3ZM5 11a7 7 0 0 0 14 0M12 18v3M8 21h8',
  megaphone: 'M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1ZM15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12',
  handshake: 'M3 12l4 4 5-5 5 5 4-4M8 8l4 4 4-4',
  'credit-card': 'M3 8h18M4 7h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1ZM3 12h18',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2h-2zM14 18h2v2h-2zM18 18h2v2h-2z',
  message: 'M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-5 4V6a1 1 0 0 1 1-1Z',
  chat: 'M21 11.5c0 3.9-4 7-9 7-1.2 0-2.4-.2-3.4-.6L4 20l1.1-3.3A6.6 6.6 0 0 1 3 11.5c0-3.9 4-7 9-7s9 3.1 9 7ZM8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01',
  lifebuoy: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM5.6 5.6l3.2 3.2M15.2 15.2l3.2 3.2M18.4 5.6l-3.2 3.2M8.8 15.2l-3.2 3.2',
  bell: 'M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h11ZM9 17a3 3 0 0 0 6 0',
  'user-cog': 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c0-3.3 3-6 8-6M17 14v1.6M17 20.4V22M14.6 16.2l1.4.8M19.4 19l1.4.8M14.6 19.8l1.4-.8M19.4 17l1.4-.8',
  settings:
    'M12 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM12 3v2.5M12 18.5V21M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M3 12h2.5M18.5 12H21M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8',
  file: 'M14 3v5h5M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8l-4-5Z',
  box: 'M21 8 12 3 3 8l9 5 9-5ZM3 8v8l9 5 9-5V8M12 13v8',
  eye: 'M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Zm10 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  star: 'm12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.7 1-5.9-4.3-4.1 5.9-.8L12 3.5Z',
  bookmark: 'M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z',
  compass: 'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-5.5-3.5-2 5-5 2 2-5 5-2Z',
  search: 'M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0ZM16 16l4 4',
  plus: 'M12 5v14M5 12h14',
  pencil: 'M4 20h4l10-10a2.83 2.83 0 0 0-4-4L4 16v4ZM14 6l4 4',
  trash: 'M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13',
  check: 'm5 13 4 4L19 7',
  x: 'M6 6l12 12M18 6 6 18',
  download: 'M12 3v12m0 0 4-4m-4 4-4-4M4 21h16',
  upload: 'M12 21V9m0 0 4 4m-4-4-4 4M4 3h16',
  refresh: 'M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6',
  filter: 'M3 5h18l-7 8v6l-4-2v-4L3 5Z',
  send: 'M4 12 20 4l-6 8 6 8-16-8Z',
  paperclip: 'M8 12V8a4 4 0 0 1 8 0v8a5 5 0 0 1-10 0V9',
  'chevron-down': 'm6 9 6 6 6-6',
  'chevron-right': 'm9 6 6 6-6 6',
  'chevron-left': 'm15 6-6 6 6 6',
  'chevron-up': 'm6 15 6-6 6 6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  sun: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v2M12 20v2M4.9 4.9 6.3 6.3M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z',
  logout: 'M15 12H3m0 0 4-4m-4 4 4 4M13 4h6a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-6',
  sparkles: 'M11 3l1.5 4.1L16.6 8.6 12.5 10 11 14l-1.5-4L5.4 8.6l4.1-1.5L11 3ZM18 15l.8 2.2L21 18l-2.2.8L18 21l-.8-2.2L15 18l2.2-.8L18 15Z',
  ticket: 'M4 8h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4V8Z',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z',
  mail: 'M3 6h18v12H3zM3 7l9 6 9-6',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM3 12h18M12 3c2.5 2.4 3.8 5.4 3.8 9S14.5 18.6 12 21c-2.5-2.4-3.8-5.4-3.8-9S9.5 5.4 12 3Z',
  location: 'M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11Zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  users2: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2 20c0-3.3 3.1-6 7-6s7 2.7 7 6M17 5.2a3.5 3.5 0 0 1 0 6.6M18 14.5c2.4.7 4 2.6 4 5.5',
  alert: 'M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z',
  info: 'M12 11v5M12 8h.008M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  clipboard: 'M9 5h6a1 1 0 0 1 1 1v1H8V6a1 1 0 0 1 1-1ZM6 7h12v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7ZM9.5 12h5M9.5 16h3',
  spark: 'M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z',
};

const Icon = ({ name, className = 'h-5 w-5', strokeWidth = 1.7, filled = false, ...rest }) => {
  const path = ICONS[name] || ICONS.info;
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={path} />
    </svg>
  );
};

export const ICON_NAMES = Object.keys(ICONS);
export default Icon;

export const ROLES = {
  ADMIN: 'admin',
  EXHIBITOR: 'exhibitor',
  ATTENDEE: 'attendee',
};

export const DEMO_ACCOUNTS = [
  { role: 'Organizer', email: 'admin@eventsphere.io', password: 'Sample@123' },
  { role: 'Exhibitor', email: 'exhibitor@nexarobotics.io', password: 'Sample@123' },
  { role: 'Attendee', email: 'attendee@example.com', password: 'Sample@123' },
];

export const EXPO_STATUSES = ['draft', 'upcoming', 'ongoing', 'completed', 'cancelled'];

export const EXPO_CATEGORIES = [
  'technology',
  'healthcare',
  'education',
  'manufacturing',
  'food-beverage',
  'automotive',
  'finance',
  'energy',
  'design',
  'retail',
  'other',
];

export const COMPANY_CATEGORIES = [
  'technology',
  'electronics',
  'software',
  'manufacturing',
  'healthcare',
  'education',
  'finance',
  'logistics',
  'energy',
  'retail',
  'food-beverage',
  'media',
  'other',
];

export const BOOTH_STATUSES = ['available', 'reserved', 'occupied', 'maintenance'];
export const BOOTH_SIZES = ['small', 'medium', 'large', 'premium', 'custom'];
export const BOOTH_ZONES = ['A', 'B', 'C', 'D', 'E', 'F'];

export const SESSION_TYPES = ['session', 'workshop', 'seminar', 'presentation', 'keynote', 'panel'];
export const SESSION_LEVELS = ['beginner', 'intermediate', 'advanced', 'all'];
export const APPOINTMENT_STATUSES = ['pending', 'confirmed', 'rejected', 'cancelled', 'completed'];
export const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'];
export const TICKET_PRIORITIES = ['low', 'medium', 'high', 'urgent'];

/** Booth colours on the interactive floor plan, keyed by status. */
export const BOOTH_COLORS = {
  available: { bg: 'bg-emerald-500/15', border: 'border-emerald-500/60', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  reserved: { bg: 'bg-amber-500/15', border: 'border-amber-500/60', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
  occupied: { bg: 'bg-brand-500/15', border: 'border-brand-500/60', text: 'text-brand-700 dark:text-brand-300', dot: 'bg-brand-500' },
  maintenance: { bg: 'bg-rose-500/15', border: 'border-rose-500/60', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-500' },
};

export const ROLE_HOME = {
  admin: '/admin',
  exhibitor: '/exhibitor',
  attendee: '/attendee',
};

/** Sidebar navigation per role — every entry maps to a real, working page. */
export const NAVIGATION = {
  admin: [
    { section: 'Overview' },
    { label: 'Dashboard', to: '/admin', icon: 'grid', end: true },
    { label: 'Analytics', to: '/admin/analytics', icon: 'chart' },
    { section: 'Programme' },
    { label: 'Expos', to: '/admin/expos', icon: 'calendar' },
    { label: 'Attendees', to: '/admin/attendees', icon: 'users' },
    { label: 'Exhibitors', to: '/admin/exhibitors', icon: 'building' },
    { label: 'Booths', to: '/admin/booths', icon: 'map' },
    { label: 'Floor plans', to: '/admin/floor-plans', icon: 'layers' },
    { label: 'Schedule', to: '/admin/schedule', icon: 'clock' },
    { label: 'Sessions', to: '/admin/sessions', icon: 'mic' },
    { label: 'Announcements', to: '/admin/announcements', icon: 'megaphone' },
    { section: 'Operations' },
    { label: 'Appointments', to: '/admin/appointments', icon: 'handshake' },
    { label: 'Payments', to: '/admin/payments', icon: 'credit-card' },
    { label: 'Check-in', to: '/admin/check-in', icon: 'qr' },
    { label: 'Feedback', to: '/admin/feedback', icon: 'message' },
    { label: 'Support tickets', to: '/admin/support', icon: 'lifebuoy' },
    { section: 'Account' },
    { label: 'Messages', to: '/admin/messages', icon: 'chat' },
    { label: 'Notifications', to: '/admin/notifications', icon: 'bell' },
    { label: 'Users', to: '/admin/users', icon: 'user-cog' },
    { label: 'Settings', to: '/admin/settings', icon: 'settings' },
  ],
  exhibitor: [
    { section: 'Overview' },
    { label: 'Dashboard', to: '/exhibitor', icon: 'grid', end: true },
    { label: 'Analytics', to: '/exhibitor/analytics', icon: 'chart' },
    { section: 'Presence' },
    { label: 'Applications', to: '/exhibitor/applications', icon: 'file' },
    { label: 'My booth', to: '/exhibitor/booth', icon: 'map' },
    { label: 'Floor plan', to: '/exhibitor/floor-plan', icon: 'layers' },
    { label: 'Company profile', to: '/exhibitor/company', icon: 'building' },
    { label: 'Products', to: '/exhibitor/products', icon: 'box' },
    { label: 'Visitors', to: '/exhibitor/visitors', icon: 'eye' },
    { section: 'Engagement' },
    { label: 'Appointments', to: '/exhibitor/appointments', icon: 'handshake' },
    { label: 'Availability', to: '/exhibitor/availability', icon: 'clock' },
    { label: 'Reviews', to: '/exhibitor/reviews', icon: 'star' },
    { label: 'Payments', to: '/exhibitor/payments', icon: 'credit-card' },
    { section: 'Account' },
    { label: 'Messages', to: '/exhibitor/messages', icon: 'chat' },
    { label: 'Notifications', to: '/exhibitor/notifications', icon: 'bell' },
    { label: 'Settings', to: '/exhibitor/settings', icon: 'settings' },
  ],
  attendee: [
    { section: 'Overview' },
    { label: 'Dashboard', to: '/attendee', icon: 'grid', end: true },
    { section: 'My event' },
    { label: 'My expos', to: '/attendee/expos', icon: 'calendar' },
    { label: 'Event pass', to: '/attendee/pass', icon: 'qr' },
    { label: 'My sessions', to: '/attendee/sessions', icon: 'mic' },
    { label: 'Bookmarks', to: '/attendee/bookmarks', icon: 'bookmark' },
    { label: 'Appointments', to: '/attendee/appointments', icon: 'handshake' },
    { section: 'Discover' },
    { label: 'Browse expos', to: '/expos', icon: 'compass' },
    { label: 'Exhibitors', to: '/exhibitors', icon: 'building' },
    { label: 'Floor plan', to: '/attendee/floor-plan', icon: 'layers' },
    { section: 'Account' },
    { label: 'Messages', to: '/attendee/messages', icon: 'chat' },
    { label: 'Notifications', to: '/attendee/notifications', icon: 'bell' },
    { label: 'Reviews', to: '/attendee/reviews', icon: 'star' },
    { label: 'Payments', to: '/attendee/payments', icon: 'credit-card' },
    { label: 'Feedback', to: '/attendee/feedback', icon: 'message' },
    { label: 'Support', to: '/attendee/support', icon: 'lifebuoy' },
    { label: 'Profile', to: '/attendee/profile', icon: 'user-cog' },
  ],
};

export const ASSISTANT_SUGGESTIONS = [
  'What sessions are available today?',
  'Where is booth B-12?',
  'Which exhibitors sell electronics?',
  'When does the keynote start?',
  'Show me workshops available tomorrow.',
  'What is the location of Nexa Robotics?',
];

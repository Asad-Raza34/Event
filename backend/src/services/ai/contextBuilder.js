'use strict';

const mongoose = require('mongoose');
const {
  Expo,
  Session,
  Speaker,
  Booth,
  ExhibitorProfile,
  Product,
  FloorPlan,
  AvailabilitySlot,
  Payment,
  Registration,
  SessionRegistration,
} = require('../../models');
const config = require('../../config');
const { startOfDay, addDays } = require('../../utils/helpers');
const { escapeRegex } = require('../../utils/pagination');

/**
 * Grounds the assistant in real application data. Each intent pulls only the
 * documents it needs (capped), so answers stay factual and cheap to build.
 */

const expoBrief = (expo) =>
  expo
    ? {
        id: expo._id,
        title: expo.title,
        slug: expo.slug,
        status: expo.status,
        theme: expo.theme,
        category: expo.category,
        startDate: expo.startDate,
        endDate: expo.endDate,
        registrationDeadline: expo.registrationDeadline,
        venue: expo.location?.venue,
        city: expo.location?.city,
        country: expo.location?.country,
        ticketPrice: expo.ticketPrice,
        currency: expo.currency,
        boothPriceFrom: expo.boothPriceFrom,
        registrationOpen: expo.isRegistrationOpen(),
      }
    : null;

const sessionBrief = (session) => ({
  id: session._id,
  title: session.title,
  type: session.type,
  date: session.date,
  startTime: session.startTime,
  endTime: session.endTime,
  room: session.location?.room,
  hall: session.location?.hall,
  capacity: session.capacity,
  registered: session.registeredCount,
  seatsRemaining: Math.max(0, (session.capacity || 0) - (session.registeredCount || 0)),
  speakers: (session.speakers || []).map((s) => ({ name: s.name, title: s.title, organization: s.organization })),
  expoTitle: session.expo?.title,
  expoSlug: session.expo?.slug,
});

const boothBrief = (booth) => ({
  id: booth._id,
  label: `${booth.zone}-${booth.number}`,
  zone: booth.zone,
  number: booth.number,
  status: booth.status,
  size: booth.size,
  price: booth.price,
  currency: booth.currency,
  gridPosition: booth.position,
  exhibitor: booth.exhibitor
    ? {
        id: booth.exhibitor._id,
        companyName: booth.exhibitor.companyName,
        slug: booth.exhibitor.slug,
        categories: booth.exhibitor.categories,
        description: booth.exhibitor.description?.slice(0, 300),
        rating: booth.exhibitor.avgRating,
      }
    : null,
  expoTitle: booth.expo?.title,
  expoSlug: booth.expo?.slug,
});

const activeExpo = async (expoId) => {
  if (expoId && mongoose.isValidObjectId(expoId)) {
    const expo = await Expo.findById(expoId);
    if (expo) return expo;
  }
  return (
    (await Expo.findOne({ status: 'ongoing' }).sort({ startDate: 1 })) ||
    (await Expo.findOne({ status: 'upcoming' }).sort({ startDate: 1 })) ||
    (await Expo.findOne({ status: { $in: ['completed'] } }).sort({ startDate: -1 }))
  );
};

const dayWindow = (timeHint) => {
  const today = startOfDay(new Date());
  if (timeHint === 'tomorrow') return { from: addDays(today, 1), to: addDays(today, 2), label: 'tomorrow' };
  if (timeHint === 'today') return { from: today, to: addDays(today, 1), label: 'today' };
  return { from: addDays(today, -1), to: addDays(today, 60), label: 'upcoming' };
};

const findBooths = async (expo, { boothZone, boothNumber }) => {
  if (!boothNumber) return [];
  const filter = { number: String(boothNumber).padStart(2, '0') };
  if (expo) filter.expo = expo._id;
  if (boothZone) filter.zone = boothZone;

  let booths = await Booth.find(filter).populate('exhibitor', 'companyName slug categories description avgRating').populate('expo', 'title slug');
  if (!booths.length) {
    booths = await Booth.find({ number: String(boothNumber), ...(expo ? { expo: expo._id } : {}) })
      .populate('exhibitor', 'companyName slug categories description avgRating')
      .populate('expo', 'title slug');
  }
  return booths.map(boothBrief);
};

const searchExhibitors = async (keywords, expo) => {
  if (!keywords.length) return [];
  const regex = keywords.map((k) => new RegExp(escapeRegex(k), 'i'));
  const profiles = await ExhibitorProfile.find({
    $or: [
      ...regex.map((r) => ({ companyName: r })),
      ...regex.map((r) => ({ categories: r })),
      ...regex.map((r) => ({ description: r })),
    ],
  })
    .limit(8)
    .select('companyName slug categories description avgRating reviewCount logo contact');

  const results = [];
  for (const profile of profiles) {
    // eslint-disable-next-line no-await-in-loop
    const booths = await Booth.find({ exhibitor: profile._id, ...(expo ? { expo: expo._id } : {}) })
      .select('number zone status expo')
      .limit(3);
    results.push({
      id: profile._id,
      companyName: profile.companyName,
      slug: profile.slug,
      categories: profile.categories,
      description: profile.description?.slice(0, 300),
      rating: profile.avgRating,
      reviews: profile.reviewCount,
      contact: profile.contact,
      booths: booths.map((b) => ({ label: `${b.zone}-${b.number}`, status: b.status, boothId: b._id })),
    });
  }
  return results;
};

const searchProducts = async (keywords) => {
  if (!keywords.length) return [];
  const regex = keywords.map((k) => new RegExp(escapeRegex(k), 'i'));
  const products = await Product.find({
    isActive: true,
    $or: [...regex.map((r) => ({ name: r })), ...regex.map((r) => ({ category: r })), ...regex.map((r) => ({ tags: r })), ...regex.map((r) => ({ description: r }))],
  })
    .limit(10)
    .populate('exhibitor', 'companyName slug');

  const results = [];
  for (const product of products) {
    // eslint-disable-next-line no-await-in-loop
    const booth = await Booth.findOne({ exhibitor: product.exhibitor?._id }).select('number zone expo');
    results.push({
      id: product._id,
      name: product.name,
      category: product.category,
      kind: product.kind,
      price: product.price,
      currency: product.currency,
      company: product.exhibitor?.companyName,
      exhibitorId: product.exhibitor?._id,
      booth: booth ? `${booth.zone}-${booth.number}` : null,
    });
  }
  return results;
};

const findSessions = async (expo, entities, limit = 12) => {
  const window = dayWindow(entities.timeHint);
  const filter = { status: { $ne: 'cancelled' }, date: { $gte: window.from, $lt: window.to } };
  if (expo) filter.expo = expo._id;
  if (entities.sessionType) filter.type = entities.sessionType;
  if (entities.keywords.length) {
    const regex = entities.keywords.map((k) => new RegExp(escapeRegex(k), 'i'));
    filter.$or = [...regex.map((r) => ({ title: r })), ...regex.map((r) => ({ description: r })), ...regex.map((r) => ({ tags: r })), ...regex.map((r) => ({ category: r }))];
  }

  let sessions = await Session.find(filter)
    .populate('speakers', 'name title organization')
    .populate('expo', 'title slug')
    .sort({ date: 1, startTime: 1 })
    .limit(limit);

  // Widen the search rather than answering with nothing.
  if (!sessions.length && (entities.keywords.length || entities.sessionType)) {
    const fallbackFilter = { status: { $ne: 'cancelled' }, ...(expo ? { expo: expo._id } : {}), date: { $gte: window.from, $lt: window.to } };
    sessions = await Session.find(fallbackFilter)
      .populate('speakers', 'name title organization')
      .populate('expo', 'title slug')
      .sort({ date: 1, startTime: 1 })
      .limit(limit);
  }

  return { sessions: sessions.map(sessionBrief), window };
};

const searchSpeakers = async (keywords) => {
  const filter = keywords.length
    ? {
        $or: [
          ...keywords.map((k) => ({ name: new RegExp(escapeRegex(k), 'i') })),
          ...keywords.map((k) => ({ organization: new RegExp(escapeRegex(k), 'i') })),
          ...keywords.map((k) => ({ expertise: new RegExp(escapeRegex(k), 'i') })),
        ],
      }
    : {};
  const speakers = await Speaker.find(filter).limit(8);
  const results = [];
  for (const speaker of speakers) {
    // eslint-disable-next-line no-await-in-loop
    const sessions = await Session.find({ speakers: speaker._id, status: { $ne: 'cancelled' } })
      .populate('expo', 'title slug')
      .sort({ date: 1 })
      .limit(4)
      .select('title date startTime endTime expo location');
    results.push({
      id: speaker._id,
      name: speaker.name,
      title: speaker.title,
      organization: speaker.organization,
      expertise: speaker.expertise,
      bio: speaker.bio?.slice(0, 400),
      sessions: sessions.map((s) => ({
        title: s.title,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        room: s.location?.room,
        expoTitle: s.expo?.title,
      })),
    });
  }
  return results;
};

const venueInfo = async (expo, keywords) => {
  if (!expo) return null;
  const plan = await FloorPlan.findOne({ expo: expo._id });
  const amenities = (plan?.amenities || []).filter((amenity) => {
    if (!keywords.length) return true;
    return keywords.some((k) => amenity.name.toLowerCase().includes(k) || String(amenity.type).toLowerCase().includes(k));
  });
  const zones = (plan?.zones || []).map((zone) => ({ name: zone.name, description: zone.description }));

  return {
    venue: expo.location?.venue,
    address: [expo.location?.address, expo.location?.city, expo.location?.country].filter(Boolean).join(', '),
    hall: expo.location?.hall,
    amenities: (amenities.length ? amenities : plan?.amenities || []).map((a) => ({ name: a.name, type: a.type })),
    zones,
    grid: plan ? { cols: plan.gridCols, rows: plan.gridRows } : null,
  };
};

const expoOverview = async (expo) => {
  if (!expo) return null;
  const [sessions, boothStats, exhibitors] = await Promise.all([
    Session.countDocuments({ expo: expo._id, status: { $ne: 'cancelled' } }),
    Booth.aggregate([{ $match: { expo: expo._id } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    ExhibitorProfile.find({}, 'companyName slug categories avgRating')
      .sort({ avgRating: -1 })
      .limit(8),
  ]);
  return {
    expo: expoBrief(expo),
    sessionCount: sessions,
    boothsByStatus: boothStats.reduce((a, i) => ({ ...a, [i._id]: i.count }), {}),
    featuredExhibitors: exhibitors.map((e) => ({ companyName: e.companyName, slug: e.slug, categories: e.categories, rating: e.avgRating })),
  };
};

const appointmentHelp = async (expo) => {
  const slots = await AvailabilitySlot.find({ ...(expo ? { expo: expo._id } : {}), status: 'open', date: { $gte: startOfDay(new Date()) } })
    .populate('exhibitor', 'companyName slug')
    .sort({ date: 1, startTime: 1 })
    .limit(10);
  return slots.map((slot) => ({
    exhibitor: slot.exhibitor?.companyName,
    exhibitorId: slot.exhibitor?._id,
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    durationMinutes: slot.durationMinutes,
    slotId: slot._id,
  }));
};

const registrationHelp = async (user, expo) => {
  if (!expo) return null;
  const existing = user ? await Registration.findOne({ user: user._id, expo: expo._id }) : null;
  const sessions = user
    ? await SessionRegistration.countDocuments({ user: user._id, registered: true })
    : 0;
  return {
    expo: expoBrief(expo),
    alreadyRegistered: Boolean(existing && existing.status !== 'cancelled'),
    myPassCode: existing?.passCode || null,
    myStatus: existing?.status || null,
    mySessionRegistrations: sessions,
    registrationUrl: `/expos/${expo.slug}`,
  };
};

const paymentHelp = async (user) => {
  if (!user) return null;
  const payments = await Payment.find({ user: user._id }).sort({ createdAt: -1 }).limit(5).select('purpose description total currency status transactionId invoice.number createdAt');
  return payments.map((p) => ({
    purpose: p.purpose,
    description: p.description,
    amount: p.total,
    currency: p.currency,
    status: p.status,
    transactionId: p.transactionId,
    invoiceNumber: p.invoice?.number,
    date: p.createdAt,
  }));
};

/** Build the grounding context for a detected intent. */
const build = async ({ intent, entities, user, expoId }) => {
  const expo = await activeExpo(expoId);
  const sources = [];
  const context = {};

  switch (intent) {
    case 'booth_location': {
      context.booths = await findBooths(expo, entities);
      if (expo) context.floorPlan = await venueInfo(expo, []);
      sources.push({ label: expo ? `Floor plan — ${expo.title}` : 'Floor plan', link: expo ? `/expos/${expo.slug}/floor-plan` : '/expos' });
      break;
    }
    case 'exhibitor_location': {
      context.exhibitors = await searchExhibitors(entities.keywords, expo);
      sources.push({ label: 'Exhibitor directory', link: '/exhibitors' });
      break;
    }
    case 'product_search': {
      context.products = await searchProducts(entities.keywords);
      context.relatedExhibitors = await searchExhibitors(entities.keywords, expo);
      sources.push({ label: 'Products & services', link: '/exhibitors' });
      break;
    }
    case 'session_search': {
      const result = await findSessions(expo, entities);
      context.sessions = result.sessions;
      context.window = result.window.label;
      sources.push({ label: expo ? `Schedule — ${expo.title}` : 'Schedule', link: expo ? `/expos/${expo.slug}/schedule` : '/sessions' });
      break;
    }
    case 'speaker_search': {
      context.speakers = await searchSpeakers(entities.keywords);
      sources.push({ label: 'Speakers', link: '/speakers' });
      break;
    }
    case 'venue_info': {
      context.venue = await venueInfo(expo, entities.keywords);
      if (context.venue && expo) sources.push({ label: `Venue — ${expo.title}`, link: `/expos/${expo.slug}/floor-plan` });
      break;
    }
    case 'expo_info':
    case 'expo_overview': {
      context.expo = await expoOverview(expo);
      if (expo) sources.push({ label: expo.title, link: `/expos/${expo.slug}` });
      break;
    }
    case 'appointment_help': {
      context.openSlots = await appointmentHelp(expo);
      sources.push({ label: 'Appointments', link: user?.role === 'exhibitor' ? '/exhibitor/appointments' : '/attendee/appointments' });
      break;
    }
    case 'registration_help': {
      context.registration = await registrationHelp(user, expo);
      sources.push({ label: 'Registration', link: user ? '/attendee/expos' : '/register' });
      break;
    }
    case 'payment_help': {
      context.payments = await paymentHelp(user);
      sources.push({ label: 'Payments', link: '/attendee/payments' });
      break;
    }
    default: {
      context.expo = await expoOverview(expo);
      context.sessions = (await findSessions(expo, { ...entities, timeHint: 'today' }, 5)).sessions;
      if (expo) sources.push({ label: expo.title, link: `/expos/${expo.slug}` });
    }
  }

  context.currentExpo = expoBrief(expo);
  context.user = user ? { name: user.name, role: user.role } : null;

  return {
    context,
    sources: sources.slice(0, 4),
    expo,
    meta: { intent, entities, contextItems: JSON.stringify(context).length, truncated: JSON.stringify(context).length > 16000 },
  };
};

const suggestionsFor = (intent) => {
  const base = [
    'What sessions are available today?',
    'Where is booth B-12?',
    'Which exhibitors sell electronics?',
  ];
  const byIntent = {
    session_search: ['Show me workshops available tomorrow', 'Which sessions still have seats?', 'When does the keynote start?'],
    booth_location: ['Which booths are still available?', 'Show me the floor plan', 'Who is at booth A-01?'],
    product_search: ['Which exhibitors sell software?', 'Show me healthcare exhibitors', 'What is the location of ABC Technologies?'],
    expo_info: ['What is the schedule for tomorrow?', 'How much is a ticket?', 'Where is the venue?'],
    registration_help: ['What does my event pass include?', 'How do I register for a session?', 'Where do I find my QR code?'],
    appointment_help: ['Which exhibitors have open slots?', 'How do I book a meeting?', 'Show my upcoming appointments'],
  };
  return (byIntent[intent] || base).slice(0, 3);
};

module.exports = { build, suggestionsFor, activeExpo, expoBrief, sessionBrief, boothBrief };

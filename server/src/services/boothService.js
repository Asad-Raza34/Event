'use strict';

const mongoose = require('mongoose');
const { Booth, Expo, ExhibitorProfile, ExpoApplication, User, Payment } = require('../models');
const ApiError = require('../utils/ApiError');
const { getPagination, buildMeta, escapeRegex } = require('../utils/pagination');
const { pick } = require('../utils/helpers');
const { emitToExpo, EVENTS } = require('../sockets/emitter');
const notificationService = require('./notificationService');
const expoService = require('./expoService');

const SIZE_DIMENSIONS = {
  small: { width: 2, depth: 2, w: 1, h: 1, multiplier: 1 },
  medium: { width: 3, depth: 3, w: 1, h: 1, multiplier: 1.6 },
  large: { width: 6, depth: 4, w: 2, h: 1, multiplier: 2.6 },
  premium: { width: 8, depth: 6, w: 2, h: 2, multiplier: 4 },
  custom: { width: 3, depth: 3, w: 1, h: 1, multiplier: 1 },
};

const SORTABLE = ['createdAt', 'number', 'price', 'zone', 'status'];

const requireExpo = async (expoId) => {
  const expo = await Expo.findById(expoId);
  if (!expo) throw ApiError.notFound('Expo not found');
  return expo;
};

const assertOrganizer = (expo, user) => {
  if (!user || user.role !== 'admin') throw ApiError.forbidden('Only organizers can manage booths');
  if (!expo.isOwner(user)) throw ApiError.forbidden('You can only manage booths for expos you organize');
};

const touchExpo = async (expoId) => {
  await expoService.refreshStats(expoId);
  emitToExpo(expoId, EVENTS.BOOTH_UPDATED, { expoId, at: new Date() });
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const listBooths = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.expo) filter.expo = query.expo;
  if (query.status) filter.status = { $in: String(query.status).split(',') };
  if (query.zone) filter.zone = query.zone.toUpperCase();
  if (query.size) filter.size = query.size;
  if (query.exhibitor) filter.exhibitor = query.exhibitor;
  if (query.minPrice || query.maxPrice) {
    filter.price = {};
    if (query.minPrice) filter.price.$gte = Number(query.minPrice);
    if (query.maxPrice) filter.price.$lte = Number(query.maxPrice);
  }
  if (query.q) {
    const regex = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ number: regex }, { name: regex }, { zone: regex }];
  }

  const sort = query.sort && SORTABLE.includes(String(query.sort).replace('-', '')) ? query.sort : 'number';

  const [items, total] = await Promise.all([
    Booth.find(filter)
      .populate('exhibitor', 'companyName logo slug categories avgRating contact')
      .populate('featuredProducts', 'name image category price currency')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Booth.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(total, page, limit) };
};

const getBooth = async (id) => {
  const booth = await Booth.findById(id)
    .populate('expo', 'title slug startDate endDate status currency')
    .populate('exhibitor', 'companyName logo slug description contact categories avgRating reviewCount website socials')
    .populate('featuredProducts', 'name description image category price currency kind');
  if (!booth) throw ApiError.notFound('Booth not found');
  return booth;
};

/**
 * Public lookup: "where is booth B-12?". Accepts `B-12`, `B12`, `b 12` or a
 * bare number, in which case the first matching zone is returned.
 */
const findByNumber = async (expoId, rawLabel) => {
  const label = String(rawLabel || '').trim().toUpperCase();
  const parsed = label.match(/^([A-F])?\s*-?\s*(\d{1,3})$/);
  if (!parsed) throw ApiError.badRequest('Booth labels look like "B-12" or "12"');

  const [, zone, digits] = parsed;
  const number = digits.padStart(2, '0');
  const filter = { expo: expoId, number, ...(zone ? { zone } : {}) };

  const booths = await Booth.find(filter)
    .populate('exhibitor', 'companyName logo slug description categories avgRating')
    .populate('expo', 'title slug')
    .sort({ zone: 1 });

  if (!booths.length) throw ApiError.notFound(`Booth ${label} was not found for this expo`);
  return { booth: booths[0], matches: booths.length, label: `${booths[0].zone}-${booths[0].number}` };
};

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

const createBooth = async (payload, user) => {
  const expo = await requireExpo(payload.expo);
  assertOrganizer(expo, user);

  const dimensions = SIZE_DIMENSIONS[payload.size || 'medium'];
  const booth = await Booth.create({
    ...pick(payload, ['number', 'name', 'zone', 'size', 'price', 'currency', 'position', 'amenities', 'description', 'status', 'floorPlan', 'featuredProducts']),
    expo: expo._id,
    floorPlan: payload.floorPlan || expo.floorPlan,
    number: String(payload.number).toUpperCase(),
    dimensions: pick(payload.dimensions || {}, ['width', 'depth', 'unit']) ,
    price: payload.price ?? 0,
    position: payload.position || { x: 0, y: 0, w: dimensions.w, h: dimensions.h },
  });

  await touchExpo(expo._id);
  return booth;
};

/**
 * Generate a rectangular grid of booths for an expo (the fastest way to build
 * a floor plan). Skips numbers that already exist.
 */
const bulkCreateBooths = async (expoId, options, user) => {
  const expo = await requireExpo(expoId);
  assertOrganizer(expo, user);

  const {
    zone = 'A',
    startNumber = 1,
    rows = 3,
    cols = 4,
    size = 'medium',
    price = 0,
    currency = expo.currency || 'USD',
    startX = 1,
    startY = 1,
    namePrefix = '',
    amenities = ['Power', 'Wi-Fi'],
  } = options;

  const dimensions = SIZE_DIMENSIONS[size] || SIZE_DIMENSIONS.medium;
  const existing = await Booth.find({ expo: expo._id, zone: String(zone).toUpperCase() }).select('number position');
  const existingNumbers = new Set(existing.map((b) => b.number));
  const occupiedCells = new Set(existing.map((b) => `${b.position?.x}:${b.position?.y}`));

  const docs = [];
  let counter = Number(startNumber);
  let maxX = startX;

  for (let row = 0; row < Number(rows); row += 1) {
    for (let col = 0; col < Number(cols); col += 1) {
      const number = String(counter).padStart(2, '0');
      const x = Number(startX) + col * dimensions.w;
      const y = Number(startY) + row * dimensions.h;
      counter += 1;

      if (existingNumbers.has(`${String(zone).toUpperCase()}-${number}`) || existingNumbers.has(number)) continue;
      if (occupiedCells.has(`${x}:${y}`)) continue;

      docs.push({
        expo: expo._id,
        floorPlan: expo.floorPlan,
        number,
        name: namePrefix ? `${namePrefix} ${number}` : '',
        zone: String(zone).toUpperCase(),
        size,
        dimensions: { width: dimensions.width, depth: dimensions.depth, unit: 'm' },
        position: { x, y, w: dimensions.w, h: dimensions.h },
        price: Number(price) || 0,
        basePrice: Number(price) || 0,
        currency,
        amenities: [...amenities],
        status: 'available',
      });
      maxX = Math.max(maxX, x + dimensions.w);
    }
  }

  if (!docs.length) throw ApiError.conflict('No booths were created — the selected grid cells are already taken');

  const created = await Booth.insertMany(docs, { ordered: false });

  // Keep the floor-plan grid large enough to hold the new booths.
  if (expo.floorPlan) {
    // eslint-disable-next-line global-require
    await require('./floorPlanService').expandGrid(expo.floorPlan, { cols: maxX + 2, rows: Number(startY) + Number(rows) * dimensions.h + 2 });
  }

  await touchExpo(expo._id);
  return { created: created.length, booths: created };
};

const updateBooth = async (id, payload, user) => {
  const booth = await Booth.findById(id).populate('expo');
  if (!booth) throw ApiError.notFound('Booth not found');

  const isOrganizer = user.role === 'admin' && booth.expo.isOwner(user);
  const isAssignedExhibitor =
    user.role === 'exhibitor' && booth.exhibitor && (await ExhibitorProfile.exists({ _id: booth.exhibitor, user: user._id }));

  if (!isOrganizer && !isAssignedExhibitor) throw ApiError.forbidden('You cannot edit this booth');

  // Exhibitors may only curate booth content, never pricing or occupancy.
  const exhibitorFields = ['name', 'description', 'featuredProducts', 'staff', 'amenities'];
  const organizerFields = [
    ...exhibitorFields,
    'number',
    'zone',
    'size',
    'price',
    'basePrice',
    'currency',
    'position',
    'dimensions',
    'status',
    'maintenanceNote',
  ];

  Object.assign(booth, pick(payload, isOrganizer ? organizerFields : exhibitorFields));
  await booth.save();
  await touchExpo(booth.expo._id);
  return booth;
};

const deleteBooth = async (id, user) => {
  const booth = await Booth.findById(id).populate('expo');
  if (!booth) throw ApiError.notFound('Booth not found');
  assertOrganizer(booth.expo, user);
  if (booth.status === 'occupied') throw ApiError.badRequest('Release the booth before deleting it');
  const expoId = booth.expo._id;
  await booth.deleteOne();
  await touchExpo(expoId);
  return { message: 'Booth deleted', id };
};

const updateStatus = async (id, status, user, note = '') => {
  const booth = await Booth.findById(id).populate('expo');
  if (!booth) throw ApiError.notFound('Booth not found');
  assertOrganizer(booth.expo, user);

  if (!booth.canTransitionTo(status)) {
    throw ApiError.badRequest(`A ${booth.status} booth cannot be moved to ${status}`);
  }
  booth.status = status;
  if (status === 'maintenance') booth.maintenanceNote = note;
  await booth.save();
  await touchExpo(booth.expo._id);
  return booth;
};

/** Exhibitor asks for a booth: requires an approved application for that expo. */
const requestReservation = async (boothId, user, note = '') => {
  const booth = await Booth.findById(boothId).populate('expo', 'title slug currency');
  if (!booth) throw ApiError.notFound('Booth not found');
  if (booth.status !== 'available') throw ApiError.conflict('This booth is no longer available');

  const profile = await ExhibitorProfile.findOne({ user: user._id });
  if (!profile) throw ApiError.forbidden('Create your company profile before reserving a booth');

  const application = await ExpoApplication.findOne({ expo: booth.expo._id, exhibitor: profile._id, status: 'approved' });
  if (!application) throw ApiError.forbidden('Your application for this expo must be approved before reserving a booth');

  const alreadyRequested = await Booth.findOne({ expo: booth.expo._id, 'reservation.exhibitor': profile._id });
  if (alreadyRequested) throw ApiError.conflict(`You already requested booth ${alreadyRequested.number} for this expo`);

  booth.status = 'reserved';
  booth.reservation = {
    requestedBy: user._id,
    exhibitor: profile._id,
    requestedAt: new Date(),
    note,
  };
  await booth.save();

  const organizers = await User.find({ role: 'admin' }).select('_id');
  await notificationService.createMany(organizers.map((o) => o._id), {
    type: 'booth_reserved',
    title: `Booth request ${booth.zone}-${booth.number}`,
    body: `${profile.companyName} requested booth ${booth.zone}-${booth.number} for "${booth.expo.title}".`,
    link: '/admin/booths',
    data: { boothId: booth._id, expoId: booth.expo._id },
  });

  await notificationService.create({
    userId: user._id,
    type: 'booth_reserved',
    title: 'Booth request submitted',
    body: `We sent your request for booth ${booth.zone}-${booth.number} to the organizers.`,
    link: '/exhibitor/booth',
  });

  await touchExpo(booth.expo._id);
  return booth;
};

/** Organizer approves the reservation. A pending payment is created when the booth costs money. */
const approveReservation = async (boothId, user, { note = '', skipPayment = false } = {}) => {
  const booth = await Booth.findById(boothId).populate('expo');
  if (!booth) throw ApiError.notFound('Booth not found');
  assertOrganizer(booth.expo, user);
  if (!booth.reservation?.exhibitor) throw ApiError.badRequest('This booth has no pending reservation request');

  const profile = await ExhibitorProfile.findById(booth.reservation.exhibitor);
  const application = await ExpoApplication.findOne({ expo: booth.expo._id, exhibitor: booth.reservation.exhibitor });

  const price = Number(booth.price || 0);
  const requiresPayment = !skipPayment && price > 0;

  booth.exhibitor = booth.reservation.exhibitor;
  booth.application = application?._id || null;
  booth.assignedAt = new Date();
  booth.status = requiresPayment ? 'reserved' : 'occupied';
  if (application) {
    application.assignedBooth = booth._id;
    application.timeline.push({ status: 'booth_assigned', note: `Booth ${booth.zone}-${booth.number} assigned` });
    await application.save();
  }

  let payment = null;
  if (requiresPayment) {
    // eslint-disable-next-line global-require
    payment = await require('./paymentService').createBoothCharge(booth, profile.user, { note });
    booth.reservation.payment = payment._id;
  }

  await booth.save();

  await notificationService.create({
    userId: profile.user,
    type: 'booth_assigned',
    title: `Booth ${booth.zone}-${booth.number} is yours`,
    body: requiresPayment
      ? `The organizer assigned booth ${booth.zone}-${booth.number}. Complete the payment to confirm your space.`
      : `The organizer assigned booth ${booth.zone}-${booth.number}. Add your products and staff when ready.`,
    priority: 'high',
    link: '/exhibitor/booth',
    data: { boothId: booth._id, expoId: booth.expo._id, paymentId: payment?._id || null },
  });

  await touchExpo(booth.expo._id);
  return { booth, payment };
};

const rejectReservation = async (boothId, user, reason = '') => {
  const booth = await Booth.findById(boothId).populate('expo');
  if (!booth) throw ApiError.notFound('Booth not found');
  assertOrganizer(booth.expo, user);
  if (!booth.reservation?.exhibitor) throw ApiError.badRequest('This booth has no pending reservation request');

  const profile = await ExhibitorProfile.findById(booth.reservation.exhibitor);
  booth.status = 'available';
  booth.reservation = { requestedBy: null, exhibitor: null, requestedAt: null, note: '', payment: null };
  await booth.save();

  if (profile) {
    await notificationService.create({
      userId: profile.user,
      type: 'booth_released',
      title: 'Booth request declined',
      body: reason || `The organizer declined your request for booth ${booth.zone}-${booth.number}. Please choose another booth.`,
      link: '/exhibitor/floor-plan',
    });
  }

  await touchExpo(booth.expo._id);
  return booth;
};

/** Direct assignment by an organizer (bypasses the request flow). */
const assignBooth = async (boothId, exhibitorId, user, { applicationId = null } = {}) => {
  const booth = await Booth.findById(boothId).populate('expo');
  if (!booth) throw ApiError.notFound('Booth not found');
  assertOrganizer(booth.expo, user);
  if (booth.status === 'occupied' && String(booth.exhibitor) !== String(exhibitorId)) {
    throw ApiError.conflict('That booth is already occupied');
  }

  const profile = await ExhibitorProfile.findById(exhibitorId);
  if (!profile) throw ApiError.notFound('Exhibitor not found');

  booth.exhibitor = profile._id;
  booth.status = 'occupied';
  booth.assignedAt = new Date();
  booth.reservation = { requestedBy: null, exhibitor: null, requestedAt: null, note: '', payment: null };
  if (applicationId) booth.application = applicationId;
  await booth.save();

  await ExpoApplication.findOneAndUpdate(
    { expo: booth.expo._id, exhibitor: profile._id },
    { assignedBooth: booth._id, $push: { timeline: { status: 'booth_assigned', note: `Booth ${booth.zone}-${booth.number} assigned by organizer` } } },
  );

  await notificationService.create({
    userId: profile.user,
    type: 'booth_assigned',
    title: `Booth ${booth.zone}-${booth.number} assigned`,
    body: `You have been assigned booth ${booth.zone}-${booth.number} for "${booth.expo.title}".`,
    priority: 'high',
    link: '/exhibitor/booth',
    data: { boothId: booth._id, expoId: booth.expo._id },
  });

  await touchExpo(booth.expo._id);
  return booth;
};

const releaseBooth = async (boothId, user, reason = '') => {
  const booth = await Booth.findById(boothId).populate('expo');
  if (!booth) throw ApiError.notFound('Booth not found');

  const ownsBooth =
    user.role === 'exhibitor' && booth.exhibitor && (await ExhibitorProfile.exists({ _id: booth.exhibitor, user: user._id }));
  if (!(user.role === 'admin' && booth.expo.isOwner(user)) && !ownsBooth) {
    throw ApiError.forbidden('You cannot release this booth');
  }

  const previousExhibitor = booth.exhibitor;
  const profile = previousExhibitor ? await ExhibitorProfile.findById(previousExhibitor) : null;

  booth.exhibitor = null;
  booth.application = null;
  booth.status = 'available';
  booth.assignedAt = null;
  booth.releasedAt = new Date();
  booth.reservation = { requestedBy: null, exhibitor: null, requestedAt: null, note: reason, payment: null };
  await booth.save();

  await ExpoApplication.updateOne({ expo: booth.expo._id, exhibitor: previousExhibitor }, { $set: { assignedBooth: null } });

  if (profile && user.role === 'admin') {
    await notificationService.create({
      userId: profile.user,
      type: 'booth_released',
      title: `Booth ${booth.zone}-${booth.number} released`,
      body: reason || 'The organizer released your booth assignment.',
      priority: 'high',
      link: '/exhibitor/booths',
    });
  }

  await touchExpo(booth.expo._id);
  return booth;
};

// ---------------------------------------------------------------------------
// Analytics helpers
// ---------------------------------------------------------------------------

const occupancyByZone = async (expoId) => {
  const rows = await Booth.aggregate([
    { $match: { expo: new mongoose.Types.ObjectId(String(expoId)) } },
    {
      $group: {
        _id: '$zone',
        total: { $sum: 1 },
        occupied: { $sum: { $cond: [{ $in: ['$status', ['occupied', 'reserved']] }, 1, 0] } },
        available: { $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] } },
        maintenance: { $sum: { $cond: [{ $eq: ['$status', 'maintenance'] }, 1, 0] } },
        revenue: { $sum: { $cond: [{ $in: ['$status', ['occupied']] }, '$price', 0] } },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, zone: '$_id', total: 1, occupied: 1, available: 1, maintenance: 1, revenue: 1 } },
  ]);
  return rows;
};

const pendingReservations = async (expoId = null) => {
  const filter = { status: 'reserved', 'reservation.exhibitor': { $ne: null } };
  if (expoId) filter.expo = expoId;
  return Booth.find(filter)
    .populate('exhibitor', 'companyName logo')
    .populate('expo', 'title slug')
    .sort({ 'reservation.requestedAt': 1 });
};

module.exports = {
  listBooths,
  getBooth,
  findByNumber,
  createBooth,
  bulkCreateBooths,
  updateBooth,
  deleteBooth,
  updateStatus,
  requestReservation,
  approveReservation,
  rejectReservation,
  assignBooth,
  releaseBooth,
  occupancyByZone,
  pendingReservations,
  SIZE_DIMENSIONS,
};

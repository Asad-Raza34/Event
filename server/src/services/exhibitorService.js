'use strict';

const mongoose = require('mongoose');
const {
  ExhibitorProfile,
  Product,
  Expo,
  ExpoApplication,
  Booth,
  Registration,
  Review,
  BoothVisit,
  User,
} = require('../models');
const ApiError = require('../utils/ApiError');
const { getPagination, buildMeta, escapeRegex } = require('../utils/pagination');
const { pick } = require('../utils/helpers');
const notificationService = require('./notificationService');
const expoService = require('./expoService');

const EDITABLE = [
  'companyName',
  'tagline',
  'description',
  'categories',
  'website',
  'foundedYear',
  'employeeCount',
  'contact',
  'socials',
  'logo',
  'banner',
];

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

const getMyProfile = async (user) => {
  let profile = await ExhibitorProfile.findOne({ user: user._id });
  if (!profile) {
    profile = await ExhibitorProfile.create({
      user: user._id,
      companyName: user.organization || `${user.name}'s company`,
      contact: { email: user.email, phone: user.phone || '', city: user.city || '', country: user.country || '' },
    });
  }
  const [products, applications, booths, reviews] = await Promise.all([
    Product.find({ exhibitor: profile._id }).sort({ createdAt: -1 }),
    ExpoApplication.find({ exhibitor: profile._id }).populate('expo', 'title slug startDate endDate status location').sort({ createdAt: -1 }),
    Booth.find({ exhibitor: profile._id }).populate('expo', 'title slug startDate endDate status').sort({ createdAt: -1 }),
    Review.find({ targetType: 'ExhibitorProfile', target: profile._id, status: 'published' })
      .populate('author', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(10),
  ]);
  return { profile, products, applications, booths, reviews };
};

const requireProfile = async (user) => {
  const profile = await ExhibitorProfile.findOne({ user: user._id });
  if (!profile) throw ApiError.notFound('Exhibitor profile not found');
  return profile;
};

const updateProfile = async (user, payload) => {
  const profile = await requireProfile(user);
  Object.assign(profile, pick(payload, EDITABLE));
  await profile.save();
  return profile;
};

const uploadAsset = async (user, kind, file) => {
  if (!file) throw ApiError.badRequest('Please choose an image to upload');
  const profile = await requireProfile(user);
  if (kind === 'logo') profile.logo = file.publicPath;
  else if (kind === 'banner') profile.banner = file.publicPath;
  else throw ApiError.badRequest('Unknown asset type');
  await profile.save({ validateBeforeSave: false });
  return { [kind]: file.publicPath };
};

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

const addDocument = async (user, file, meta = {}) => {
  if (!file) throw ApiError.badRequest('Please attach a document');
  const profile = await requireProfile(user);
  profile.documents.push({
    title: meta.title || file.originalname,
    type: meta.type || 'other',
    file: file.publicPath,
    mimeType: file.mimetype,
    size: file.size,
    status: 'pending',
  });
  await profile.save({ validateBeforeSave: false });
  return profile.documents[profile.documents.length - 1];
};

const removeDocument = async (user, documentId) => {
  const profile = await requireProfile(user);
  const doc = profile.documents.id(documentId);
  if (!doc) throw ApiError.notFound('Document not found');
  doc.deleteOne();
  await profile.save({ validateBeforeSave: false });
  return { message: 'Document removed' };
};

const reviewDocument = async (profileId, documentId, { status, note }, admin) => {
  const profile = await ExhibitorProfile.findById(profileId);
  if (!profile) throw ApiError.notFound('Exhibitor not found');
  const doc = profile.documents.id(documentId);
  if (!doc) throw ApiError.notFound('Document not found');
  doc.status = status;
  doc.reviewNote = note || '';
  await profile.save({ validateBeforeSave: false });

  await notificationService.create({
    userId: profile.user,
    type: 'system',
    title: `Document ${status}`,
    body: `"${doc.title}" was ${status} by the organizing team.${note ? ` Note: ${note}` : ''}`,
    createdBy: admin._id,
  });
  return doc;
};

// ---------------------------------------------------------------------------
// Products / services
// ---------------------------------------------------------------------------

const listProducts = async (query = {}, exhibitorId = null) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (exhibitorId) filter.exhibitor = exhibitorId;
  if (query.category) filter.category = query.category;
  if (query.kind) filter.kind = query.kind;
  if (query.active !== 'all') filter.isActive = true;
  if (query.q) {
    const regex = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ name: regex }, { description: regex }, { tags: regex }];
  }
  const [items, total] = await Promise.all([
    Product.find(filter).populate('exhibitor', 'companyName logo slug').sort({ isFeatured: -1, createdAt: -1 }).skip(skip).limit(limit),
    Product.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(total, page, limit) };
};

const createProduct = async (user, payload) => {
  const profile = await requireProfile(user);
  return Product.create({ ...pick(payload, ['name', 'description', 'category', 'kind', 'price', 'currency', 'image', 'gallery', 'tags', 'isFeatured', 'isActive']), exhibitor: profile._id, user: user._id });
};

const updateProduct = async (user, productId, payload) => {
  const product = await Product.findOne({ _id: productId, user: user._id });
  if (!product) throw ApiError.notFound('Product not found');
  Object.assign(product, pick(payload, ['name', 'description', 'category', 'kind', 'price', 'currency', 'image', 'gallery', 'tags', 'isFeatured', 'isActive']));
  await product.save();
  return product;
};

const removeProduct = async (user, productId) => {
  const product = await Product.findOneAndDelete({ _id: productId, user: user._id });
  if (!product) throw ApiError.notFound('Product not found');
  await Booth.updateMany({ featuredProducts: productId }, { $pull: { featuredProducts: productId } });
  return { message: 'Product removed' };
};

// ---------------------------------------------------------------------------
// Booth staff
// ---------------------------------------------------------------------------

const addStaff = async (user, payload) => {
  const profile = await requireProfile(user);
  profile.staff.push(pick(payload, ['name', 'role', 'email', 'phone', 'avatar']));
  await profile.save({ validateBeforeSave: false });
  return profile.staff[profile.staff.length - 1];
};

const updateStaff = async (user, staffId, payload) => {
  const profile = await requireProfile(user);
  const member = profile.staff.id(staffId);
  if (!member) throw ApiError.notFound('Staff member not found');
  Object.assign(member, pick(payload, ['name', 'role', 'email', 'phone', 'avatar']));
  await profile.save({ validateBeforeSave: false });
  return member;
};

const removeStaff = async (user, staffId) => {
  const profile = await requireProfile(user);
  const member = profile.staff.id(staffId);
  if (!member) throw ApiError.notFound('Staff member not found');
  member.deleteOne();
  await profile.save({ validateBeforeSave: false });
  return { message: 'Staff member removed' };
};

// ---------------------------------------------------------------------------
// Expo applications
// ---------------------------------------------------------------------------

const applyToExpo = async (user, payload) => {
  const profile = await requireProfile(user);
  const expo = await Expo.findById(payload.expoId);
  if (!expo) throw ApiError.notFound('Expo not found');
  if (['draft', 'cancelled', 'completed'].includes(expo.status)) {
    throw ApiError.badRequest(`Applications for "${expo.title}" are closed (status: ${expo.status})`);
  }

  const existing = await ExpoApplication.findOne({ expo: expo._id, exhibitor: profile._id });
  if (existing && existing.status !== 'withdrawn') {
    throw ApiError.conflict('You have already applied to this expo');
  }

  const documents = (payload.documents || []).map((doc) => ({
    title: doc.title || 'Application document',
    file: doc.file,
    mimeType: doc.mimeType || '',
    size: doc.size || 0,
  }));

  const application = existing
    ? Object.assign(existing, {
        status: 'pending',
        boothPreferences: payload.boothPreferences || {},
        productsToShowcase: payload.productsToShowcase || [],
        specialRequests: payload.specialRequests || '',
        documents,
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: '',
        timeline: [...(existing.timeline || []), { status: 'pending', note: 'Re-submitted by exhibitor' }],
      })
    : new ExpoApplication({
        expo: expo._id,
        exhibitor: profile._id,
        applicant: user._id,
        boothPreferences: payload.boothPreferences || {},
        productsToShowcase: payload.productsToShowcase || [],
        specialRequests: payload.specialRequests || '',
        documents,
        timeline: [{ status: 'pending', note: 'Application submitted' }],
      });

  await application.save();

  const organizers = await User.find({ role: 'admin' }).select('_id');
  await notificationService.createMany(organizers.map((o) => o._id), {
    type: 'application_received',
    title: 'New exhibitor application',
    body: `${profile.companyName} applied for "${expo.title}".`,
    link: '/admin/exhibitors',
    data: { expoId: expo._id, applicationId: application._id },
  });

  return application;
};

const listApplications = async (query = {}, exhibitorId = null) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (exhibitorId) filter.exhibitor = exhibitorId;
  if (query.expo) filter.expo = query.expo;
  if (query.status) filter.status = query.status;

  const [items, total] = await Promise.all([
    ExpoApplication.find(filter)
      .populate('expo', 'title slug startDate endDate status location banner')
      .populate({ path: 'exhibitor', select: 'companyName logo slug categories contact avgRating' })
      .populate('assignedBooth', 'number zone status price currency')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    ExpoApplication.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(total, page, limit) };
};

const withdrawApplication = async (user, applicationId) => {
  const profile = await requireProfile(user);
  const application = await ExpoApplication.findOne({ _id: applicationId, exhibitor: profile._id });
  if (!application) throw ApiError.notFound('Application not found');
  if (application.status === 'approved') throw ApiError.badRequest('Approved applications cannot be withdrawn — contact the organizer');
  application.status = 'withdrawn';
  application.timeline.push({ status: 'withdrawn', note: 'Withdrawn by exhibitor' });
  await application.save();
  return application;
};

/** Organizer approves / rejects an application. */
const reviewApplication = async (applicationId, { status, reviewNote, boothId }, admin) => {
  if (!['approved', 'rejected', 'under_review'].includes(status)) throw ApiError.badRequest('Invalid review status');
  const application = await ExpoApplication.findById(applicationId).populate('expo', 'title slug');
  if (!application) throw ApiError.notFound('Application not found');

  application.status = status;
  application.reviewNote = reviewNote || '';
  application.reviewedBy = admin._id;
  application.reviewedAt = new Date();
  application.timeline.push({ status, note: reviewNote || `Marked ${status} by organizer` });

  if (status === 'approved') {
    application.exhibitorDoc = undefined;
    await Expo.updateOne({ _id: application.expo._id }, { $inc: { 'stats.exhibitors': 1 } });
  }

  await application.save();

  if (status === 'approved' && boothId) {
    // Lazy require avoids a circular dependency with boothService.
    // eslint-disable-next-line global-require
    await require('./boothService').assignBooth(boothId, application.exhibitor, admin, { applicationId: application._id });
  }

  await notificationService.create({
    userId: application.applicant,
    type: status === 'approved' ? 'application_approved' : 'application_rejected',
    title: status === 'approved' ? `Approved for ${application.expo.title}` : `Application update — ${application.expo.title}`,
    body:
      status === 'approved'
        ? 'Your application was approved. Select your booth from the floor plan or wait for the organizer to assign one.'
        : reviewNote || 'Your application was not accepted for this expo.',
    priority: 'high',
    link: '/exhibitor/applications',
    data: { expoId: application.expo._id, applicationId: application._id },
  });

  await expoService.refreshStats(application.expo._id);
  return application;
};

const updateVerification = async (profileId, { verificationStatus, note }, admin) => {
  const profile = await ExhibitorProfile.findByIdAndUpdate(
    profileId,
    { verificationStatus, verificationNote: note || '' },
    { new: true },
  );
  if (!profile) throw ApiError.notFound('Exhibitor not found');

  await notificationService.create({
    userId: profile.user,
    type: 'system',
    title: `Company verification ${verificationStatus}`,
    body: note || `Your company profile was marked ${verificationStatus}.`,
    createdBy: admin._id,
  });
  return profile;
};

// ---------------------------------------------------------------------------
// Public directory
// ---------------------------------------------------------------------------

const listExhibitors = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.category) filter.categories = query.category;
  if (query.minRating) filter.avgRating = { $gte: Number(query.minRating) };
  if (query.q) {
    const regex = new RegExp(escapeRegex(query.q), 'i');
    filter.$or = [{ companyName: regex }, { description: regex }, { tagline: regex }, { categories: regex }];
  }
  if (query.productCategory) {
    const exhibitorIds = await Product.distinct('exhibitor', { category: query.productCategory, isActive: true });
    filter._id = { $in: exhibitorIds };
  }
  if (query.expo) {
    const booths = await Booth.find({ expo: query.expo, exhibitor: { $ne: null } }).select('exhibitor');
    filter._id = { $in: [...new Set(booths.map((b) => String(b.exhibitor)))] };
  }

  const [items, total] = await Promise.all([
    ExhibitorProfile.find(filter)
      .populate('user', 'name email avatar')
      .sort(query.sort === 'rating' ? { avgRating: -1, reviewCount: -1 } : { isFeatured: -1, companyName: 1 })
      .skip(skip)
      .limit(limit),
    ExhibitorProfile.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(total, page, limit) };
};

const getExhibitor = async (identifier, viewer = null, source = 'directory') => {
  const isObjectId = mongoose.isValidObjectId(identifier) && String(identifier).length === 24;
  const profile = await ExhibitorProfile.findOne(isObjectId ? { _id: identifier } : { slug: identifier }).populate(
    'user',
    'name email avatar lastSeenAt',
  );
  if (!profile) throw ApiError.notFound('Exhibitor not found');

  const [products, booths, reviews, ratingBreakdown] = await Promise.all([
    Product.find({ exhibitor: profile._id, isActive: true }).sort({ isFeatured: -1, createdAt: -1 }),
    Booth.find({ exhibitor: profile._id }).populate('expo', 'title slug startDate endDate status'),
    Review.find({ targetType: 'ExhibitorProfile', target: profile._id, status: 'published' })
      .populate('author', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(20),
    Review.aggregate([
      { $match: { targetType: 'ExhibitorProfile', target: profile._id, status: 'published' } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]),
  ]);

  // Fire-and-forget analytics signals.
  if (viewer && String(viewer._id) !== String(profile.user?._id || profile.user)) {
    BoothVisit.create({ kind: 'profile', exhibitor: profile._id, visitor: viewer._id, source }).catch(() => {});
    ExhibitorProfile.updateOne({ _id: profile._id }, { $inc: { profileViews: 1 } }).catch(() => {});
  }

  const breakdown = [1, 2, 3, 4, 5].reduce((acc, star) => {
    acc[star] = ratingBreakdown.find((r) => r._id === star)?.count || 0;
    return acc;
  }, {});

  return { profile, products, booths, reviews, ratingBreakdown: breakdown };
};

const recordBoothVisit = async (boothId, user, source = 'floor_plan') => {
  const booth = await Booth.findById(boothId);
  if (!booth) throw ApiError.notFound('Booth not found');
  await Booth.updateOne({ _id: boothId }, { $inc: { 'traffic.views': 1 } });
  if (booth.exhibitor) {
    await ExhibitorProfile.updateOne({ _id: booth.exhibitor }, { $inc: { totalBoothVisits: 1 } });
  }
  await BoothVisit.create({
    kind: 'booth',
    booth: booth._id,
    expo: booth.expo,
    exhibitor: booth.exhibitor,
    visitor: user?._id || null,
    source,
  });
  return { recorded: true };
};

const myExpos = async (user) => {
  const profile = await requireProfile(user);
  const applications = await ExpoApplication.find({ exhibitor: profile._id, status: 'approved' })
    .populate('expo')
    .populate('assignedBooth')
    .sort({ createdAt: -1 });
  const boothMap = await Booth.find({ exhibitor: profile._id }).select('expo number zone status');
  return { profile, applications, booths: boothMap };
};

const attendeeCountForExhibitor = async (profileId) => {
  const booths = await Booth.find({ exhibitor: profileId }).select('_id expo');
  const boothIds = booths.map((b) => b._id);
  const [uniqueVisitors, registrations] = await Promise.all([
    BoothVisit.distinct('visitor', { booth: { $in: boothIds }, visitor: { $ne: null } }),
    Registration.countDocuments({ expo: { $in: [...new Set(booths.map((b) => String(b.expo)))] }, status: { $ne: 'cancelled' } }),
  ]);
  return { uniqueVisitors: uniqueVisitors.length, expoRegistrations: registrations };
};

module.exports = {
  getMyProfile,
  requireProfile,
  updateProfile,
  uploadAsset,
  addDocument,
  removeDocument,
  reviewDocument,
  listProducts,
  createProduct,
  updateProduct,
  removeProduct,
  addStaff,
  updateStaff,
  removeStaff,
  applyToExpo,
  listApplications,
  withdrawApplication,
  reviewApplication,
  updateVerification,
  listExhibitors,
  getExhibitor,
  recordBoothVisit,
  myExpos,
  attendeeCountForExhibitor,
};

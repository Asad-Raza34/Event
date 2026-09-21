'use strict';

const mongoose = require('mongoose');
const { Review, ExhibitorProfile, Session, Registration, SessionRegistration, ExpoApplication, Booth } = require('../models');
const ApiError = require('../utils/ApiError');
const { getPagination, buildMeta } = require('../utils/pagination');
const notificationService = require('./notificationService');

const TARGET_MODEL = { exhibitor: 'ExhibitorProfile', session: 'Session' };

const resolveTarget = async (targetType, targetId) => {
  const model = TARGET_MODEL[targetType];
  if (!model) throw ApiError.badRequest('Reviews can only target an exhibitor or a session');
  const doc = await mongoose.model(model).findById(targetId);
  if (!doc) throw ApiError.notFound(`${targetType === 'exhibitor' ? 'Exhibitor' : 'Session'} not found`);
  return doc;
};

/**
 * Best-effort verification: did the reviewer actually take part?
 * Attendees who registered for the expo (or attended the session) earn the
 * "verified attendance" badge, but the review is still accepted without it.
 */
const verifyAttendance = async (user, targetType, target) => {
  if (targetType === 'session') {
    const record = await SessionRegistration.findOne({ user: user._id, session: target._id, status: { $in: ['registered', 'attended'] } });
    return Boolean(record);
  }
  const booths = await Booth.find({ exhibitor: target._id }).select('expo');
  const expoIds = booths.map((b) => b.expo);
  const [registration, application] = await Promise.all([
    Registration.exists({ user: user._id, expo: { $in: expoIds }, status: { $ne: 'cancelled' } }),
    ExpoApplication.exists({ applicant: user._id, exhibitor: target._id, status: 'approved' }),
  ]);
  return Boolean(registration || application);
};

/** Recompute the denormalised rating fields used by the exhibitor directory. */
const syncExhibitorRating = async (exhibitorId) => {
  const [result] = await Review.aggregate([
    { $match: { targetType: 'ExhibitorProfile', target: new mongoose.Types.ObjectId(String(exhibitorId)), status: 'published' } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  await ExhibitorProfile.updateOne(
    { _id: exhibitorId },
    { $set: { avgRating: result ? Math.round(result.avg * 10) / 10 : 0, reviewCount: result?.count || 0 } },
  );
  return { avgRating: result ? Math.round(result.avg * 10) / 10 : 0, reviewCount: result?.count || 0 };
};

const createReview = async (user, payload) => {
  const targetType = payload.targetType === 'session' ? 'session' : 'exhibitor';
  const target = await resolveTarget(targetType, payload.targetId);

  const existing = await Review.findOne({ author: user._id, targetType: TARGET_MODEL[targetType], target: target._id });
  if (existing) throw ApiError.conflict('You have already reviewed this — edit your existing review instead');

  const verified = await verifyAttendance(user, targetType, target);

  let expo = null;
  if (targetType === 'session') expo = target.expo;
  else {
    const booth = await Booth.findOne({ exhibitor: target._id }).select('expo');
    expo = booth?.expo || null;
  }

  const review = await Review.create({
    author: user._id,
    targetType: TARGET_MODEL[targetType],
    target: target._id,
    expo,
    rating: payload.rating,
    title: payload.title || '',
    comment: payload.comment || '',
    verifiedAttendance: verified,
  });

  if (targetType === 'exhibitor') {
    await syncExhibitorRating(target._id);
    await notificationService.create({
      userId: target.user,
      type: 'review_received',
      title: `New ${payload.rating}★ review`,
      body: payload.comment ? payload.comment.slice(0, 160) : `${user.name} rated your company ${payload.rating}/5.`,
      link: '/exhibitor/reviews',
      data: { reviewId: review._id },
    });
  }

  return review;
};

const updateReview = async (reviewId, user, payload) => {
  const review = await Review.findById(reviewId);
  if (!review) throw ApiError.notFound('Review not found');
  if (String(review.author) !== String(user._id)) throw ApiError.forbidden('You can only edit your own review');

  review.rating = payload.rating ?? review.rating;
  review.title = payload.title ?? review.title;
  review.comment = payload.comment ?? review.comment;
  await review.save();

  if (review.targetType === 'ExhibitorProfile') await syncExhibitorRating(review.target);
  return review;
};

const removeReview = async (reviewId, user) => {
  const review = await Review.findById(reviewId);
  if (!review) throw ApiError.notFound('Review not found');
  if (String(review.author) !== String(user._id) && user.role !== 'admin') {
    throw ApiError.forbidden('You can only delete your own review');
  }
  await review.deleteOne();
  if (review.targetType === 'ExhibitorProfile') await syncExhibitorRating(review.target);
  return { message: 'Review deleted', id: reviewId };
};

const listReviews = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.targetType) filter.targetType = query.targetType === 'session' ? 'Session' : 'ExhibitorProfile';
  if (query.target) filter.target = query.target;
  if (query.author) filter.author = query.author;
  if (query.status) filter.status = query.status;
  if (query.minRating) filter.rating = { $gte: Number(query.minRating) };

  const [items, total] = await Promise.all([
    Review.find(filter)
      .populate('author', 'name avatar role organization')
      .populate('target', 'companyName logo slug title date')
      .populate('expo', 'title slug')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Review.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(total, page, limit) };
};

const myReviews = async (user, query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { author: user._id };
  const [items, total] = await Promise.all([
    Review.find(filter)
      .populate('target', 'companyName logo slug title date type')
      .populate('expo', 'title slug')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Review.countDocuments(filter),
  ]);
  return { items, meta: buildMeta(total, page, limit) };
};

const moderateReview = async (reviewId, { status }, admin) => {
  if (!['published', 'hidden', 'flagged'].includes(status)) throw ApiError.badRequest('Invalid review status');
  const review = await Review.findByIdAndUpdate(reviewId, { status }, { new: true });
  if (!review) throw ApiError.notFound('Review not found');
  if (review.targetType === 'ExhibitorProfile') await syncExhibitorRating(review.target);
  return review;
};

/** Exhibitor (or organizer) publicly replies to a review. */
const addReply = async (reviewId, user, body) => {
  const review = await Review.findById(reviewId);
  if (!review) throw ApiError.notFound('Review not found');

  if (review.targetType === 'ExhibitorProfile') {
    const ownsProfile = await ExhibitorProfile.exists({ _id: review.target, user: user._id });
    if (!ownsProfile && user.role !== 'admin') throw ApiError.forbidden('Only the reviewed exhibitor can reply');
  } else if (user.role !== 'admin') {
    throw ApiError.forbidden('Only organizers can reply to session reviews');
  }

  review.replies.push({ author: user._id, body });
  await review.save();

  await notificationService.create({
    userId: review.author,
    type: 'system',
    title: 'Someone replied to your review',
    body: body.slice(0, 160),
    link: '/attendee/reviews',
    data: { reviewId: review._id },
  });
  return review;
};

/** Rating summary used on exhibitor and session detail pages. */
const ratingSummary = async (targetType, targetId) => {
  const [result] = await Review.aggregate([
    { $match: { targetType: TARGET_MODEL[targetType], target: new mongoose.Types.ObjectId(String(targetId)), status: 'published' } },
    {
      $facet: {
        overall: [{ $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }],
        breakdown: [{ $group: { _id: '$rating', count: { $sum: 1 } } }],
      },
    },
  ]);

  const overall = result?.overall?.[0] || { avg: 0, count: 0 };
  const breakdown = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: result?.breakdown?.find((b) => b._id === star)?.count || 0,
  }));

  return {
    average: Math.round((overall.avg || 0) * 10) / 10,
    total: overall.count || 0,
    breakdown,
  };
};

const sessionReviews = async (sessionId, query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter = { targetType: 'Session', target: sessionId, status: 'published' };
  const [items, total, summary] = await Promise.all([
    Review.find(filter).populate('author', 'name avatar').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Review.countDocuments(filter),
    ratingSummary('session', sessionId),
  ]);
  return { items, meta: buildMeta(total, page, limit), summary };
};

module.exports = {
  createReview,
  updateReview,
  removeReview,
  listReviews,
  myReviews,
  moderateReview,
  addReply,
  ratingSummary,
  sessionReviews,
  syncExhibitorRating,
};

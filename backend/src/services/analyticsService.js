'use strict';

const mongoose = require('mongoose');
const {
  User,
  Expo,
  Booth,
  Registration,
  Session,
  SessionRegistration,
  ExpoApplication,
  Appointment,
  Payment,
  Review,
  CheckIn,
  BoothVisit,
  SupportTicket,
  Feedback,
  ExhibitorProfile,
} = require('../models');
const { startOfDay, addDays } = require('../utils/helpers');
const { requireProfile } = require('./exhibitorService');

const oid = (value) => new mongoose.Types.ObjectId(String(value));

/** Daily buckets for the last `days` days, zero-filled so charts never gap. */
const daySeries = (days = 14) => {
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = addDays(startOfDay(new Date()), -i);
    out.push({ date: date.toISOString().slice(0, 10), label: date.toISOString().slice(5, 10) });
  }
  return out;
};

const mergeSeries = (buckets, rows, key = 'count') =>
  buckets.map((bucket) => ({
    ...bucket,
    [key]: rows.find((row) => row._id === bucket.date)?.[key] || 0,
  }));

const countByDay = (Model, { match = {}, days = 14, field = 'createdAt' } = {}) =>
  Model.aggregate([
    { $match: { ...match, [field]: { $gte: addDays(startOfDay(new Date()), -(days - 1)) } } },
    { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: `$${field}`, timezone: 'UTC' } }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

const adminOverview = async ({ days = 14 } = {}) => {
  const now = new Date();
  const series = daySeries(days);

  const [
    expoCounts,
    userCounts,
    exhibitorTotals,
    registrationTotals,
    boothTotals,
    revenueAgg,
    sessionTotals,
    appointmentCounts,
    reviewAgg,
    ticketCounts,
    feedbackAgg,
    registrationsTrend,
    checkInTrend,
    revenueTrend,
    recentRegistrations,
    recentApplications,
    recentPayments,
    recentTickets,
    upcomingSessions,
    popularSessions,
    boothTraffic,
    topExhibitors,
  ] = await Promise.all([
    Expo.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    ExhibitorProfile.countDocuments(),
    Registration.countDocuments(),
    Booth.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, revenue: { $sum: '$total' }, count: { $sum: 1 } } }]),
    Session.aggregate([{ $match: { status: { $ne: 'cancelled' } } }, { $group: { _id: null, count: { $sum: 1 }, seats: { $sum: '$registeredCount' } } }]),
    Appointment.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Review.aggregate([{ $match: { status: 'published' } }, { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }]),
    SupportTicket.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Feedback.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    countByDay(Registration, { days }),
    countByDay(CheckIn, { days, field: 'checkedInAt', match: { type: 'event' } }),
    Payment.aggregate([
      { $match: { status: 'paid', paidAt: { $gte: addDays(startOfDay(now), -(days - 1)) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt', timezone: 'UTC' } }, revenue: { $sum: '$total' } } },
      { $sort: { _id: 1 } },
    ]),
    Registration.find()
      .populate('user', 'name email avatar organization')
      .populate('expo', 'title slug')
      .sort({ createdAt: -1 })
      .limit(6),
    ExpoApplication.find()
      .populate('exhibitor', 'companyName logo slug categories')
      .populate('expo', 'title slug')
      .sort({ createdAt: -1 })
      .limit(6),
    Payment.find({ status: 'paid' })
      .populate('user', 'name email')
      .populate('related.expo', 'title slug')
      .sort({ paidAt: -1 })
      .limit(6),
    SupportTicket.find({ status: { $in: ['open', 'in_progress'] } })
      .populate('user', 'name email avatar')
      .sort({ lastActivityAt: -1 })
      .limit(6),
    Session.find({ status: 'scheduled', date: { $gte: startOfDay(now) } })
      .populate('speakers', 'name photo')
      .populate('expo', 'title slug')
      .sort({ date: 1, startTime: 1 })
      .limit(6),
    Session.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $sort: { registeredCount: -1 } },
      { $limit: 6 },
      { $lookup: { from: 'expos', localField: 'expo', foreignField: '_id', as: 'expo' } },
      { $unwind: { path: '$expo', preserveNullAndEmptyArrays: true } },
      { $project: { title: 1, type: 1, registeredCount: 1, capacity: 1, date: 1, startTime: 1, expoTitle: '$expo.title', expoSlug: '$expo.slug' } },
    ]),
    Booth.find({ 'traffic.views': { $gt: 0 } })
      .populate('exhibitor', 'companyName logo')
      .populate('expo', 'title slug')
      .sort({ 'traffic.views': -1 })
      .limit(6)
      .select('number zone traffic exhibitor expo'),
    BoothVisit.aggregate([
      { $match: { exhibitor: { $ne: null }, createdAt: { $gte: addDays(startOfDay(now), -30) } } },
      { $group: { _id: '$exhibitor', visits: { $sum: 1 } } },
      { $sort: { visits: -1 } },
      { $limit: 6 },
      { $lookup: { from: 'exhibitorprofiles', localField: '_id', foreignField: '_id', as: 'exhibitor' } },
      { $unwind: { path: '$exhibitor', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, exhibitorId: '$_id', visits: 1, name: '$exhibitor.companyName', logo: '$exhibitor.logo' } },
    ]),
  ]);

  const expoStatus = expoCounts.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {});
  const users = userCounts.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {});
  const booths = boothTotals.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {});
  const totalBooths = Object.values(booths).reduce((a, b) => a + b, 0);
  const occupancyRate = totalBooths
    ? Math.round(((Object.keys(booths).filter((s) => ['occupied', 'reserved'].includes(s)).reduce((sum, s) => sum + booths[s], 0)) / totalBooths) * 100)
    : 0;

  return {
    totals: {
      expos: Object.values(expoStatus).reduce((a, b) => a + b, 0),
      exposByStatus: expoStatus,
      upcomingExpos: expoStatus.upcoming || 0,
      ongoingExpos: expoStatus.ongoing || 0,
      completedExpos: expoStatus.completed || 0,
      draftExpos: expoStatus.draft || 0,
      cancelledExpos: expoStatus.cancelled || 0,
      users: Object.values(users).reduce((a, b) => a + b, 0),
      admins: users.admin || 0,
      exhibitors: exhibitorTotals,
      attendees: users.attendee || 0,
      registrations: registrationTotals,
      confirmedRegistrations: await Registration.countDocuments({ status: { $in: ['confirmed', 'attended'] } }),
      attendance: await Registration.countDocuments({ checkedIn: true }),
      booths: { total: totalBooths, ...booths, occupancyRate },
      revenue: Math.round((revenueAgg[0]?.revenue || 0) * 100) / 100,
      paidTransactions: revenueAgg[0]?.count || 0,
      sessions: sessionTotals[0]?.count || 0,
      sessionSeats: sessionTotals[0]?.seats || 0,
      appointments: appointmentCounts.reduce((a, i) => ({ ...a, [i._id]: i.count }), {}),
      averageRating: Math.round((reviewAgg[0]?.avg || 0) * 10) / 10,
      reviews: reviewAgg[0]?.count || 0,
      openTickets: (ticketCounts.find((t) => t._id === 'open')?.count || 0) + (ticketCounts.find((t) => t._id === 'in_progress')?.count || 0),
      ticketsByStatus: ticketCounts.reduce((a, i) => ({ ...a, [i._id]: i.count }), {}),
      feedbackByStatus: feedbackAgg.reduce((a, i) => ({ ...a, [i._id]: i.count }), {}),
    },
    trends: {
      registrations: mergeSeries(series, registrationsTrend),
      attendance: mergeSeries(series, checkInTrend),
      revenue: mergeSeries(series, revenueTrend, 'revenue'),
    },
    boothOccupancyByZone: await Booth.aggregate([
      { $group: { _id: '$zone', total: { $sum: 1 }, occupied: { $sum: { $cond: [{ $in: ['$status', ['occupied', 'reserved']] }, 1, 0] } }, available: { $sum: { $cond: [{ $eq: ['$status', 'available'] }, 1, 0] } } } },
      { $sort: { _id: 1 } },
      { $project: { _id: 0, zone: '$_id', total: 1, occupied: 1, available: 1 } },
    ]),
    popularSessions,
    boothTraffic,
    topExhibitors,
    recent: {
      registrations: recentRegistrations,
      applications: recentApplications,
      payments: recentPayments,
      tickets: recentTickets,
    },
    upcomingSessions,
    generatedAt: new Date(),
  };
};

/** Expo-scoped analytics (the "Analytics" section for a single event). */
const expoAnalytics = async (expoId, { days = 14 } = {}) => {
  const expo = await Expo.findById(expoId).populate('floorPlan');
  if (!expo) return null;
  const series = daySeries(days);
  const match = { expo: oid(expoId) };

  const [
    registrations,
    attendance,
    sessions,
    booths,
    appointments,
    revenue,
    exhibitorCount,
    ratings,
    visitTrend,
  ] = await Promise.all([
    Registration.countDocuments({ ...match, status: { $ne: 'cancelled' } }),
    CheckIn.countDocuments({ ...match, type: 'event' }),
    Session.aggregate([
      { $match: { ...match, status: { $ne: 'cancelled' } } },
      { $group: { _id: '$type', count: { $sum: 1 }, seats: { $sum: '$registeredCount' }, capacity: { $sum: '$capacity' } } },
      { $sort: { count: -1 } },
    ]),
    Booth.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Appointment.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { 'related.expo': oid(expoId), status: 'paid' } }, { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }]),
    ExpoApplication.countDocuments({ ...match, status: 'approved' }),
    Review.aggregate([
      { $match: { ...match, status: 'published' } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]),
    BoothVisit.aggregate([
      { $match: { expo: oid(expoId), createdAt: { $gte: addDays(startOfDay(new Date()), -(days - 1)) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const boothStatus = booths.reduce((a, i) => ({ ...a, [i._id]: i.count }), {});
  const totalBooths = Object.values(boothStatus).reduce((a, b) => a + b, 0);

  return {
    expo,
    totals: {
      registrations,
      attendance,
      attendanceRate: registrations ? Math.round((attendance / registrations) * 100) : 0,
      exhibitors: exhibitorCount,
      sessions: sessions.reduce((sum, s) => sum + s.count, 0),
      sessionSeats: sessions.reduce((sum, s) => sum + s.seats, 0),
      booths: { total: totalBooths, ...boothStatus, occupancyRate: totalBooths ? Math.round(((boothStatus.occupied || 0) / totalBooths) * 100) : 0 },
      appointments: appointments.reduce((a, i) => ({ ...a, [i._id]: i.count }), {}),
      revenue: Math.round((revenue[0]?.total || 0) * 100) / 100,
      transactions: revenue[0]?.count || 0,
      averageRating: Math.round((ratings[0]?.avg || 0) * 10) / 10,
      reviews: ratings[0]?.count || 0,
    },
    sessionBreakdown: sessions,
    trends: {
      registrations: mergeSeries(series, await countByDay(Registration, { match, days })),
      boothVisits: mergeSeries(series, visitTrend),
    },
  };
};

// ---------------------------------------------------------------------------
// Exhibitor
// ---------------------------------------------------------------------------

const exhibitorOverview = async (user, { days = 14 } = {}) => {
  const profile = await requireProfile(user);
  const series = daySeries(days);

  const booths = await Booth.find({ exhibitor: profile._id }).populate('expo', 'title slug startDate endDate status');
  const boothIds = booths.map((b) => b._id);

  const [
    visitTotal,
    uniqueVisitors,
    profileViews,
    visitTrend,
    appointments,
    appointmentTrend,
    reviews,
    ratingSummary,
    productViews,
    messages,
  ] = await Promise.all([
    BoothVisit.countDocuments({ exhibitor: profile._id, kind: 'booth' }),
    BoothVisit.distinct('visitor', { exhibitor: profile._id, visitor: { $ne: null } }),
    profile.profileViews,
    BoothVisit.aggregate([
      { $match: { exhibitor: oid(profile._id), createdAt: { $gte: addDays(startOfDay(new Date()), -(days - 1)) } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Appointment.find({ exhibitor: profile._id })
      .populate('attendee', 'name email organization avatar')
      .populate('expo', 'title slug')
      .sort({ date: -1 })
      .limit(10),
    Appointment.aggregate([{ $match: { exhibitor: oid(profile._id) } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Review.find({ targetType: 'ExhibitorProfile', target: profile._id, status: 'published' })
      .populate('author', 'name avatar')
      .sort({ createdAt: -1 })
      .limit(8),
    Review.aggregate([
      { $match: { targetType: 'ExhibitorProfile', target: oid(profile._id), status: 'published' } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
    ]),
    Booth.aggregate([{ $match: { exhibitor: oid(profile._id) } }, { $group: { _id: null, views: { $sum: '$traffic.views' }, checkIns: { $sum: '$traffic.checkIns' }, appointments: { $sum: '$traffic.appointments' } } }]),
    SessionRegistration.countDocuments({ user: user._id, registered: true }),
  ]);

  const ratingBreakdown = [5, 4, 3, 2, 1].map((star) => ({ star, count: ratingSummary.find((r) => r._id === star)?.count || 0 }));
  const totalReviews = ratingBreakdown.reduce((sum, r) => sum + r.count, 0);
  const weighted = ratingBreakdown.reduce((sum, r) => sum + r.star * r.count, 0);

  const appointmentCounts = appointmentTrend.reduce((a, i) => ({ ...a, [i._id]: i.count }), {});
  const upcoming = appointments
    .filter((a) => new Date(a.date) >= startOfDay(new Date()) && ['pending', 'confirmed'].includes(a.status))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return {
    profile,
    booths,
    totals: {
      boothVisits: visitTotal,
      uniqueVisitors: uniqueVisitors.length,
      profileViews,
      checkIns: productViews[0]?.checkIns || 0,
      products: profile.products.length,
      appointments: Object.values(appointmentCounts).reduce((a, b) => a + b, 0),
      appointmentsByStatus: appointmentCounts,
      averageRating: totalReviews ? Math.round((weighted / totalReviews) * 10) / 10 : profile.avgRating,
      reviews: totalReviews,
      messages,
    },
    trends: { boothVisits: mergeSeries(series, visitTrend) },
    visitsBySource: await BoothVisit.aggregate([
      { $match: { exhibitor: oid(profile._id) } },
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, source: '$_id', count: 1 } },
    ]),
    ratingBreakdown,
    upcomingAppointments: upcoming.slice(0, 5),
    recentReviews: reviews,
    boothIds,
  };
};

module.exports = { adminOverview, expoAnalytics, exhibitorOverview, daySeries };

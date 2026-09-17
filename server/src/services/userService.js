'use strict';

const { User, AttendeeProfile, ExhibitorProfile, Registration } = require('../models');
const ApiError = require('../utils/ApiError');
const { getPagination, buildMeta } = require('../utils/pagination');
const { regexFilter, pick } = require('../utils/helpers');
const authService = require('./authService');

const SELF_EDITABLE = [
  'name',
  'phone',
  'avatar',
  'bio',
  'organization',
  'jobTitle',
  'city',
  'country',
  'interests',
  'notificationPreferences',
];

const getProfile = async (userId) => authService.me(userId);

const updateProfile = async (user, payload) => {
  const updates = pick(payload, SELF_EDITABLE);
  if (updates.name) updates.name = String(updates.name).trim();
  Object.assign(user, updates);
  await user.save();

  if (user.role === 'attendee') {
    await AttendeeProfile.findOneAndUpdate(
      { user: user._id },
      {
        $set: {
          headline: payload.headline ?? undefined,
          organization: updates.organization,
          jobTitle: updates.jobTitle,
          city: updates.city,
          country: updates.country,
          interests: updates.interests,
        },
      },
      { upsert: true, new: true },
    );
  }

  return authService.me(user._id);
};

const updateNotificationPreferences = async (user, preferences = {}) => {
  user.notificationPreferences = { ...user.notificationPreferences.toObject?.() ?? user.notificationPreferences, ...preferences };
  await user.save({ validateBeforeSave: false });
  return user.notificationPreferences;
};

const updateAvatar = async (user, file) => {
  if (!file) throw ApiError.badRequest('Please choose an image to upload');
  user.avatar = file.publicPath;
  await user.save({ validateBeforeSave: false });
  return { avatar: user.avatar };
};

// ---------------------------------------------------------------------------
// Organizer (admin) user management
// ---------------------------------------------------------------------------

const listUsers = async (query = {}) => {
  const { page, limit, skip } = getPagination(query);
  const filter = {};
  if (query.role) filter.role = query.role;
  if (query.active !== undefined && query.active !== '') filter.isActive = query.active === 'true' || query.active === true;
  if (query.q) Object.assign(filter, regexFilter(query.q, ['name', 'email', 'organization', 'city']));

  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  return { items, meta: buildMeta(total, page, limit) };
};

const getUser = async (id) => {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  const [attendeeProfile, exhibitorProfile, registrations] = await Promise.all([
    AttendeeProfile.findOne({ user: id }),
    ExhibitorProfile.findOne({ user: id }),
    Registration.countDocuments({ user: id, status: { $ne: 'cancelled' } }),
  ]);
  return {
    user: user.toJSON(),
    attendeeProfile: attendeeProfile?.toJSON() || null,
    exhibitorProfile: exhibitorProfile?.toJSON() || null,
    registrationCount: registrations,
  };
};

const adminUpdateUser = async (id, payload) => {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');

  const updates = pick(payload, ['name', 'email', 'phone', 'role', 'isActive', 'isEmailVerified', 'organization', 'jobTitle', 'city', 'country']);
  Object.assign(user, updates);
  await user.save();

  if (updates.role) await authService.ensureProfile(user);
  return user.toJSON();
};

const setActive = async (id, isActive, actorId) => {
  if (String(id) === String(actorId)) throw ApiError.badRequest('You cannot deactivate your own account');
  const user = await User.findByIdAndUpdate(id, { isActive }, { new: true });
  if (!user) throw ApiError.notFound('User not found');
  if (!isActive) await User.findByIdAndUpdate(id, { $inc: { tokenVersion: 1 } });
  return user.toJSON();
};

const USER_STATS = async () => {
  const [byRole, active, total] = await Promise.all([
    User.aggregate([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    User.countDocuments({ isActive: true }),
    User.countDocuments(),
  ]);
  const roles = byRole.reduce((acc, item) => ({ ...acc, [item._id]: item.count }), {});
  return { total, active, inactive: total - active, ...roles };
};

module.exports = { getProfile, updateProfile, updateNotificationPreferences, updateAvatar, listUsers, getUser, adminUpdateUser, setActive, stats: USER_STATS };

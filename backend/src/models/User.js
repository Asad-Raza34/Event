'use strict';

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const ROLES = ['admin', 'exhibitor', 'attendee'];
const SALT_ROUNDS = 12;

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 80 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    role: { type: String, enum: { values: ROLES, message: 'Invalid role' }, default: 'attendee', index: true },
    phone: { type: String, trim: true, maxlength: 32 },
    avatar: { type: String, default: '' },
    bio: { type: String, maxlength: 600, default: '' },
    organization: { type: String, trim: true, maxlength: 120, default: '' },
    jobTitle: { type: String, trim: true, maxlength: 120, default: '' },
    city: { type: String, trim: true, maxlength: 80, default: '' },
    country: { type: String, trim: true, maxlength: 80, default: '' },
    interests: { type: [String], default: [] },
    isActive: { type: Boolean, default: true, index: true },
    isEmailVerified: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
    lastSeenAt: { type: Date },
    /** Bumped to invalidate every previously issued refresh token. */
    tokenVersion: { type: Number, default: 0, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    /** WebAuthn registration ceremony challenge (single-use, short-lived). */
    webauthnChallengeHash: { type: String, default: null, select: false },
    webauthnChallengeExpiresAt: { type: Date, default: null, select: false },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true },
      chat: { type: Boolean, default: true },
      reminders: { type: Boolean, default: true },
      announcements: { type: Boolean, default: true },
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete ret.password;
        delete ret.tokenVersion;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpires;
        delete ret.webauthnChallengeHash;
        delete ret.webauthnChallengeExpiresAt;
        delete ret.__v;
        return ret;
      },
    },
  },
);

userSchema.index({ createdAt: -1 });
userSchema.index({ name: 'text', email: 'text', organization: 'text' });

/** Hash the password whenever it changes — plain text is never persisted. */
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
  return next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.password) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.isAdmin = function isAdmin() {
  return this.role === 'admin';
};

userSchema.statics.findByEmailWithPassword = function findByEmailWithPassword(email) {
  return this.findOne({ email: String(email).toLowerCase().trim() }).select('+password +tokenVersion');
};

userSchema.virtual('initials').get(function initials() {
  return String(this.name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
});

const User = mongoose.model('User', userSchema);

module.exports = User;
module.exports.ROLES = ROLES;

'use strict';

const mongoose = require('mongoose');
const { slugify } = require('../utils/helpers');

const EXPO_STATUS = ['draft', 'upcoming', 'ongoing', 'completed', 'cancelled'];
const EXPO_CATEGORIES = [
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

const expoSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Expo title is required'], trim: true, maxlength: 160 },
    slug: { type: String, unique: true, index: true, lowercase: true },
    description: { type: String, required: [true, 'Description is required'], maxlength: 5000 },
    summary: { type: String, maxlength: 300, default: '' },
    theme: { type: String, maxlength: 160, default: '' },
    category: { type: String, enum: EXPO_CATEGORIES, default: 'technology', index: true },
    tags: { type: [String], default: [], index: true },
    organizer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    coOrganizers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    startDate: { type: Date, required: [true, 'Start date is required'], index: true },
    endDate: { type: Date, required: [true, 'End date is required'] },
    registrationDeadline: { type: Date },
    location: {
      venue: { type: String, trim: true, default: '' },
      hall: { type: String, trim: true, default: '' },
      address: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '', index: true },
      state: { type: String, trim: true, default: '' },
      country: { type: String, trim: true, default: '' },
      postalCode: { type: String, trim: true, default: '' },
      coordinates: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
      },
    },
    banner: { type: String, default: '' },
    themeColors: {
      primary: { type: String, default: '#4f46e5' },
      accent: { type: String, default: '#06b6d4' },
    },
    maxAttendees: { type: Number, min: 0, default: 5000 },
    ticketPrice: { type: Number, min: 0, default: 0 },
    currency: { type: String, default: 'USD', uppercase: true, maxlength: 3 },
    boothPriceFrom: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: EXPO_STATUS, default: 'draft', index: true },
    floorPlan: { type: mongoose.Schema.Types.ObjectId, ref: 'FloorPlan' },
    /** Denormalised counters kept in sync by the services layer. */
    stats: {
      registrations: { type: Number, default: 0 },
      exhibitors: { type: Number, default: 0 },
      booths: { type: Number, default: 0 },
      sessions: { type: Number, default: 0 },
      revenue: { type: Number, default: 0 },
    },
    isFeatured: { type: Boolean, default: false, index: true },
    publishedAt: { type: Date },
    cancelledReason: { type: String, default: '' },
    contactEmail: { type: String, lowercase: true, trim: true, default: '' },
    contactPhone: { type: String, trim: true, default: '' },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

expoSchema.index({ title: 'text', description: 'text', theme: 'text', tags: 'text' });
expoSchema.index({ status: 1, startDate: 1 });
expoSchema.index({ 'location.city': 1, category: 1 });

expoSchema.pre('validate', function ensureSlug(next) {
  if (this.title && (!this.slug || this.isModified('title'))) {
    this.slug = slugify(this.title);
  }
  // `invalidate` produces a proper ValidationError (HTTP 422) rather than a
  // bare Error, which would surface as a 500.
  if (this.startDate && this.endDate && this.endDate < this.startDate) {
    this.invalidate('endDate', 'End date must be after the start date');
  }
  return next();
});

/** Duplicate expo titles get a numeric suffix instead of failing the save. */
expoSchema.pre('save', async function uniqueSlug(next) {
  if (!this.isModified('slug') || !this.slug) return next();
  const clash = await this.constructor.exists({ slug: this.slug, _id: { $ne: this._id } });
  if (clash) this.slug = `${this.slug}-${String(this._id).slice(-4)}`;
  return next();
});

expoSchema.virtual('durationDays').get(function durationDays() {
  if (!this.startDate || !this.endDate) return 0;
  return Math.max(1, Math.round((this.endDate - this.startDate) / (1000 * 60 * 60 * 24)) + 1);
});

expoSchema.methods.isRegistrationOpen = function isRegistrationOpen(now = new Date()) {
  if (!['upcoming', 'ongoing'].includes(this.status)) return false;
  if (this.registrationDeadline && now > this.registrationDeadline) return false;
  return now <= this.endDate;
};

expoSchema.methods.isOwner = function isOwner(user) {
  if (!user) return false;
  const userId = String(user._id || user);
  return this.organizer.toString() === userId || this.coOrganizers.some((id) => id.toString() === userId);
};

const Expo = mongoose.model('Expo', expoSchema);

module.exports = Expo;
module.exports.EXPO_STATUS = EXPO_STATUS;
module.exports.EXPO_CATEGORIES = EXPO_CATEGORIES;

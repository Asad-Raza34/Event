'use strict';

const mongoose = require('mongoose');
const { slugify } = require('../utils/helpers');

const CATEGORIES = [
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

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Product name is required'], trim: true, maxlength: 140 },
    description: { type: String, maxlength: 1200, default: '' },
    category: { type: String, default: 'other' },
    price: { type: Number, min: 0, default: 0 },
    currency: { type: String, default: 'USD', uppercase: true, maxlength: 3 },
    image: { type: String, default: '' },
    tags: { type: [String], default: [] },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

const staffSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    role: { type: String, trim: true, maxlength: 80, default: 'Representative' },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    avatar: { type: String, default: '' },
  },
  { timestamps: true },
);

const documentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    type: { type: String, default: 'other' },
    file: { type: String, required: true },
    mimeType: { type: String, default: '' },
    size: { type: Number, default: 0 },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewNote: { type: String, default: '' },
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

const exhibitorProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    companyName: { type: String, required: [true, 'Company name is required'], trim: true, maxlength: 140 },
    slug: { type: String, unique: true, index: true, lowercase: true },
    tagline: { type: String, maxlength: 200, default: '' },
    description: { type: String, maxlength: 4000, default: '' },
    logo: { type: String, default: '' },
    banner: { type: String, default: '' },
    categories: { type: [String], default: [], index: true },
    website: { type: String, maxlength: 200, default: '' },
    foundedYear: { type: Number, min: 1800, max: 2100 },
    employeeCount: { type: String, default: '' },
    contact: {
      email: { type: String, lowercase: true, trim: true, default: '' },
      phone: { type: String, trim: true, default: '' },
      address: { type: String, trim: true, default: '' },
      city: { type: String, trim: true, default: '' },
      country: { type: String, trim: true, default: '' },
    },
    socials: {
      linkedin: { type: String, default: '' },
      twitter: { type: String, default: '' },
      facebook: { type: String, default: '' },
      instagram: { type: String, default: '' },
    },
    products: { type: [productSchema], default: [] },
    staff: { type: [staffSchema], default: [] },
    documents: { type: [documentSchema], default: [] },
    /** Organizer verification of the company account. */
    verificationStatus: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
      index: true,
    },
    verificationNote: { type: String, default: '' },
    avgRating: { type: Number, default: 0, min: 0, max: 5 },
    reviewCount: { type: Number, default: 0 },
    profileViews: { type: Number, default: 0 },
    totalBoothVisits: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

exhibitorProfileSchema.index({ companyName: 'text', description: 'text' });
exhibitorProfileSchema.index({ avgRating: -1 });

/**
 * Slugs combine the company name with a slice of the owner id so two companies
 * with the same name never collide on the unique index.
 */
exhibitorProfileSchema.statics.buildSlug = function buildSlug(companyName, userId) {
  const base = slugify(companyName || 'exhibitor') || 'exhibitor';
  const suffix = userId ? String(userId).slice(-5) : '00000';
  return `${base}-${suffix}`;
};

exhibitorProfileSchema.pre('validate', function ensureSlug(next) {
  if (this.companyName && (!this.slug || this.isModified('companyName'))) {
    this.slug = this.constructor.buildSlug(this.companyName, this.user);
  }
  next();
});

/**
 * `findOneAndUpdate` upserts skip document middleware, so the slug has to be
 * injected into the update explicitly to satisfy the unique index.
 */
exhibitorProfileSchema.pre('findOneAndUpdate', function ensureSlugOnUpdate(next) {
  const update = this.getUpdate() || {};
  const insert = update.$setOnInsert || {};
  if (insert.companyName && !insert.slug) {
    const userId = insert.user || this.getQuery().user;
    update.$setOnInsert = { ...insert, slug: `${slugify(insert.companyName)}-${String(userId).slice(-5)}` };
    this.setUpdate(update);
  }
  next();
});

exhibitorProfileSchema.methods.toPublicJSON = function toPublicJSON() {
  const obj = this.toObject({ virtuals: true });
  delete obj.contact; // contact details are shared after an appointment/chat is accepted
  delete obj.verificationNote;
  return obj;
};

const ExhibitorProfile = mongoose.model('ExhibitorProfile', exhibitorProfileSchema);

module.exports = ExhibitorProfile;
module.exports.CATEGORIES = CATEGORIES;

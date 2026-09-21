'use strict';

const mongoose = require('mongoose');

const BOOTH_STATUS = ['available', 'reserved', 'occupied', 'maintenance'];
const BOOTH_SIZES = ['small', 'medium', 'large', 'premium', 'custom'];
const BOOTH_ZONES = ['A', 'B', 'C', 'D', 'E', 'F'];
/** `available → reserved → occupied` with `maintenance` as an out-of-service state. */
const FLOW = {
  available: ['reserved', 'occupied', 'maintenance'],
  reserved: ['available', 'occupied', 'maintenance'],
  occupied: ['available', 'maintenance'],
  maintenance: ['available'],
};

const boothSchema = new mongoose.Schema(
  {
    expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true, index: true },
    floorPlan: { type: mongoose.Schema.Types.ObjectId, ref: 'FloorPlan' },
    number: { type: String, required: [true, 'Booth number is required'], trim: true, uppercase: true, maxlength: 20 },
    name: { type: String, trim: true, maxlength: 140, default: '' },
    zone: { type: String, trim: true, uppercase: true, default: 'A', index: true },
    size: { type: String, enum: BOOTH_SIZES, default: 'medium' },
    dimensions: {
      width: { type: Number, default: 3 },
      depth: { type: Number, default: 3 },
      unit: { type: String, default: 'm' },
    },
    /** Position on the floor-plan grid (in grid cells). */
    position: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      w: { type: Number, default: 1 },
      h: { type: Number, default: 1 },
    },
    basePrice: { type: Number, min: 0, default: 0 },
    price: { type: Number, min: 0, default: 0 },
    currency: { type: String, default: 'USD', uppercase: true, maxlength: 3 },
    status: { type: String, enum: BOOTH_STATUS, default: 'available', index: true },
    exhibitor: { type: mongoose.Schema.Types.ObjectId, ref: 'ExhibitorProfile', default: null, index: true },
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'ExpoApplication' },
    featuredProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    staff: {
      type: [
        {
          name: { type: String, required: true, trim: true },
          role: { type: String, default: 'Representative' },
          email: String,
          phone: String,
          avatar: String,
        },
      ],
      default: [],
    },
    amenities: { type: [String], default: [] },
    description: { type: String, maxlength: 1500, default: '' },
    /** Pending exhibitor reservation request awaiting organizer approval. */
    reservation: {
      requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      exhibitor: { type: mongoose.Schema.Types.ObjectId, ref: 'ExhibitorProfile', default: null },
      requestedAt: { type: Date, default: null },
      note: { type: String, default: '' },
      payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
    },
    traffic: {
      views: { type: Number, default: 0 },
      checkIns: { type: Number, default: 0 },
      appointments: { type: Number, default: 0 },
    },
    assignedAt: { type: Date, default: null },
    releasedAt: { type: Date, default: null },
    maintenanceNote: { type: String, default: '' },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

// Booth numbers restart in each zone (A-01, B-01 …), so uniqueness is per zone.
boothSchema.index({ expo: 1, zone: 1, number: 1 }, { unique: true });
boothSchema.index({ expo: 1, status: 1, zone: 1 });
boothSchema.index({ number: 'text', name: 'text' });
boothSchema.index({ expo: 1, number: 1 });

boothSchema.virtual('isAvailable').get(function isAvailable() {
  return this.status === 'available';
});

boothSchema.methods.canTransitionTo = function canTransitionTo(nextStatus) {
  return (FLOW[this.status] || []).includes(nextStatus);
};

/** Formatted label such as `B-12 — North Hall`. */
boothSchema.methods.label = function label() {
  return `${this.zone}-${this.number}`;
};

const Booth = mongoose.model('Booth', boothSchema);

module.exports = Booth;
module.exports.BOOTH_STATUS = BOOTH_STATUS;
module.exports.BOOTH_SIZES = BOOTH_SIZES;
module.exports.BOOTH_ZONES = BOOTH_ZONES;

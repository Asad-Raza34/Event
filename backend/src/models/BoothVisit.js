'use strict';

const mongoose = require('mongoose');

/**
 * Lightweight visit record. Powers booth-traffic and exhibitor profile-view
 * analytics (counts + trends) without inflating the Booth documents.
 */
const boothVisitSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['booth', 'profile', 'product'], default: 'booth', index: true },
    booth: { type: mongoose.Schema.Types.ObjectId, ref: 'Booth', default: null, index: true },
    expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', default: null, index: true },
    exhibitor: { type: mongoose.Schema.Types.ObjectId, ref: 'ExhibitorProfile', default: null, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    visitor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    source: {
      type: String,
      enum: ['floor_plan', 'directory', 'search', 'profile', 'qr', 'direct'],
      default: 'direct',
    },
  },
  { timestamps: { createdAt: true, updatedAt: false }, toJSON: { virtuals: true } },
);

boothVisitSchema.index({ booth: 1, createdAt: -1 });
boothVisitSchema.index({ exhibitor: 1, createdAt: -1 });
boothVisitSchema.index({ expo: 1, kind: 1, createdAt: -1 });

module.exports = mongoose.model('BoothVisit', boothVisitSchema);

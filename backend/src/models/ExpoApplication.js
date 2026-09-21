'use strict';

const mongoose = require('mongoose');

const APPLICATION_STATUS = ['pending', 'under_review', 'approved', 'rejected', 'withdrawn'];

/** Exhibitor application to participate in a specific expo. */
const expoApplicationSchema = new mongoose.Schema(
  {
    expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true, index: true },
    exhibitor: { type: mongoose.Schema.Types.ObjectId, ref: 'ExhibitorProfile', required: true, index: true },
    applicant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: { type: String, enum: APPLICATION_STATUS, default: 'pending', index: true },
    boothPreferences: {
      size: { type: String, default: 'medium' },
      zone: { type: String, default: '' },
      preferredBooth: { type: mongoose.Schema.Types.ObjectId, ref: 'Booth' },
      notes: { type: String, maxlength: 1000, default: '' },
    },
    productsToShowcase: { type: [String], default: [] },
    specialRequests: { type: String, maxlength: 1500, default: '' },
    documents: {
      type: [
        {
          title: String,
          file: { type: String, required: true },
          mimeType: String,
          size: Number,
          uploadedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    reviewNote: { type: String, default: '' },
    assignedBooth: { type: mongoose.Schema.Types.ObjectId, ref: 'Booth' },
    /** Set when the exhibitor pays for the booth allocation. */
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    timeline: {
      type: [
        {
          status: String,
          note: String,
          at: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

expoApplicationSchema.index({ expo: 1, exhibitor: 1 }, { unique: true });
expoApplicationSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('ExpoApplication', expoApplicationSchema);
module.exports.APPLICATION_STATUS = APPLICATION_STATUS;

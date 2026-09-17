'use strict';

const mongoose = require('mongoose');

const TARGET_MODELS = ['ExhibitorProfile', 'Session'];

/**
 * A review targets either an exhibitor profile or a session. Mongoose's
 * `refPath` keeps a single collection with a real reference, while the
 * (author, target) unique index stops duplicate reviews.
 */
const reviewSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetType: { type: String, enum: TARGET_MODELS, required: true, index: true },
    target: { type: mongoose.Schema.Types.ObjectId, refPath: 'targetType', required: true, index: true },
    expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', default: null, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, maxlength: 140, default: '' },
    comment: { type: String, maxlength: 2000, default: '' },
    status: { type: String, enum: ['published', 'hidden', 'flagged'], default: 'published', index: true },
    verifiedAttendance: { type: Boolean, default: false },
    helpfulCount: { type: Number, default: 0 },
    replies: {
      type: [
        {
          author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
          body: { type: String, required: true, maxlength: 1500 },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

reviewSchema.index({ author: 1, targetType: 1, target: 1 }, { unique: true });
reviewSchema.index({ targetType: 1, target: 1, createdAt: -1 });
reviewSchema.index({ targetType: 1, target: 1, rating: -1 });

module.exports = mongoose.model('Review', reviewSchema);
module.exports.REVIEW_TARGETS = TARGET_MODELS;

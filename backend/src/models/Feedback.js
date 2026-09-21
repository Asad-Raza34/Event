'use strict';

const mongoose = require('mongoose');

const FEEDBACK_CATEGORIES = ['general', 'session', 'exhibitor', 'venue', 'app', 'website', 'payment', 'accessibility'];

const feedbackSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    name: { type: String, default: 'Anonymous', maxlength: 120 },
    email: { type: String, default: '', lowercase: true, trim: true },
    expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', default: null, index: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', default: null },
    category: { type: String, enum: FEEDBACK_CATEGORIES, default: 'general', index: true },
    subject: { type: String, required: [true, 'Subject is required'], maxlength: 180 },
    message: { type: String, required: [true, 'Message is required'], maxlength: 3000 },
    rating: { type: Number, min: 1, max: 5, default: null },
    isAnonymous: { type: Boolean, default: false },
    status: { type: String, enum: ['new', 'reviewed', 'resolved', 'archived'], default: 'new', index: true },
    response: { type: String, default: '' },
    respondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    respondedAt: { type: Date, default: null },
    tags: { type: [String], default: [] },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

feedbackSchema.index({ status: 1, createdAt: -1 });
feedbackSchema.index({ expo: 1, category: 1 });
feedbackSchema.index({ subject: 'text', message: 'text' });

module.exports = mongoose.model('Feedback', feedbackSchema);
module.exports.FEEDBACK_CATEGORIES = FEEDBACK_CATEGORIES;

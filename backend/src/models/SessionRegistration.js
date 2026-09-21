'use strict';

const mongoose = require('mongoose');

const STATUS = ['registered', 'waitlisted', 'attended', 'cancelled', 'no_show'];

/**
 * Links a user to a session. The same record tracks two independent states:
 * `registered` (a seat is held) and `bookmarked` (saved for later).
 */
const sessionRegistrationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true, index: true },
    expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true, index: true },
    registered: { type: Boolean, default: false },
    bookmarked: { type: Boolean, default: false },
    status: { type: String, enum: STATUS, default: 'registered', index: true },
    registeredAt: { type: Date, default: null },
    attendedAt: { type: Date, default: null },
    reminderSentAt: { type: Date, default: null },
    cancelReason: { type: String, default: '' },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

sessionRegistrationSchema.index({ user: 1, session: 1 }, { unique: true });
sessionRegistrationSchema.index({ session: 1, status: 1 });
sessionRegistrationSchema.index({ user: 1, bookmarked: 1, createdAt: -1 });

module.exports = mongoose.model('SessionRegistration', sessionRegistrationSchema);
module.exports.SESSION_REGISTRATION_STATUS = STATUS;

'use strict';

const mongoose = require('mongoose');

/** Attendee-specific profile data, one-to-one with User(role=attendee). */
const attendeeProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    headline: { type: String, maxlength: 160, default: '' },
    organization: { type: String, maxlength: 120, default: '' },
    jobTitle: { type: String, maxlength: 120, default: '' },
    city: { type: String, maxlength: 80, default: '' },
    country: { type: String, maxlength: 80, default: '' },
    website: { type: String, maxlength: 200, default: '' },
    interests: { type: [String], default: [] },
    /** Aggregated, cheap-to-read counters for the attendee dashboard. */
    stats: {
      exposRegistered: { type: Number, default: 0 },
      sessionsRegistered: { type: Number, default: 0 },
      appointmentsBooked: { type: Number, default: 0 },
      checkIns: { type: Number, default: 0 },
    },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

module.exports = mongoose.model('AttendeeProfile', attendeeProfileSchema);

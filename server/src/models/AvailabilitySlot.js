'use strict';

const mongoose = require('mongoose');

/** A bookable meeting window published by an exhibitor. */
const availabilitySlotSchema = new mongoose.Schema(
  {
    exhibitor: { type: mongoose.Schema.Types.ObjectId, ref: 'ExhibitorProfile', required: true, index: true },
    exhibitorUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true, index: true },
    date: { type: Date, required: true, index: true },
    startTime: {
      type: String,
      required: true,
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Start time must use HH:mm format'],
    },
    endTime: {
      type: String,
      required: true,
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'End time must use HH:mm format'],
    },
    durationMinutes: { type: Number, default: 30, min: 10, max: 240 },
    location: { type: String, default: '' },
    meetingLink: { type: String, default: '' },
    status: { type: String, enum: ['open', 'booked', 'blocked'], default: 'open', index: true },
    bookedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    note: { type: String, default: '' },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

availabilitySlotSchema.index({ exhibitorUser: 1, date: 1, startTime: 1 });
availabilitySlotSchema.index({ expo: 1, status: 1, date: 1 });

module.exports = mongoose.model('AvailabilitySlot', availabilitySlotSchema);

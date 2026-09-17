'use strict';

const mongoose = require('mongoose');
const { humanCode } = require('../utils/helpers');

const APPOINTMENT_STATUS = ['pending', 'confirmed', 'rejected', 'cancelled', 'completed'];

/** A booked meeting between an attendee and an exhibitor during an expo. */
const appointmentSchema = new mongoose.Schema(
  {
    reference: { type: String, unique: true, index: true, default: () => humanCode('APT', 6) },
    expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true, index: true },
    exhibitor: { type: mongoose.Schema.Types.ObjectId, ref: 'ExhibitorProfile', required: true, index: true },
    exhibitorUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    attendee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    slot: { type: mongoose.Schema.Types.ObjectId, ref: 'AvailabilitySlot', default: null },
    date: { type: Date, required: true, index: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    durationMinutes: { type: Number, default: 30 },
    topic: { type: String, required: [true, 'Appointment topic is required'], maxlength: 200 },
    agenda: { type: String, maxlength: 1500, default: '' },
    attendeeCount: { type: Number, default: 1, min: 1 },
    status: { type: String, enum: APPOINTMENT_STATUS, default: 'pending', index: true },
    requestedBy: { type: String, enum: ['attendee', 'exhibitor'], default: 'attendee' },
    location: {
      boothNumber: { type: String, default: '' },
      venue: { type: String, default: '' },
      meetingPoint: { type: String, default: '' },
      link: { type: String, default: '' },
    },
    respondedAt: { type: Date, default: null },
    responseNote: { type: String, default: '' },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    cancelReason: { type: String, default: '' },
    completedAt: { type: Date, default: null },
    meetingNotes: { type: String, default: '' },
    reminderSentAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

appointmentSchema.index({ exhibitorUser: 1, date: 1, startTime: 1 });
appointmentSchema.index({ attendee: 1, date: -1 });
appointmentSchema.index({ expo: 1, status: 1 });

appointmentSchema.virtual('isActive').get(function isActive() {
  return ['pending', 'confirmed'].includes(this.status);
});

module.exports = mongoose.model('Appointment', appointmentSchema);
module.exports.APPOINTMENT_STATUS = APPOINTMENT_STATUS;

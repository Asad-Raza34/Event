'use strict';

const mongoose = require('mongoose');

const SESSION_TYPES = ['session', 'workshop', 'seminar', 'presentation', 'keynote', 'panel'];
const SESSION_STATUS = ['scheduled', 'cancelled', 'completed'];
const LEVELS = ['beginner', 'intermediate', 'advanced', 'all'];

const sessionSchema = new mongoose.Schema(
  {
    expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true, index: true },
    title: { type: String, required: [true, 'Session title is required'], trim: true, maxlength: 180 },
    description: { type: String, maxlength: 4000, default: '' },
    type: { type: String, enum: SESSION_TYPES, default: 'session', index: true },
    category: { type: String, trim: true, maxlength: 80, default: 'general', index: true },
    level: { type: String, enum: LEVELS, default: 'all' },
    date: { type: Date, required: [true, 'Session date is required'], index: true },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'Start time must use HH:mm format'],
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
      match: [/^([01]\d|2[0-3]):[0-5]\d$/, 'End time must use HH:mm format'],
    },
    speakers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Speaker' }],
    location: {
      venue: { type: String, trim: true, default: '' },
      room: { type: String, trim: true, default: '' },
      hall: { type: String, trim: true, default: '' },
      booth: { type: mongoose.Schema.Types.ObjectId, ref: 'Booth', default: null },
    },
    capacity: { type: Number, min: 1, default: 100 },
    registeredCount: { type: Number, default: 0, min: 0 },
    waitlistCount: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: SESSION_STATUS, default: 'scheduled', index: true },
    tags: { type: [String], default: [] },
    isFeatured: { type: Boolean, default: false },
    requiresRegistration: { type: Boolean, default: true },
    price: { type: Number, min: 0, default: 0 },
    materials: {
      type: [
        {
          title: String,
          url: String,
          file: String,
          addedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    cancellationReason: { type: String, default: '' },
    reminderSentAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

sessionSchema.index({ expo: 1, date: 1, startTime: 1 });
sessionSchema.index({ title: 'text', description: 'text', tags: 'text', category: 'text' });

sessionSchema.virtual('seatsRemaining').get(function seatsRemaining() {
  return Math.max(0, (this.capacity || 0) - (this.registeredCount || 0));
});

sessionSchema.virtual('isFull').get(function isFull() {
  return (this.registeredCount || 0) >= (this.capacity || 0);
});

sessionSchema.methods.getDateTime = function getDateTime() {
  const [hours, minutes] = String(this.startTime).split(':').map(Number);
  const dt = new Date(this.date);
  dt.setUTCHours(hours, minutes, 0, 0);
  return dt;
};

const Session = mongoose.model('Session', sessionSchema);

module.exports = Session;
module.exports.SESSION_TYPES = SESSION_TYPES;
module.exports.SESSION_STATUS = SESSION_STATUS;
module.exports.LEVELS = LEVELS;

'use strict';

const mongoose = require('mongoose');
const { humanCode } = require('../utils/helpers');

const REGISTRATION_STATUS = ['pending', 'confirmed', 'waitlisted', 'cancelled', 'attended'];

/** An attendee's registration for an expo — also the source of the event pass. */
const registrationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true, index: true },
    passCode: { type: String, unique: true, index: true, default: () => humanCode('ES', 8) },
    passType: { type: String, enum: ['standard', 'vip', 'exhibitor_staff', 'speaker'], default: 'standard' },
    status: { type: String, enum: REGISTRATION_STATUS, default: 'confirmed', index: true },
    source: { type: String, enum: ['web', 'admin', 'onsite'], default: 'web' },
    attendeeDetails: {
      fullName: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      organization: { type: String, default: '' },
      jobTitle: { type: String, default: '' },
      country: { type: String, default: '' },
      dietaryRequirements: { type: String, default: '' },
      accessibilityNeeds: { type: String, default: '' },
    },
    interests: { type: [String], default: [] },
    seatNumber: { type: String, default: '' },
    amount: { type: Number, min: 0, default: 0 },
    currency: { type: String, default: 'USD', uppercase: true, maxlength: 3 },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
    paymentStatus: { type: String, enum: ['not_required', 'pending', 'paid', 'refunded'], default: 'not_required' },
    checkedIn: { type: Boolean, default: false, index: true },
    checkedInAt: { type: Date, default: null },
    checkInCount: { type: Number, default: 0 },
    badgeIssuedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: '' },
    notes: { type: String, default: '' },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

registrationSchema.index({ user: 1, expo: 1 }, { unique: true });
registrationSchema.index({ expo: 1, status: 1, createdAt: -1 });
registrationSchema.index({ expo: 1, checkedIn: 1 });

registrationSchema.virtual('isCheckedIn').get(function isCheckedIn() {
  return this.checkedIn;
});

const Registration = mongoose.model('Registration', registrationSchema);

module.exports = Registration;
module.exports.REGISTRATION_STATUS = REGISTRATION_STATUS;

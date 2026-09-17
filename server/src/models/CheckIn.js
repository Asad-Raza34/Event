'use strict';

const mongoose = require('mongoose');

/** Immutable audit record created whenever a QR code is scanned or validated. */
const checkInSchema = new mongoose.Schema(
  {
    expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    registration: { type: mongoose.Schema.Types.ObjectId, ref: 'Registration', default: null, index: true },
    type: { type: String, enum: ['event', 'booth', 'session'], default: 'event', index: true },
    booth: { type: mongoose.Schema.Types.ObjectId, ref: 'Booth', default: null, index: true },
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', default: null, index: true },
    code: { type: String, required: true, index: true },
    method: { type: String, enum: ['qr', 'manual', 'badge'], default: 'qr' },
    scannedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    scannerName: { type: String, default: '' },
    device: { type: String, default: '' },
    verified: { type: Boolean, default: true },
    note: { type: String, default: '' },
    checkedInAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

checkInSchema.index({ expo: 1, type: 1, checkedInAt: -1 });
checkInSchema.index({ expo: 1, user: 1, type: 1 });

module.exports = mongoose.model('CheckIn', checkInSchema);

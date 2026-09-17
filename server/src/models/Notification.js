'use strict';

const mongoose = require('mongoose');

const NOTIFICATION_TYPES = [
  'expo_registration',
  'expo_published',
  'expo_updated',
  'application_received',
  'application_approved',
  'application_rejected',
  'booth_assigned',
  'booth_reserved',
  'booth_released',
  'payment_confirmed',
  'payment_failed',
  'invoice_issued',
  'session_registered',
  'session_reminder',
  'session_cancelled',
  'schedule_changed',
  'appointment_requested',
  'appointment_confirmed',
  'appointment_rejected',
  'appointment_cancelled',
  'appointment_completed',
  'new_message',
  'announcement',
  'review_received',
  'support_ticket_update',
  'system',
];

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, default: 'system', index: true },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, maxlength: 1000, default: '' },
    /** Free-form payload used by the client to deep-link (expoId, boothId, …). */
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    link: { type: String, default: '' },
    priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    /** Prevents duplicate notifications for the same event. */
    dedupeKey: { type: String, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

notificationSchema.index({ user: 1, read: 1, createdAt: -1 });
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ dedupeKey: 1 }, { unique: true, sparse: true, partialFilterExpression: { dedupeKey: { $type: 'string' } } });

module.exports = mongoose.model('Notification', notificationSchema);
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;

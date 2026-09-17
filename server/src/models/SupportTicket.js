'use strict';

const mongoose = require('mongoose');
const { humanCode } = require('../utils/helpers');

const TICKET_STATUS = ['open', 'in_progress', 'resolved', 'closed'];
const TICKET_PRIORITY = ['low', 'medium', 'high', 'urgent'];

const ticketMessageSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, default: '' },
    authorRole: { type: String, default: 'attendee' },
    body: { type: String, required: true, maxlength: 3000 },
    isStaff: { type: Boolean, default: false },
    attachments: [{ name: String, url: String, mimeType: String, size: Number }],
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const supportTicketSchema = new mongoose.Schema(
  {
    ticketNumber: { type: String, unique: true, index: true, default: () => humanCode('TKT', 7) },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: String, required: [true, 'Subject is required'], maxlength: 200 },
    description: { type: String, required: [true, 'Description is required'], maxlength: 4000 },
    category: {
      type: String,
      enum: ['technical', 'payment', 'registration', 'booth', 'account', 'exhibitor', 'other'],
      default: 'other',
      index: true,
    },
    priority: { type: String, enum: TICKET_PRIORITY, default: 'medium', index: true },
    status: { type: String, enum: TICKET_STATUS, default: 'open', index: true },
    relatedExpo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', default: null },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    messages: { type: [ticketMessageSchema], default: [] },
    attachments: [{ name: String, url: String, mimeType: String, size: Number }],
    lastActivityAt: { type: Date, default: Date.now, index: true },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    satisfactionRating: { type: Number, min: 1, max: 5, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

supportTicketSchema.index({ status: 1, priority: -1, lastActivityAt: -1 });
supportTicketSchema.index({ subject: 'text', description: 'text' });

module.exports = mongoose.model('SupportTicket', supportTicketSchema);
module.exports.TICKET_STATUS = TICKET_STATUS;
module.exports.TICKET_PRIORITY = TICKET_PRIORITY;

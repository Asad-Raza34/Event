'use strict';

const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true, index: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: [true, 'Title is required'], maxlength: 200 },
    body: { type: String, required: [true, 'Message is required'], maxlength: 3000 },
    audience: { type: String, enum: ['all', 'attendees', 'exhibitors', 'speakers'], default: 'all', index: true },
    priority: { type: String, enum: ['normal', 'high', 'urgent'], default: 'normal' },
    pinned: { type: Boolean, default: false },
    publishedAt: { type: Date, default: Date.now, index: true },
    expiresAt: { type: Date, default: null },
    channel: { type: String, enum: ['in_app', 'email', 'both'], default: 'in_app' },
    recipientCount: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

announcementSchema.index({ expo: 1, publishedAt: -1 });

module.exports = mongoose.model('Announcement', announcementSchema);

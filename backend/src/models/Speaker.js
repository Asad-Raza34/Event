'use strict';

const mongoose = require('mongoose');

const speakerSchema = new mongoose.Schema(
  {
    /** Optional linked account so speakers can log in and see their sessions. */
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, required: [true, 'Speaker name is required'], trim: true, maxlength: 120 },
    title: { type: String, trim: true, maxlength: 140, default: '' },
    organization: { type: String, trim: true, maxlength: 140, default: '' },
    bio: { type: String, maxlength: 2500, default: '' },
    photo: { type: String, default: '' },
    email: { type: String, lowercase: true, trim: true, default: '' },
    expertise: { type: [String], default: [], index: true },
    socials: {
      linkedin: { type: String, default: '' },
      twitter: { type: String, default: '' },
      website: { type: String, default: '' },
    },
    isFeatured: { type: Boolean, default: false },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

speakerSchema.index({ name: 'text', organization: 'text', expertise: 'text' });

module.exports = mongoose.model('Speaker', speakerSchema);

'use strict';

const mongoose = require('mongoose');

/**
 * One-to-one conversation. `pairKey` (the two participant ids sorted and
 * joined) guarantees a single thread per pair regardless of who started it.
 */
const conversationSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }],
    pairKey: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ['direct'], default: 'direct' },
    /** Optional context: chats started from an expo or an exhibitor profile. */
    expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', default: null },
    exhibitor: { type: mongoose.Schema.Types.ObjectId, ref: 'ExhibitorProfile', default: null },
    lastMessage: { type: mongoose.Schema.Types.ObjectId, ref: 'Message', default: null },
    lastMessageAt: { type: Date, default: new Date(), index: true },
    lastMessagePreview: { type: String, default: '', maxlength: 160 },
    lastSender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    unreadCounts: { type: Map, of: Number, default: {} },
    archivedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

conversationSchema.index({ participants: 1, lastMessageAt: -1 });

conversationSchema.statics.buildPairKey = function buildPairKey(a, b) {
  return [String(a), String(b)].sort().join(':');
};

conversationSchema.methods.otherParticipant = function otherParticipant(userId) {
  return this.participants.find((id) => id.toString() !== String(userId));
};

conversationSchema.methods.unreadFor = function unreadFor(userId) {
  if (!this.unreadCounts) return 0;
  const value = this.unreadCounts.get(String(userId));
  return Number(value || 0);
};

module.exports = mongoose.model('Conversation', conversationSchema);

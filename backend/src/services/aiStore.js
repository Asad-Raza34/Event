'use strict';

const mongoose = require('mongoose');

/**
 * Assistant transcript storage, kept in its own tiny collection so chat history
 * never mixes with user-to-user messaging.
 */
const entrySchema = new mongoose.Schema(
  {
    question: { type: String, required: true, maxlength: 1000 },
    answer: { type: String, required: true, maxlength: 6000 },
    provider: { type: String, default: 'local' },
    intent: { type: String, default: 'unknown' },
    sources: [{ label: String, link: String }],
    at: { type: Date, default: Date.now },
  },
  { _id: true },
);

const aiConversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', default: null },
    messages: { type: [entrySchema], default: [] },
    lastActivityAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true },
);

aiConversationSchema.index({ user: 1, lastActivityAt: -1 });

const AiConversation = mongoose.model('AiConversation', aiConversationSchema);

const append = ({ userId, expoId, message, result }) =>
  AiConversation.findOneAndUpdate(
    { user: userId, expo: expoId },
    {
      $push: {
        messages: {
          question: message,
          answer: result.answer,
          provider: result.provider,
          intent: result.intent,
          sources: result.sources,
        },
      },
      $set: { lastActivityAt: new Date() },
      $setOnInsert: { user: userId, expo: expoId },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

const latest = (userId) => AiConversation.findOne({ user: userId }).sort({ lastActivityAt: -1 });

const clear = async (userId) => {
  await AiConversation.deleteMany({ user: userId });
  return { message: 'Assistant history cleared' };
};

module.exports = { AiConversation, append, latest, clear };

'use strict';

const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    body: { type: String, trim: true, maxlength: 4000, default: '' },
    attachments: {
      type: [
        {
          name: String,
          url: { type: String, required: true },
          mimeType: String,
          size: Number,
        },
      ],
      default: [],
    },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isSystem: { type: Boolean, default: false },
    /** Soft delete for one side of the conversation. */
    deletedFor: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    editedAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

messageSchema.index({ conversation: 1, createdAt: -1 });
messageSchema.index({ body: 'text' });

messageSchema.pre('validate', function requireContent(next) {
  if (!this.isSystem && !this.body && (!this.attachments || this.attachments.length === 0)) {
    return next(new Error('A message needs text or an attachment'));
  }
  return next();
});

module.exports = mongoose.model('Message', messageSchema);

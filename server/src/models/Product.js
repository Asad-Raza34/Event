'use strict';

const mongoose = require('mongoose');

/** Product / service catalogue owned by an exhibitor and shown at booths. */
const productSchema = new mongoose.Schema(
  {
    exhibitor: { type: mongoose.Schema.Types.ObjectId, ref: 'ExhibitorProfile', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: [true, 'Product name is required'], trim: true, maxlength: 160 },
    description: { type: String, maxlength: 2000, default: '' },
    category: { type: String, trim: true, maxlength: 80, default: 'other', index: true },
    kind: { type: String, enum: ['product', 'service'], default: 'product' },
    price: { type: Number, min: 0, default: 0 },
    currency: { type: String, default: 'USD', uppercase: true, maxlength: 3 },
    image: { type: String, default: '' },
    gallery: { type: [String], default: [] },
    tags: { type: [String], default: [], index: true },
    isFeatured: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true, index: true },
    stats: {
      views: { type: Number, default: 0 },
      boothShares: { type: Number, default: 0 },
    },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

productSchema.index({ name: 'text', description: 'text', tags: 'text', category: 'text' });

module.exports = mongoose.model('Product', productSchema);

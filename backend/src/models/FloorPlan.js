'use strict';

const mongoose = require('mongoose');

/** Visual grid layout for an expo hall. Booths hold their own coordinates. */
const floorPlanSchema = new mongoose.Schema(
  {
    expo: { type: mongoose.Schema.Types.ObjectId, ref: 'Expo', required: true, unique: true, index: true },
    name: { type: String, default: 'Main Hall', trim: true, maxlength: 140 },
    width: { type: Number, default: 1200 },
    height: { type: Number, default: 800 },
    gridCols: { type: Number, default: 20, min: 4, max: 80 },
    gridRows: { type: Number, default: 14, min: 4, max: 80 },
    backgroundImage: { type: String, default: '' },
    zones: {
      type: [
        {
          name: { type: String, required: true },
          color: { type: String, default: '#6366f1' },
          description: { type: String, default: '' },
        },
      ],
      default: [],
    },
    amenities: {
      type: [
        {
          name: { type: String, required: true },
          type: { type: String, default: 'facility' },
          x: { type: Number, default: 0 },
          y: { type: Number, default: 0 },
        },
      ],
      default: [],
    },
    notes: { type: String, default: '' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true, toJSON: { virtuals: true } },
);

module.exports = mongoose.model('FloorPlan', floorPlanSchema);

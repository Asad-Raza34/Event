'use strict';

const { body, param } = require('express-validator');
const { BOOTH_STATUS, BOOTH_SIZES, BOOTH_ZONES } = require('../models/Booth');

const createBooth = [
  body('expo').isMongoId().withMessage('Choose the expo for this booth'),
  body('number').trim().notEmpty().withMessage('Booth number is required').isLength({ max: 20 }),
  body('name').optional({ values: 'falsy' }).isString().isLength({ max: 140 }),
  body('zone').optional({ values: 'falsy' }).isIn(BOOTH_ZONES).withMessage(`Zone must be one of ${BOOTH_ZONES.join(', ')}`),
  body('size').optional().isIn(BOOTH_SIZES),
  body('price').optional().isFloat({ min: 0 }).toFloat(),
  body('description').optional({ values: 'falsy' }).isString().isLength({ max: 1500 }),
  body('amenities').optional().isArray({ max: 20 }),
  body('position.x').optional().isInt({ min: 0 }).toInt(),
  body('position.y').optional().isInt({ min: 0 }).toInt(),
  body('position.w').optional().isInt({ min: 1, max: 10 }).toInt(),
  body('position.h').optional().isInt({ min: 1, max: 10 }).toInt(),
];

const bulkCreate = [
  body('zone').optional().isIn(BOOTH_ZONES),
  body('rows').optional().isInt({ min: 1, max: 30 }).toInt(),
  body('cols').optional().isInt({ min: 1, max: 30 }).toInt(),
  body('size').optional().isIn(BOOTH_SIZES),
  body('price').optional().isFloat({ min: 0 }).toFloat(),
  body('startNumber').optional().isInt({ min: 1, max: 999 }).toInt(),
  body('startX').optional().isInt({ min: 0, max: 60 }).toInt(),
  body('startY').optional().isInt({ min: 0, max: 60 }).toInt(),
  body('namePrefix').optional({ values: 'falsy' }).isString().isLength({ max: 60 }),
];

const updateBooth = [
  body('number').optional().trim().isLength({ min: 1, max: 20 }),
  body('zone').optional().isIn(BOOTH_ZONES),
  body('size').optional().isIn(BOOTH_SIZES),
  body('price').optional().isFloat({ min: 0 }).toFloat(),
  body('status').optional().isIn(BOOTH_STATUS),
  body('featuredProducts').optional().isArray({ max: 20 }),
  body('featuredProducts.*').optional().isMongoId(),
  body('staff').optional().isArray({ max: 12 }),
  body('maintenanceNote').optional({ values: 'falsy' }).isString().isLength({ max: 300 }),
];

const updateStatus = [
  body('status').isIn(BOOTH_STATUS).withMessage(`Status must be one of ${BOOTH_STATUS.join(', ')}`),
  body('note').optional({ values: 'falsy' }).isString().isLength({ max: 300 }),
];

const assign = [
  body('exhibitorId').isMongoId().withMessage('Choose an exhibitor to assign this booth to'),
  body('applicationId').optional({ values: 'falsy' }).isMongoId(),
];

const floorPlan = [
  body('name').optional({ values: 'falsy' }).isString().isLength({ max: 140 }),
  body('gridCols').optional().isInt({ min: 4, max: 80 }).toInt(),
  body('gridRows').optional().isInt({ min: 4, max: 80 }).toInt(),
  body('width').optional().isInt({ min: 200, max: 5000 }).toInt(),
  body('height').optional().isInt({ min: 200, max: 5000 }).toInt(),
  body('zones').optional().isArray({ max: 12 }),
  body('zones.*.name').optional().trim().notEmpty().withMessage('Each zone needs a name'),
  body('amenities').optional().isArray({ max: 30 }),
  body('amenities.*.name').optional().trim().notEmpty().withMessage('Each amenity needs a name'),
  body('notes').optional({ values: 'falsy' }).isString().isLength({ max: 1000 }),
];

const trackVisit = [param('boothId').isMongoId(), body('source').optional().isIn(['floor_plan', 'directory', 'search', 'profile', 'qr', 'direct'])];

module.exports = { createBooth, bulkCreate, updateBooth, updateStatus, assign, floorPlan, trackVisit };

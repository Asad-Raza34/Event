'use strict';

const { body } = require('express-validator');
const { EXPO_STATUS, EXPO_CATEGORIES } = require('../models/Expo');
const { CATEGORIES } = require('../models/ExhibitorProfile');

const createExpo = [
  body('title').trim().notEmpty().withMessage('Expo title is required').isLength({ max: 160 }),
  body('description').trim().notEmpty().withMessage('Description is required').isLength({ max: 5000 }),
  body('summary').optional({ values: 'falsy' }).isString().isLength({ max: 300 }),
  body('theme').optional({ values: 'falsy' }).isString().isLength({ max: 160 }),
  body('category').optional().isIn(EXPO_CATEGORIES).withMessage('Unknown expo category'),
  body('startDate').isISO8601().withMessage('A valid start date is required').toDate(),
  body('endDate').isISO8601().withMessage('A valid end date is required').toDate(),
  body('registrationDeadline').optional({ values: 'falsy' }).isISO8601().toDate(),
  body('maxAttendees').optional().isInt({ min: 0, max: 1000000 }).toInt(),
  body('ticketPrice').optional().isFloat({ min: 0 }).toFloat(),
  body('boothPriceFrom').optional().isFloat({ min: 0 }).toFloat(),
  body('status').optional().isIn(EXPO_STATUS),
  body('location.city').optional({ values: 'falsy' }).isString().isLength({ max: 80 }),
  body('location.venue').optional({ values: 'falsy' }).isString().isLength({ max: 160 }),
  body('location.address').optional({ values: 'falsy' }).isString().isLength({ max: 240 }),
  body('tags').optional().isArray({ max: 20 }),
];

const updateExpo = [
  body('title').optional().trim().isLength({ min: 3, max: 160 }),
  body('description').optional().trim().isLength({ max: 5000 }),
  body('category').optional().isIn(EXPO_CATEGORIES),
  body('startDate').optional().isISO8601().toDate(),
  body('endDate').optional().isISO8601().toDate(),
  body('registrationDeadline').optional({ values: 'falsy' }).isISO8601().toDate(),
  body('maxAttendees').optional().isInt({ min: 0 }).toInt(),
  body('ticketPrice').optional().isFloat({ min: 0 }).toFloat(),
  body('isFeatured').optional().isBoolean().toBoolean(),
];

const updateStatus = [
  body('status').isIn(EXPO_STATUS).withMessage(`Status must be one of: ${EXPO_STATUS.join(', ')}`),
  body('reason').optional({ values: 'falsy' }).isString().isLength({ max: 500 }),
];

const exhibitorProfile = [
  body('companyName').optional().trim().isLength({ min: 2, max: 140 }).withMessage('Company name must be 2–140 characters'),
  body('tagline').optional({ values: 'falsy' }).isString().isLength({ max: 200 }),
  body('description').optional({ values: 'falsy' }).isString().isLength({ max: 4000 }),
  body('categories').optional().isArray({ max: 8 }).withMessage('Choose up to 8 categories'),
  body('categories.*').optional().isIn(CATEGORIES).withMessage('Unknown company category'),
  body('website').optional({ values: 'falsy' }).isURL().withMessage('Website must be a valid URL'),
  body('foundedYear').optional({ values: 'falsy' }).isInt({ min: 1800, max: 2100 }).toInt(),
  body('contact.email').optional({ values: 'falsy' }).isEmail().withMessage('Contact email must be valid'),
  body('contact.phone').optional({ values: 'falsy' }).isString().isLength({ max: 32 }),
  body('employeeCount').optional({ values: 'falsy' }).isString().isLength({ max: 40 }),
];

const applyToExpo = [
  body('expoId').isMongoId().withMessage('Choose an expo to apply to'),
  body('boothPreferences.size').optional({ values: 'falsy' }).isIn(['small', 'medium', 'large', 'premium', 'custom']),
  body('boothPreferences.zone').optional({ values: 'falsy' }).isString().isLength({ max: 8 }),
  body('boothPreferences.preferredBooth').optional({ values: 'falsy' }).isMongoId(),
  body('boothPreferences.notes').optional({ values: 'falsy' }).isString().isLength({ max: 1000 }),
  body('productsToShowcase').optional().isArray({ max: 30 }),
  body('specialRequests').optional({ values: 'falsy' }).isString().isLength({ max: 1500 }),
];

const reviewApplication = [
  body('status').isIn(['approved', 'rejected', 'under_review']).withMessage('Status must be approved, rejected or under_review'),
  body('reviewNote').optional({ values: 'falsy' }).isString().isLength({ max: 1000 }),
  body('boothId').optional({ values: 'falsy' }).isMongoId().withMessage('boothId must be a valid booth'),
];

const product = [
  body('name').trim().notEmpty().withMessage('Product name is required').isLength({ max: 160 }),
  body('description').optional({ values: 'falsy' }).isString().isLength({ max: 2000 }),
  body('category').optional({ values: 'falsy' }).isString().isLength({ max: 80 }),
  body('kind').optional().isIn(['product', 'service']),
  body('price').optional().isFloat({ min: 0 }).toFloat(),
  body('tags').optional().isArray({ max: 15 }),
  body('isFeatured').optional().isBoolean().toBoolean(),
  body('isActive').optional().isBoolean().toBoolean(),
];

const staff = [
  body('name').trim().notEmpty().withMessage('Staff name is required').isLength({ max: 80 }),
  body('role').optional({ values: 'falsy' }).isString().isLength({ max: 80 }),
  body('email').optional({ values: 'falsy' }).isEmail().withMessage('Staff email must be valid'),
  body('phone').optional({ values: 'falsy' }).isString().isLength({ max: 32 }),
];

module.exports = { createExpo, updateExpo, updateStatus, exhibitorProfile, applyToExpo, reviewApplication, product, staff };

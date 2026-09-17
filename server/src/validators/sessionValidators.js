'use strict';

const { body } = require('express-validator');
const { SESSION_TYPES, SESSION_STATUS, LEVELS } = require('../models/Session');
const { time } = require('./common');

const createSession = [
  body('expo').isMongoId().withMessage('Choose the expo for this session'),
  body('title').trim().notEmpty().withMessage('Session title is required').isLength({ max: 180 }),
  body('description').optional({ values: 'falsy' }).isString().isLength({ max: 4000 }),
  body('type').optional().isIn(SESSION_TYPES).withMessage(`Type must be one of ${SESSION_TYPES.join(', ')}`),
  body('category').optional({ values: 'falsy' }).isString().isLength({ max: 80 }),
  body('level').optional().isIn(LEVELS),
  body('date').isISO8601().withMessage('A valid session date is required').toDate(),
  time('startTime'),
  time('endTime'),
  body('speakers').optional().isArray({ max: 10 }),
  body('speakers.*').optional().isMongoId(),
  body('capacity').optional().isInt({ min: 1, max: 100000 }).toInt(),
  body('location.room').optional({ values: 'falsy' }).isString().isLength({ max: 120 }),
  body('location.hall').optional({ values: 'falsy' }).isString().isLength({ max: 120 }),
  body('status').optional().isIn(SESSION_STATUS),
  body('price').optional().isFloat({ min: 0 }).toFloat(),
  body('tags').optional().isArray({ max: 15 }),
];

const updateSession = [
  body('title').optional().trim().isLength({ min: 3, max: 180 }),
  body('description').optional({ values: 'falsy' }).isString().isLength({ max: 4000 }),
  body('type').optional().isIn(SESSION_TYPES),
  body('level').optional().isIn(LEVELS),
  body('date').optional().isISO8601().toDate(),
  time('startTime', { optional: true }),
  time('endTime', { optional: true }),
  body('speakers').optional().isArray({ max: 10 }),
  body('capacity').optional().isInt({ min: 1 }).toInt(),
  body('status').optional().isIn(SESSION_STATUS),
  body('location.room').optional({ values: 'falsy' }).isString().isLength({ max: 120 }),
  body('isFeatured').optional().isBoolean().toBoolean(),
];

const bookmark = [body('bookmarked').optional().isBoolean().toBoolean()];

const speaker = [
  body('name').trim().notEmpty().withMessage('Speaker name is required').isLength({ max: 120 }),
  body('title').optional({ values: 'falsy' }).isString().isLength({ max: 140 }),
  body('organization').optional({ values: 'falsy' }).isString().isLength({ max: 140 }),
  body('bio').optional({ values: 'falsy' }).isString().isLength({ max: 2500 }),
  body('email').optional({ values: 'falsy' }).isEmail().withMessage('Speaker email must be valid'),
  body('expertise').optional().isArray({ max: 12 }),
  body('isFeatured').optional().isBoolean().toBoolean(),
];

const registerForExpo = [
  body('fullName').optional({ values: 'falsy' }).isString().isLength({ max: 120 }),
  body('email').optional({ values: 'falsy' }).isEmail().withMessage('Email must be valid'),
  body('phone').optional({ values: 'falsy' }).isString().isLength({ max: 32 }),
  body('organization').optional({ values: 'falsy' }).isString().isLength({ max: 120 }),
  body('jobTitle').optional({ values: 'falsy' }).isString().isLength({ max: 120 }),
  body('country').optional({ values: 'falsy' }).isString().isLength({ max: 80 }),
  body('dietaryRequirements').optional({ values: 'falsy' }).isString().isLength({ max: 240 }),
  body('accessibilityNeeds').optional({ values: 'falsy' }).isString().isLength({ max: 240 }),
  body('passType').optional().isIn(['standard', 'vip', 'exhibitor_staff', 'speaker']),
  body('interests').optional().isArray({ max: 20 }),
];

const checkIn = [
  body('code').trim().notEmpty().withMessage('Scan or type a pass code').isLength({ max: 300 }),
  body('type').optional().isIn(['event', 'booth', 'session']),
  body('expoId').optional({ values: 'falsy' }).isMongoId(),
  body('boothId').optional({ values: 'falsy' }).isMongoId(),
  body('sessionId').optional({ values: 'falsy' }).isMongoId(),
  body('method').optional().isIn(['qr', 'manual', 'badge']),
  body('device').optional({ values: 'falsy' }).isString().isLength({ max: 120 }),
];

module.exports = { createSession, updateSession, bookmark, speaker, registerForExpo, checkIn };

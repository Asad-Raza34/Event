'use strict';

const { body, query } = require('express-validator');
const { time } = require('./common');

const createSlots = [
  body('expo').isMongoId().withMessage('Choose the expo for these slots'),
  body('dates').optional().isArray({ min: 1, max: 15 }).withMessage('Provide between 1 and 15 dates'),
  body('date').optional({ values: 'falsy' }).isISO8601().toDate(),
  time('startTime'),
  time('endTime'),
  body('durationMinutes').optional().isInt({ min: 10, max: 240 }).toInt(),
  body('location').optional({ values: 'falsy' }).isString().isLength({ max: 200 }),
  body('meetingLink').optional({ values: 'falsy' }).isString().isLength({ max: 300 }),
  body('note').optional({ values: 'falsy' }).isString().isLength({ max: 500 }),
];

const updateSlot = [
  time('startTime', { optional: true }),
  time('endTime', { optional: true }),
  body('durationMinutes').optional().isInt({ min: 10, max: 240 }).toInt(),
  body('status').optional().isIn(['open', 'booked', 'blocked']),
  body('location').optional({ values: 'falsy' }).isString().isLength({ max: 200 }),
];

const requestAppointment = [
  body('slotId').isMongoId().withMessage('Choose an available time slot'),
  body('topic').trim().notEmpty().withMessage('Tell the exhibitor what you want to discuss').isLength({ max: 200 }),
  body('agenda').optional({ values: 'falsy' }).isString().isLength({ max: 1500 }),
  body('attendeeCount').optional().isInt({ min: 1, max: 20 }).toInt(),
];

const respondAppointment = [
  body('status').isIn(['confirmed', 'rejected', 'completed']).withMessage('Status must be confirmed, rejected or completed'),
  body('note').optional({ values: 'falsy' }).isString().isLength({ max: 600 }),
  body('meetingLink').optional({ values: 'falsy' }).isString().isLength({ max: 300 }),
];

const startConversation = [
  body('participantId').isMongoId().withMessage('Choose someone to chat with'),
  body('message').optional({ values: 'falsy' }).isString().isLength({ max: 4000 }),
  body('expoId').optional({ values: 'falsy' }).isMongoId(),
  body('exhibitorId').optional({ values: 'falsy' }).isMongoId(),
];

const sendMessage = [
  body('body').optional({ values: 'falsy' }).isString().isLength({ max: 4000 }),
  body('attachments').optional().isArray({ max: 5 }),
];

const createCharge = [
  body('purpose').isIn(['booth_booking', 'event_ticket', 'session', 'expo_registration', 'other']).withMessage('Choose a valid payment purpose'),
  body('amount').isFloat({ gt: 0 }).withMessage('Amount must be greater than zero').toFloat(),
  body('description').optional({ values: 'falsy' }).isString().isLength({ max: 300 }),
  body('related').optional().isObject(),
  body('provider').optional().isIn(['mock', 'stripe']),
];

const refund = [body('reason').optional({ values: 'falsy' }).isString().isLength({ max: 400 })];

const createReview = [
  body('targetType').optional().isIn(['exhibitor', 'session']),
  body('targetId').isMongoId().withMessage('Choose what you are reviewing'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5').toInt(),
  body('title').optional({ values: 'falsy' }).isString().isLength({ max: 140 }),
  body('comment').optional({ values: 'falsy' }).isString().isLength({ max: 2000 }),
];

const replyReview = [body('body').trim().notEmpty().withMessage('Write a reply').isLength({ max: 1500 })];

const moderateReview = [body('status').isIn(['published', 'hidden', 'flagged']).withMessage('Invalid moderation status')];

const createFeedback = [
  body('subject').trim().notEmpty().withMessage('Subject is required').isLength({ max: 180 }),
  body('message').trim().notEmpty().withMessage('Message is required').isLength({ max: 3000 }),
  body('category').optional().isIn(['general', 'session', 'exhibitor', 'venue', 'app', 'website', 'payment', 'accessibility']),
  body('rating').optional({ values: 'falsy' }).isInt({ min: 1, max: 5 }).toInt(),
  body('expo').optional({ values: 'falsy' }).isMongoId(),
  body('session').optional({ values: 'falsy' }).isMongoId(),
  body('isAnonymous').optional().isBoolean().toBoolean(),
  body('name').optional({ values: 'falsy' }).isString().isLength({ max: 120 }),
  body('email').optional({ values: 'falsy' }).isEmail().withMessage('Email must be valid'),
];

const respondFeedback = [
  body('response').optional({ values: 'falsy' }).isString().isLength({ max: 2000 }),
  body('status').optional().isIn(['new', 'reviewed', 'resolved', 'archived']),
];

const createTicket = [
  body('subject').trim().notEmpty().withMessage('Subject is required').isLength({ max: 200 }),
  body('description').trim().notEmpty().withMessage('Describe the issue').isLength({ max: 4000 }),
  body('category').optional().isIn(['technical', 'payment', 'registration', 'booth', 'account', 'exhibitor', 'other']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('relatedExpo').optional({ values: 'falsy' }).isMongoId(),
  body('attachments').optional().isArray({ max: 5 }),
];

const ticketMessage = [body('body').trim().notEmpty().withMessage('Write a reply').isLength({ max: 3000 })];

const updateTicket = [
  body('status').optional().isIn(['open', 'in_progress', 'resolved', 'closed']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('assignedTo').optional({ values: 'falsy' }).isMongoId(),
  body('note').optional({ values: 'falsy' }).isString().isLength({ max: 600 }),
  body('satisfactionRating').optional({ values: 'falsy' }).isInt({ min: 1, max: 5 }).toInt(),
];

const createAnnouncement = [
  body('expo').isMongoId().withMessage('Choose the expo for this announcement'),
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 200 }),
  body('body').trim().notEmpty().withMessage('Message is required').isLength({ max: 3000 }),
  body('audience').optional().isIn(['all', 'attendees', 'exhibitors', 'speakers']),
  body('priority').optional().isIn(['normal', 'high', 'urgent']),
  body('pinned').optional().isBoolean().toBoolean(),
  body('channel').optional().isIn(['in_app', 'email', 'both']),
  body('expiresAt').optional({ values: 'falsy' }).isISO8601().toDate(),
];

const aiChat = [
  body('message').trim().notEmpty().withMessage('Type a question for the assistant').isLength({ max: 600 }),
  body('expoId').optional({ values: 'falsy' }).isMongoId(),
  body('history').optional().isArray({ max: 12 }),
];

const globalSearch = [query('q').trim().isLength({ min: 2, max: 120 }).withMessage('Enter at least two characters')];

module.exports = {
  createSlots,
  updateSlot,
  requestAppointment,
  respondAppointment,
  startConversation,
  sendMessage,
  createCharge,
  refund,
  createReview,
  replyReview,
  moderateReview,
  createFeedback,
  respondFeedback,
  createTicket,
  ticketMessage,
  updateTicket,
  createAnnouncement,
  aiChat,
  globalSearch,
};

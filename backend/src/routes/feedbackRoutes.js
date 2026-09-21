'use strict';

const express = require('express');
const controller = require('../controllers/feedbackController');
const validate = require('../middleware/validate');
const { protect, optionalAuth } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { pagination } = require('../validators/common');
const { createFeedback, respondFeedback } = require('../validators/engagementValidators');

const router = express.Router();

// Anyone (signed in or not) can submit feedback; only organizers can triage it.
router.post('/', optionalAuth, validate(createFeedback), controller.createFeedback);
router.get('/', protect, authorize('admin'), validate(pagination()), controller.listFeedback);
router.get('/me', protect, validate(pagination()), controller.myFeedback);
router.get('/stats', protect, authorize('admin'), controller.feedbackStats);
router.patch('/:id', protect, authorize('admin'), validate(respondFeedback), controller.respondToFeedback);

module.exports = router;

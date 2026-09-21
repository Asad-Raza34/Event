'use strict';

const express = require('express');
const controller = require('../controllers/sessionController');
const validate = require('../middleware/validate');
const { protect, optionalAuth } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { pagination } = require('../validators/common');
const { createSession, updateSession, bookmark } = require('../validators/sessionValidators');

const router = express.Router();

// Public schedule browsing
router.get('/', validate(pagination()), controller.list);
router.get('/agenda/me', protect, validate(pagination()), controller.myAgenda);
router.get('/:id', optionalAuth, controller.detail);
router.get('/:id/reviews', validate(pagination()), controller.rating);
router.get('/:id/qr', protect, controller.sessionQr);

// Attendee actions (reviews for sessions are created through POST /reviews)
router.post('/:id/register', protect, controller.register);
router.delete('/:id/register', protect, controller.unregister);
router.post('/:id/bookmark', protect, validate(bookmark), controller.bookmark);

// Organizer management
router.post('/', protect, authorize('admin'), validate(createSession), controller.create);
router.patch('/:id', protect, authorize('admin'), validate(updateSession), controller.update);
router.post('/:id/cancel', protect, authorize('admin'), controller.cancel);
router.delete('/:id', protect, authorize('admin'), controller.remove);

module.exports = router;

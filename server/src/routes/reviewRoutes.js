'use strict';

const express = require('express');
const controller = require('../controllers/reviewController');
const validate = require('../middleware/validate');
const { protect, optionalAuth } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { pagination } = require('../validators/common');
const { createReview, replyReview, moderateReview } = require('../validators/engagementValidators');

const router = express.Router();

router.get('/', validate(pagination()), controller.list);
router.get('/me', protect, validate(pagination()), controller.mine);
router.get('/summary/:targetId', controller.summary);
router.post('/', protect, validate(createReview), controller.create);
router.patch('/:id', protect, controller.update);
router.delete('/:id', protect, controller.remove);
router.post('/:id/replies', protect, validate(replyReview), controller.reply);
router.patch('/:id/moderate', protect, authorize('admin'), validate(moderateReview), controller.moderate);

module.exports = router;

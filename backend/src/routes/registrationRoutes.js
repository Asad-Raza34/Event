'use strict';

const express = require('express');
const controller = require('../controllers/registrationController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { pagination } = require('../validators/common');

const router = express.Router();

router.use(protect);

// Static paths come first so they are never parsed as an id
router.get('/me', validate(pagination()), controller.myRegistrations);
router.get('/me/activity', controller.activity);
router.get('/pass', controller.myPass);
router.get('/pass/:id', controller.myPass);

// Organizer
router.get('/', authorize('admin'), validate(pagination()), controller.list);

router.get('/:id', controller.detail);
router.patch('/:id/cancel', controller.cancel);

module.exports = router;

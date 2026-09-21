'use strict';

const express = require('express');
const controller = require('../controllers/userController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { uploaders } = require('../middleware/upload');
const { pagination } = require('../validators/common');
const { updateProfile, notificationPreferences, adminUpdateUser } = require('../validators/authValidators');

const router = express.Router();

router.use(protect);

// Self-service
router.get('/me', controller.getProfile);
router.patch('/me', validate(updateProfile), controller.updateProfile);
router.patch('/me/notification-preferences', validate(notificationPreferences), controller.updatePreferences);
router.post('/me/avatar', uploaders.avatars.single('avatar'), controller.uploadAvatar);

// Organizer
router.get('/', authorize('admin'), validate(pagination()), controller.listUsers);
router.get('/stats', authorize('admin'), controller.stats);
router.get('/:id', authorize('admin'), controller.getUser);
router.patch('/:id', authorize('admin'), validate(adminUpdateUser), controller.updateUser);
router.patch('/:id/status', authorize('admin'), controller.setActive);

module.exports = router;

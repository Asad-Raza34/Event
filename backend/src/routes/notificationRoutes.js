'use strict';

const express = require('express');
const controller = require('../controllers/notificationController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { pagination } = require('../validators/common');

const router = express.Router();

router.use(protect);

router.get('/', validate(pagination()), controller.list);
router.get('/unread-count', controller.unreadCount);
router.patch('/read', controller.markRead);
router.patch('/read-all', controller.markAllRead);
router.delete('/read', controller.clearRead);
router.delete('/:id', controller.remove);

module.exports = router;

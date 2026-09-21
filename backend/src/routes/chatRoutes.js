'use strict';

const express = require('express');
const controller = require('../controllers/chatController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { pagination } = require('../validators/common');
const { startConversation, sendMessage } = require('../validators/engagementValidators');

const router = express.Router();

router.use(protect);

router.get('/', validate(pagination()), controller.list);
router.get('/unread', controller.unread);
router.get('/contacts', controller.contacts);
router.get('/search', controller.search);
router.post('/', validate(startConversation), controller.startConversation);
router.post('/with-exhibitor/:exhibitorId', validate(startConversation), controller.startWithExhibitor);
router.get('/:id', controller.detail);
router.post('/:id/messages', validate(sendMessage), controller.send);
router.patch('/:id/read', controller.markRead);
router.patch('/:id/archive', controller.archive);
router.delete('/messages/:messageId', controller.removeMessage);

module.exports = router;

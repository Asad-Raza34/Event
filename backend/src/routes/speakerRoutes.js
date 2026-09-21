'use strict';

const express = require('express');
const controller = require('../controllers/sessionController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { pagination } = require('../validators/common');
const { speaker } = require('../validators/sessionValidators');

const router = express.Router();

router.get('/', validate(pagination()), controller.listSpeakers);
router.get('/me/sessions', protect, controller.mySpeakerSessions);
router.post('/', protect, authorize('admin'), validate(speaker), controller.createSpeaker);
router.patch('/:id', protect, authorize('admin'), controller.updateSpeaker);
router.delete('/:id', protect, authorize('admin'), controller.removeSpeaker);

module.exports = router;

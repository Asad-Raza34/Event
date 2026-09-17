'use strict';

const express = require('express');
const controller = require('../controllers/registrationController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { pagination } = require('../validators/common');
const { checkIn } = require('../validators/sessionValidators');

const router = express.Router();

router.use(protect);

/** Scanners are used by organizers and exhibitor staff at booths. */
router.post('/', authorize('admin', 'exhibitor'), validate(checkIn), controller.checkIn);
router.get('/', authorize('admin'), validate(pagination()), controller.checkInHistory);
router.get('/me', controller.activity);

module.exports = router;

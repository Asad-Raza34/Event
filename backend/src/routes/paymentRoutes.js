'use strict';

const express = require('express');
const controller = require('../controllers/paymentController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { pagination } = require('../validators/common');
const { createCharge, refund } = require('../validators/engagementValidators');

const router = express.Router();

/** Provider webhooks are unauthenticated but signature-verified. */
router.post('/webhook/:provider', controller.webhook);

router.use(protect);

router.get('/', authorize('admin'), validate(pagination()), controller.list);
router.get('/me', validate(pagination()), controller.mine);
router.get('/stats', authorize('admin'), controller.stats);
router.post('/checkout', validate(createCharge), controller.create);
router.get('/:id', controller.detail);
router.get('/:id/invoice', controller.invoice);
router.post('/:id/confirm', controller.confirm);
router.post('/:id/fail', authorize('admin'), controller.fail);
router.post('/:id/cancel', controller.cancel);
router.post('/:id/refund', authorize('admin'), validate(refund), controller.refund);

module.exports = router;

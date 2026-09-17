'use strict';

const express = require('express');
const controller = require('../controllers/appointmentController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { pagination } = require('../validators/common');
const { createSlots, updateSlot, requestAppointment, respondAppointment } = require('../validators/engagementValidators');

/** /appointments — the booking lifecycle. */
const router = express.Router();
router.use(protect);

router.get('/calendar', controller.calendar);
router.get('/stats', authorize('admin'), controller.stats);
router.get('/', validate(pagination()), controller.list);
router.post('/', authorize('attendee', 'admin'), validate(requestAppointment), controller.request);
router.get('/:id', controller.detail);
router.patch('/:id/respond', authorize('exhibitor', 'admin'), validate(respondAppointment), controller.respond);
router.patch('/:id/cancel', controller.cancel);
router.patch('/:id/complete', controller.complete);

/** /availability-slots — exhibitor published meeting windows. */
const slots = express.Router();

slots.get('/', validate(pagination()), controller.listSlots);
slots.use(protect);
slots.post('/', authorize('exhibitor'), validate(createSlots), controller.createSlots);
slots.patch('/:id', authorize('exhibitor', 'admin'), validate(updateSlot), controller.updateSlot);
slots.delete('/:id', authorize('exhibitor', 'admin'), controller.removeSlot);

module.exports = router;
module.exports.slotRoutes = slots;

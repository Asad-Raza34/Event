'use strict';

const express = require('express');
const controller = require('../controllers/boothController');
const floorPlanController = require('../controllers/floorPlanController');
const validate = require('../middleware/validate');
const { protect, optionalAuth } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { pagination } = require('../validators/common');
const { createBooth, updateBooth, updateStatus, assign, trackVisit } = require('../validators/boothValidators');

const router = express.Router();

// Public: booth details power the public floor plan and directory
router.get('/', validate(pagination()), controller.list);
router.get('/pending', protect, authorize('admin'), controller.pending);
router.get('/find', controller.findByNumber);
router.get('/:id', optionalAuth, controller.detail);
router.get('/:id/qr', protect, controller.boothQr);
router.post('/:boothId/visit', optionalAuth, validate(trackVisit), floorPlanController.trackVisit);

// Exhibitor
router.post('/:id/request', protect, authorize('exhibitor'), controller.requestReservation);

// Organizer
router.post('/', protect, authorize('admin'), validate(createBooth), controller.create);
router.patch('/:id', protect, validate(updateBooth), controller.update);
router.patch('/:id/status', protect, authorize('admin'), validate(updateStatus), controller.updateStatus);
router.delete('/:id', protect, authorize('admin'), controller.remove);
router.post('/:id/approve', protect, authorize('admin'), controller.approveReservation);
router.post('/:id/reject', protect, authorize('admin'), controller.rejectReservation);
router.post('/:id/assign', protect, authorize('admin'), validate(assign), controller.assign);
router.post('/:id/release', protect, controller.release);

module.exports = router;

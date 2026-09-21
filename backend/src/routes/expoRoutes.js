'use strict';

const express = require('express');
const controller = require('../controllers/expoController');
const boothController = require('../controllers/boothController');
const sessionController = require('../controllers/sessionController');
const floorPlanController = require('../controllers/floorPlanController');
const announcementController = require('../controllers/announcementController');
const registrationController = require('../controllers/registrationController');
const validate = require('../middleware/validate');
const { protect, optionalAuth } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { pagination } = require('../validators/common');
const { createExpo, updateExpo, updateStatus } = require('../validators/expoValidators');
const { floorPlan } = require('../validators/boothValidators');
const { createAnnouncement } = require('../validators/engagementValidators');
const { registerForExpo } = require('../validators/sessionValidators');

const router = express.Router();

// Public browsing
router.get('/', optionalAuth, validate(pagination()), controller.list);
router.get('/:id', optionalAuth, controller.detail);
router.get('/:expoId/sessions', validate(pagination()), sessionController.schedule);
router.get('/:expoId/floor-plan', optionalAuth, floorPlanController.getLayout);
router.get('/:expoId/booths', validate(pagination()), boothController.list);
router.get('/:expoId/occupancy', boothController.occupancy);
router.get('/:expoId/announcements', validate(pagination()), announcementController.list);
router.get('/:expoId/session-popularity', sessionController.popularity);

// Organizer management
router.post('/', protect, authorize('admin'), validate(createExpo), controller.create);
router.patch('/:id', protect, authorize('admin'), validate(updateExpo), controller.update);
router.patch('/:id/status', protect, authorize('admin'), validate(updateStatus), controller.updateStatus);
router.post('/:id/publish', protect, authorize('admin'), controller.publish);
router.post('/:id/refresh-stats', protect, authorize('admin'), controller.refreshStats);
router.delete('/:id', protect, authorize('admin'), controller.remove);
router.get('/:id/analytics', protect, authorize('admin'), controller.analytics);

router.put('/:expoId/floor-plan', protect, authorize('admin'), validate(floorPlan), floorPlanController.updatePlan);
router.post('/:expoId/booths/bulk', protect, authorize('admin'), boothController.bulkCreate);

router.post('/:expoId/announcements', protect, authorize('admin'), validate(createAnnouncement), announcementController.create);
router.patch('/announcements/:id', protect, authorize('admin'), announcementController.update);
router.delete('/announcements/:id', protect, authorize('admin'), announcementController.remove);

// Attendee registration for an expo
router.post('/:expoId/register', protect, validate(registerForExpo), registrationController.register);

module.exports = router;

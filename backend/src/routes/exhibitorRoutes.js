'use strict';

const express = require('express');
const controller = require('../controllers/exhibitorController');
const appointmentController = require('../controllers/appointmentController');
const reviewController = require('../controllers/reviewController');
const analyticsController = require('../controllers/analyticsController');
const validate = require('../middleware/validate');
const { protect, optionalAuth } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { uploaders } = require('../middleware/upload');
const { pagination } = require('../validators/common');
const { exhibitorProfile, applyToExpo, reviewApplication, product, staff } = require('../validators/expoValidators');

const router = express.Router();

// ---- Public directory ---------------------------------------------------
router.get('/', validate(pagination()), controller.directory);
router.get('/products', validate(pagination()), controller.listProducts);
router.get('/:id', optionalAuth, controller.profile);
router.get('/:id/reviews', validate(pagination()), reviewController.list);
router.get('/:id/rating-summary', reviewController.summary);
router.get('/:id/available-slots', appointmentController.listSlots);

// ---- Exhibitor workspace (own account) ----------------------------------
router.use(protect);

router.get('/me/workspace', authorize('exhibitor'), controller.getMyProfile);
router.patch('/me/profile', authorize('exhibitor'), validate(exhibitorProfile), controller.updateProfile);
router.post('/me/logo', authorize('exhibitor'), uploaders.logos.single('logo'), controller.uploadLogo);
router.post('/me/banner', authorize('exhibitor'), uploaders.banners.single('banner'), controller.uploadBanner);

router.get('/me/products', authorize('exhibitor'), validate(pagination()), controller.myProducts);
router.post('/me/products', authorize('exhibitor'), validate(product), controller.createProduct);
router.patch('/me/products/:id', authorize('exhibitor'), controller.updateProduct);
router.delete('/me/products/:id', authorize('exhibitor'), controller.removeProduct);

router.post('/me/staff', authorize('exhibitor'), validate(staff), controller.addStaff);
router.patch('/me/staff/:staffId', authorize('exhibitor'), controller.updateStaff);
router.delete('/me/staff/:staffId', authorize('exhibitor'), controller.removeStaff);

router.post('/me/documents', authorize('exhibitor'), uploaders.documents.single('file'), controller.addDocument);
router.delete('/me/documents/:documentId', authorize('exhibitor'), controller.removeDocument);

router.post('/me/applications', authorize('exhibitor'), validate(applyToExpo), controller.apply);
router.get('/me/applications', authorize('exhibitor'), validate(pagination()), controller.myApplications);
router.delete('/me/applications/:id', authorize('exhibitor'), controller.withdraw);
router.get('/me/expos', authorize('exhibitor'), controller.myExpos);
router.get('/me/analytics', authorize('exhibitor'), analyticsController.exhibitorOverview);

// ---- Organizer management of exhibitors ---------------------------------
router.get('/admin/applications', authorize('admin'), validate(pagination()), controller.listApplications);
router.patch('/admin/applications/:id', authorize('admin'), validate(reviewApplication), controller.reviewApplication);
router.patch('/admin/:id/verification', authorize('admin'), controller.updateVerification);
router.patch('/admin/:id/documents/:documentId', authorize('admin'), controller.reviewDocument);

module.exports = router;

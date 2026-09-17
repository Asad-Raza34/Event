'use strict';

const express = require('express');
const analyticsController = require('../controllers/analyticsController');
const aiController = require('../controllers/aiController');
const searchController = require('../controllers/searchController');
const uploadController = require('../controllers/uploadController');
const validation = require('../middleware/validate');
const { protect, optionalAuth } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { aiLimiter } = require('../middleware/rateLimit');
const { uploaders } = require('../middleware/upload');
const { aiChat, globalSearch } = require('../validators/engagementValidators');

const analytics = express.Router();
analytics.get('/admin', protect, authorize('admin'), analyticsController.adminOverview);
analytics.get('/exhibitor', protect, authorize('exhibitor'), analyticsController.exhibitorOverview);
analytics.get('/feedback', protect, authorize('admin'), analyticsController.feedbackStats);
analytics.get('/tickets', protect, authorize('admin'), analyticsController.ticketStats);

const ai = express.Router();
ai.get('/capabilities', aiController.capabilities);
ai.get('/history', protect, aiController.history);
ai.delete('/history', protect, aiController.clearHistory);
ai.post('/chat', aiLimiter, optionalAuth, validation(aiChat), aiController.chat);

const search = express.Router();
search.get('/', optionalAuth, validation(globalSearch), searchController.search);

const uploads = express.Router();
uploads.use(protect);
uploads.get('/limits', uploadController.limits);
uploads.post('/image', uploaders.banners.single('file'), uploadController.single);
uploads.post('/document', uploaders.documents.single('file'), uploadController.single);
uploads.post('/chat', uploaders.chat.array('files', 5), uploadController.multiple);

module.exports = { analyticsRoutes: analytics, aiRoutes: ai, searchRoutes: search, uploadRoutes: uploads };

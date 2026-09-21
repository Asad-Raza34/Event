'use strict';

const express = require('express');
const mongoose = require('mongoose');
const config = require('../config');
const { sendSuccess } = require('../utils/apiResponse');
const { isInMemory } = require('../config/db');
const { getIO } = require('../sockets/emitter');
const { availableProviders } = require('../services/payments');

const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const expoRoutes = require('./expoRoutes');
const exhibitorRoutes = require('./exhibitorRoutes');
const boothRoutes = require('./boothRoutes');
const sessionRoutes = require('./sessionRoutes');
const speakerRoutes = require('./speakerRoutes');
const registrationRoutes = require('./registrationRoutes');
const checkInRoutes = require('./checkInRoutes');
const appointmentRoutes = require('./appointmentRoutes');
const chatRoutes = require('./chatRoutes');
const notificationRoutes = require('./notificationRoutes');
const paymentRoutes = require('./paymentRoutes');
const reviewRoutes = require('./reviewRoutes');
const feedbackRoutes = require('./feedbackRoutes');
const ticketRoutes = require('./ticketRoutes');
const { analyticsRoutes, aiRoutes, searchRoutes, uploadRoutes } = require('./miscRoutes');

const router = express.Router();
const DB_STATES = ['disconnected', 'connected', 'connecting', 'disconnecting'];

router.get('/health', (_req, res) =>
  sendSuccess(res, {
    message: 'EventSphere API is healthy',
    data: {
      uptimeSeconds: Math.round(process.uptime()),
      environment: config.env,
      database: DB_STATES[mongoose.connection.readyState] || 'unknown',
      databaseMode: isInMemory() ? 'in-memory (development)' : 'external',
      paymentProvider: config.payments.provider,
      paymentProviders: availableProviders,
      aiProvider: config.ai.provider,
      realtime: Boolean(getIO()),
      timestamp: new Date().toISOString(),
    },
  }),
);

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/expos', expoRoutes);
router.use('/exhibitors', exhibitorRoutes);
router.use('/booths', boothRoutes);
router.use('/sessions', sessionRoutes);
router.use('/speakers', speakerRoutes);
router.use('/registrations', registrationRoutes);
router.use('/check-ins', checkInRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/availability-slots', appointmentRoutes.slotRoutes);
router.use('/conversations', chatRoutes);
router.use('/notifications', notificationRoutes);
router.use('/payments', paymentRoutes);
router.use('/reviews', reviewRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/tickets', ticketRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/ai', aiRoutes);
router.use('/search', searchRoutes);
router.use('/uploads', uploadRoutes);

module.exports = router;

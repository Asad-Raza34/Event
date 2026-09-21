'use strict';

const express = require('express');
const controller = require('../controllers/feedbackController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authorize } = require('../middleware/authorize');
const { pagination } = require('../validators/common');
const { createTicket, ticketMessage, updateTicket } = require('../validators/engagementValidators');

const router = express.Router();

router.use(protect);

router.post('/', validate(createTicket), controller.createTicket);
router.get('/', validate(pagination()), controller.listTickets);
router.get('/stats', authorize('admin'), controller.ticketStats);
router.get('/:id', controller.getTicket);
router.post('/:id/messages', validate(ticketMessage), controller.addTicketMessage);
router.patch('/:id', authorize('admin'), validate(updateTicket), controller.updateTicket);

module.exports = router;

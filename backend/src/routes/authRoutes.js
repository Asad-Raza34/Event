'use strict';

const express = require('express');
const controller = require('../controllers/authController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { register, login, forgotPassword, resetPassword, changePassword } = require('../validators/authValidators');

const router = express.Router();

router.post('/register', authLimiter, validate(register), controller.register);
router.post('/login', authLimiter, validate(login), controller.login);
router.post('/refresh', controller.refresh);
router.post('/logout', protect, controller.logout);
router.post('/logout-all', protect, controller.logoutAll);
router.post('/forgot-password', authLimiter, validate(forgotPassword), controller.forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPassword), controller.resetPassword);
router.post('/change-password', protect, validate(changePassword), controller.changePassword);
router.get('/me', protect, controller.me);

module.exports = router;

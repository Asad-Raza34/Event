'use strict';

const express = require('express');
const controller = require('../controllers/authController');
const validate = require('../middleware/validate');
const { protect } = require('../middleware/auth');
const { authLimiter, otpLimiter } = require('../middleware/rateLimit');
const {
  register,
  login,
  loginVerifyCode,
  loginResendCode,
  passkeyRegisterVerify,
  passkeyLoginVerify,
  forgotPassword,
  resetPassword,
  changePassword,
} = require('../validators/authValidators');

const router = express.Router();

router.post('/register', authLimiter, validate(register), controller.register);
// Step 1: e-mail + password → temporary challenge, no session yet.
router.post('/login', authLimiter, validate(login), controller.login);
// Step 2: the second factor (e-mail code). Only here is the session issued.
router.post('/login/verify-code', otpLimiter, validate(loginVerifyCode), controller.verifyLoginCode);
router.post('/login/resend-code', otpLimiter, validate(loginResendCode), controller.resendLoginCode);
router.post('/login/challenge', otpLimiter, validate(loginResendCode), controller.loginChallengeStatus);
// Mobile second factor: device biometrics via WebAuthn/passkeys.
router.post('/login/passkey/options', otpLimiter, validate(loginResendCode), controller.passkeyLoginOptions);
router.post('/login/passkey/verify', otpLimiter, validate(passkeyLoginVerify), controller.passkeyLoginVerify);
// Passkey management (authenticated users only).
router.get('/passkeys', protect, controller.passkeyList);
router.post('/passkeys/options', protect, controller.passkeyRegisterOptions);
router.post('/passkeys', protect, validate(passkeyRegisterVerify), controller.passkeyRegisterVerify);
router.delete('/passkeys/:id', protect, controller.passkeyRemove);
router.post('/refresh', controller.refresh);
router.post('/logout', protect, controller.logout);
router.post('/logout-all', protect, controller.logoutAll);
router.post('/forgot-password', authLimiter, validate(forgotPassword), controller.forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPassword), controller.resetPassword);
router.post('/change-password', protect, validate(changePassword), controller.changePassword);
router.get('/me', protect, controller.me);

module.exports = router;

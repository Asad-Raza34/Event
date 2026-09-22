'use strict';

const { body } = require('express-validator');

const passwordRule = (field = 'password') =>
  body(field)
    .isString()
    .isLength({ min: 8, max: 128 })
    .withMessage('Password must be between 8 and 128 characters')
    .matches(/[a-zA-Z]/)
    .withMessage('Password must contain at least one letter')
    .matches(/\d/)
    .withMessage('Password must contain at least one number');

const register = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2, max: 80 }).withMessage('Name must be 2–80 characters'),
  body('email').trim().isEmail().withMessage('Please enter a valid email address').normalizeEmail(),
  passwordRule('password'),
  body('role').optional().isIn(['attendee', 'exhibitor', 'admin']).withMessage('Role must be attendee, exhibitor or admin'),
  body('phone').optional({ values: 'falsy' }).isString().isLength({ max: 32 }).withMessage('Phone number is too long'),
  body('organization').optional({ values: 'falsy' }).isString().isLength({ max: 120 }),
  body('jobTitle').optional({ values: 'falsy' }).isString().isLength({ max: 120 }),
  body('city').optional({ values: 'falsy' }).isString().isLength({ max: 80 }),
  body('country').optional({ values: 'falsy' }).isString().isLength({ max: 80 }),
  body('adminInviteCode').optional({ values: 'falsy' }).isString(),
];

const login = [
  body('email').trim().isEmail().withMessage('Please enter a valid email address').normalizeEmail(),
  body('password').isString().notEmpty().withMessage('Password is required'),
];

const loginVerifyCode = [
  body('challengeToken').isString().isLength({ min: 32, max: 128 }).withMessage('Your sign-in session is invalid. Please sign in again.'),
  body('code').isString().trim().isLength({ min: 4, max: 8 }).withMessage('Please enter the verification code from your e-mail'),
];

const loginResendCode = [
  body('challengeToken').isString().isLength({ min: 32, max: 128 }).withMessage('Your sign-in session is invalid. Please sign in again.'),
];

const passkeyRegisterVerify = [
  body('response').isObject().withMessage('A passkey registration response is required'),
  body('deviceName').optional({ values: 'falsy' }).isString().isLength({ max: 80 }),
  body('attachment').optional({ values: 'falsy' }).isString().isLength({ max: 40 }),
];

const passkeyLoginVerify = [
  body('challengeToken').isString().isLength({ min: 32, max: 128 }).withMessage('Your sign-in session is invalid. Please sign in again.'),
  body('response').isObject().withMessage('A passkey response is required'),
];

const forgotPassword = [body('email').trim().isEmail().withMessage('Please enter a valid email address').normalizeEmail()];

const resetPassword = [
  body('token').isString().isLength({ min: 16 }).withMessage('A valid reset token is required'),
  body('email').optional({ values: 'falsy' }).trim().isEmail().withMessage('Please enter a valid email address'),
  passwordRule('password'),
];

const changePassword = [
  body('currentPassword').isString().notEmpty().withMessage('Your current password is required'),
  passwordRule('newPassword'),
];

const updateProfile = [
  body('name').optional().trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2–80 characters'),
  body('phone').optional({ values: 'falsy' }).isString().isLength({ max: 32 }),
  body('bio').optional({ values: 'falsy' }).isString().isLength({ max: 600 }).withMessage('Bio must be at most 600 characters'),
  body('organization').optional({ values: 'falsy' }).isString().isLength({ max: 120 }),
  body('jobTitle').optional({ values: 'falsy' }).isString().isLength({ max: 120 }),
  body('city').optional({ values: 'falsy' }).isString().isLength({ max: 80 }),
  body('country').optional({ values: 'falsy' }).isString().isLength({ max: 80 }),
  body('interests').optional().isArray({ max: 20 }).withMessage('Interests must be a list'),
];

const notificationPreferences = [
  body('email').optional().isBoolean().toBoolean(),
  body('inApp').optional().isBoolean().toBoolean(),
  body('chat').optional().isBoolean().toBoolean(),
  body('reminders').optional().isBoolean().toBoolean(),
  body('announcements').optional().isBoolean().toBoolean(),
];

const adminUpdateUser = [
  body('name').optional().trim().isLength({ min: 2, max: 80 }),
  body('email').optional().trim().isEmail().normalizeEmail(),
  body('role').optional().isIn(['attendee', 'exhibitor', 'admin']),
  body('isActive').optional().isBoolean().toBoolean(),
  body('isEmailVerified').optional().isBoolean().toBoolean(),
];

module.exports = {
  register,
  login,
  loginVerifyCode,
  loginResendCode,
  passkeyRegisterVerify,
  passkeyLoginVerify,
  forgotPassword,
  resetPassword,
  changePassword,
  updateProfile,
  notificationPreferences,
  adminUpdateUser,
  passwordRule,
};

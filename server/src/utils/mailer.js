'use strict';

const config = require('../config');
const logger = require('./logger');

let transporter = null;

const getTransporter = () => {
  if (!config.mail.enabled) return null;
  if (transporter) return transporter;
  const nodemailer = require('nodemailer');
  transporter = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: config.mail.user ? { user: config.mail.user, pass: config.mail.pass } : undefined,
  });
  return transporter;
};

/**
 * Send an e-mail. Without SMTP configured (local development) the message is
 * logged to the console instead of being silently dropped.
 */
const sendMail = async ({ to, subject, text, html }) => {
  const transport = getTransporter();
  if (!transport) {
    logger.info(`[mail:console] to=${to} subject="${subject}"\n${text || ''}`);
    return { delivered: false, transport: 'console' };
  }
  await transport.sendMail({ from: config.mail.from, to, subject, text, html });
  return { delivered: true, transport: 'smtp' };
};

const passwordResetEmail = (user, resetUrl) => ({
  to: user.email,
  subject: 'Reset your EventSphere password',
  text: [
    `Hello ${user.name},`,
    '',
    'We received a request to reset your EventSphere password.',
    `Open this link to choose a new password (valid for 60 minutes):`,
    resetUrl,
    '',
    'If you did not request this, you can safely ignore this e-mail.',
  ].join('\n'),
});

module.exports = { sendMail, passwordResetEmail };

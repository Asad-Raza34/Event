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
 * Send an e-mail.
 *
 * Without SMTP configured (local development) the message is not delivered:
 * only metadata is logged — never the body. One-time login codes and reset
 * links must never reach the log files. In demo mode the caller may surface a
 * code to the developer through the API response instead.
 */
const sendMail = async ({ to, subject, text, html }) => {
  const transport = getTransporter();
  if (!transport) {
    logger.info(`[mail:console] to=${to} subject="${subject}" (body withheld — configure SMTP to deliver)`);
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

/**
 * Build the login verification-code e-mail for regular users.
 */
const loginCodeEmail = (user, code, expiresAt) => {
  const minutes = Math.max(1, Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000));
  const text = [
    `Hello ${user.name},`,
    '',
    'Your EventSphere login verification code is:',
    '',
    `    ${code}`,
    '',
    `This code expires in ${minutes} minutes and can be used only once.`,
    'If you did not try to sign in, someone may be using your password —',
    'please reset your password and contact support immediately.',
    '',
    'Never share this code with anyone, including EventSphere staff.',
    '',
    '— The EventSphere team',
  ].join('\n');

  const html = `\
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1e293b">
  <h2 style="margin:0 0 4px;font-size:20px">EventSphere</h2>
  <p style="margin:0 0 20px;font-size:13px;color:#64748b">Login verification code</p>
  <p style="font-size:14px">Hello ${user.name},</p>
  <p style="font-size:14px">Use the code below to finish signing in to your EventSphere account:</p>
  <p style="text-align:center;margin:24px 0">
    <span style="display:inline-block;font-size:30px;letter-spacing:10px;font-weight:700;color:#0f172a;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:12px;padding:14px 22px">${code}</span>
  </p>
  <p style="font-size:14px">This code expires in <strong>${minutes} minutes</strong> and can be used only once.</p>
  <p style="font-size:14px;color:#b91c1c"><strong>Never share this code</strong> — EventSphere staff will never ask for it.</p>
  <p style="font-size:13px;color:#64748b">If you did not try to sign in, someone may know your password. Please reset your password and contact support immediately.</p>
  <p style="margin-top:24px;font-size:12px;color:#94a3b8">— The EventSphere team</p>
</div>`;

  return { to: user.email, subject: 'EventSphere — Login verification code', text, html };
};

/**
 * Build the ADMIN login verification-code e-mail.
 * Sent only to admin users for second-factor authentication.
 */
const adminLoginCodeEmail = (user, code, expiresAt) => {
  const minutes = Math.max(1, Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000));
  const text = [
    `Hello ${user.name},`,
    '',
    'Your EventSphere Admin Panel login verification code is:',
    '',
    `    ${code}`,
    '',
    `This code expires in ${minutes} minutes and can be used only once.`,
    'If you did not attempt to log in to your EventSphere Admin account,',
    'secure your account immediately and contact support.',
    '',
    'Never share this code with anyone, including EventSphere staff.',
    '',
    '— The EventSphere Security Team',
  ].join('\n');

  const html = `\
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1e293b">
  <h2 style="margin:0 0 4px;font-size:20px">EventSphere <span style="color:#dc2626">Admin</span></h2>
  <p style="margin:0 0 20px;font-size:13px;color:#64748b">Admin Panel — Login Verification Code</p>
  <p style="font-size:14px">Hello ${user.name},</p>
  <p style="font-size:14px">Use the code below to finish signing in to your <strong>EventSphere Admin Panel</strong>:</p>
  <p style="text-align:center;margin:24px 0">
    <span style="display:inline-block;font-size:30px;letter-spacing:10px;font-weight:700;color:#0f172a;background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:14px 22px">${code}</span>
  </p>
  <p style="font-size:14px">This code expires in <strong>${minutes} minutes</strong> and can be used only once.</p>
  <p style="font-size:14px;color:#b91c1c"><strong>Never share this code</strong> — EventSphere staff will never ask for it.</p>
  <p style="font-size:13px;color:#64748b">If you did not attempt to log in to your Admin account, secure your account immediately and contact support.</p>
  <p style="margin-top:24px;font-size:12px;color:#94a3b8">— The EventSphere Security Team</p>
</div>`;

  return { to: user.email, subject: 'EventSphere Admin — Login verification code', text, html };
};

module.exports = { sendMail, passwordResetEmail, loginCodeEmail, adminLoginCodeEmail };

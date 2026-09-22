'use strict';

const mongoose = require('mongoose');
const config = require('../config');

/**
 * Temporary login challenge created after the e-mail + password step and
 * resolved by the second factor (e-mail verification code or a passkey).
 *
 * Security properties:
 *  - only hashes are stored — never the raw code or the raw challenge token;
 *  - a new code (resend) overwrites `codeHash`, so exactly one code is ever
 *    valid for the challenge and delayed old e-mails are rejected automatically;
 *  - `attempts` counts wrong codes; `usedAt` enforces single-use;
 *  - the document is purged by a TTL index shortly after the challenge expires.
 */
const loginVerificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    /** Hash of the opaque challenge token handed to the client (Bearer-style). */
    challengeTokenHash: { type: String, required: true, unique: true, select: false },

    /** Hash of the current e-mail verification code + per-challenge salt. */
    codeHash: { type: String, required: true, select: false },
    codeSalt: { type: String, required: true, select: false },

    /** When the current code stops being accepted. */
    expiresAt: { type: Date, required: true },

    attempts: { type: Number, default: 0 },
    resendCount: { type: Number, default: 0 },
    lastResendAt: { type: Date, default: null },

    /** Set when the challenge is resolved (code verified or passkey assertion). */
    usedAt: { type: Date, default: null },

    /** IP that started the challenge — audit only, never returned to clients. */
    createdByIp: { type: String, default: '' },

    /** Whether this challenge is for an admin user (uses admin MFA config). */
    isAdmin: { type: Boolean, default: false },

    // -- WebAuthn assertion ceremony (challenge is single-use) ----------------
    webauthnChallengeHash: { type: String, default: null, select: false },
    webauthnChallengeExpiresAt: { type: Date, default: null, select: false },

    /** Hard purge deadline used by the TTL index. */
    purgeAt: { type: Date, required: true },
  },
  { timestamps: true },
);

loginVerificationSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });
loginVerificationSchema.index({ user: 1, usedAt: 1, createdAt: -1 });

const challengeTtlMs = config.mfa.challengeTtlMinutes * 60 * 1000;

/** Is the challenge itself (the temporary login session) still open? */
loginVerificationSchema.methods.isChallengeValid = function isChallengeValid(now = new Date()) {
  return !this.usedAt && this.purgeAt > now;
};

/** Is the current verification code still within its validity window? */
loginVerificationSchema.methods.isCodeValid = function isCodeValid(now = new Date()) {
  return this.isChallengeValid(now) && this.expiresAt > now;
};

loginVerificationSchema.methods.toJSON = function toJSON() {
  // Deliberately minimal: this document must never reach a client response.
  return { id: String(this._id), expiresAt: this.expiresAt, resendCount: this.resendCount };
};

loginVerificationSchema.statics.purgeDeadline = function purgeDeadline(now = new Date()) {
  return new Date(now.getTime() + challengeTtlMs);
};

const LoginVerification = mongoose.model('LoginVerification', loginVerificationSchema);

module.exports = LoginVerification;

'use strict';

const mongoose = require('mongoose');

/**
 * A registered WebAuthn/passkey credential.
 *
 * Only standard WebAuthn material is stored: the credential id, the COSE
 * public key, the signature counter, transports and a user-chosen label.
 * The fingerprint / Face ID itself never leaves the user's device — the
 * authenticator only signs server challenges with its private key, so no
 * biometric data of any kind exists in this database or anywhere else.
 */
const webAuthnCredentialSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    /** Base64URL credential id returned by the authenticator. */
    credentialId: { type: String, required: true, unique: true },

    /** COSE public key (base64URL string) used to verify assertions. */
    publicKey: { type: String, required: true },

    /** Signature counter — replay detection across ceremonies. */
    counter: { type: Number, default: 0 },

    transports: { type: [String], default: [] },

    /** Friendly label, e.g. "iPhone — Face ID". */
    deviceName: { type: String, default: '', maxlength: 80 },

    /** Browser-reported authenticator attachment ('platform' | 'cross-platform'). */
    authenticatorAttachment: { type: String, default: '' },

    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

webAuthnCredentialSchema.index({ user: 1, credentialId: 1 }, { unique: true });

const toClient = (credential) => ({
  _id: String(credential._id),
  deviceName: credential.deviceName,
  authenticatorAttachment: credential.authenticatorAttachment,
  transports: credential.transports,
  createdAt: credential.createdAt,
  lastUsedAt: credential.lastUsedAt,
});

const WebAuthnCredential = mongoose.model('WebAuthnCredential', webAuthnCredentialSchema);

module.exports = WebAuthnCredential;
module.exports.toClient = toClient;

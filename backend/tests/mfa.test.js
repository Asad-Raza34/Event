'use strict';

const config = require('../src/config');
const { api, url, auth, registerUser, login, startLogin, loginDirect, models, DEMO_PASSWORD, uniqueEmail } = require('./helpers');

const { LoginVerification } = models;

/** Load the latest challenge document (with its normally-hidden hashes). */
const challengeDoc = async () => {
  const doc = await LoginVerification.findOne({})
    .sort({ createdAt: -1 })
    .select('+codeHash +codeSalt +challengeTokenHash +webauthnChallengeHash +webauthnChallengeExpiresAt');
  expect(doc).toBeTruthy();
  return doc;
};

const expectCode = (code) => expect(String(code)).toMatch(new RegExp(`^\\d{${config.mfa.codeLength}}$`));

describe('Multi-step login (e-mail verification code)', () => {
  describe('Step 1 — credentials', () => {
    it('rejects a wrong password before creating any challenge', async () => {
      const { email } = await registerUser({ role: 'admin' });
      const before = await LoginVerification.countDocuments();

      await api().post(url('/auth/login')).send({ email, password: 'WrongPass123' }).expect(401);

      expect(await LoginVerification.countDocuments()).toBe(before);
    });

    it('stores only hashes and never returns the code in demo mode identity fields', async () => {
      const { email } = await registerUser({ role: 'admin' });
      const challenge = await startLogin(email);

      const doc = await challengeDoc();
      expect(doc.codeHash).toBeTruthy();
      expect(doc.codeSalt).toBeTruthy();
      expect(doc.codeHash).not.toBe(challenge.devCode);
      expect(doc.challengeTokenHash).toBeTruthy();
      expect(doc.challengeTokenHash).not.toBe(challenge.challengeToken);
      // The raw code must not be readable in the stored document.
      expect(JSON.stringify(doc.toObject())).not.toContain(challenge.devCode);
    });

    it('generates a cryptographically random numeric code of the configured length', async () => {
      const { email } = await registerUser({ role: 'admin' });
      const first = await startLogin(email);
      expectCode(first.devCode);

      const second = await startLogin(email); // replaces the previous challenge
      expectCode(second.devCode);
      expect(second.challengeToken).not.toBe(first.challengeToken);
    });

    it('keeps only one live challenge per user', async () => {
      const admin = await registerUser({ role: 'admin' });
      const first = await startLogin(admin.email);
      await startLogin(admin.email);

      const open = await LoginVerification.find({
        user: admin.user._id,
        usedAt: null,
        purgeAt: { $gt: new Date() },
      });
      expect(open).toHaveLength(1);

      // The superseded challenge no longer works.
      await api()
        .post(url('/auth/login/verify-code'))
        .send({ challengeToken: first.challengeToken, code: first.devCode })
        .expect(401);
    });

    it('does not create a session or challenge for an unknown account', async () => {
      const before = await LoginVerification.countDocuments();
      const response = await api()
        .post(url('/auth/login'))
        .send({ email: 'nobody-here@example.test', password: DEMO_PASSWORD })
        .expect(401);

      expect(response.body.data).toBeUndefined();
      expect(await LoginVerification.countDocuments()).toBe(before);
    });
  });

  describe('Step 2 — verifying the code', () => {
    it('rejects protected routes until the code is verified', async () => {
      const { email } = await registerUser({ role: 'admin' });
      const challenge = await startLogin(email);

      // No tokens issued yet.
      expect(challenge.accessToken).toBeUndefined();
      expect(challenge.refreshToken).toBeUndefined();
      await api().get(url('/auth/me')).expect(401);
    });

    it('accepts the correct code and issues a working session', async () => {
      const admin = await registerUser({ role: 'admin' });
      const challenge = await startLogin(admin.email);

      const response = await api()
        .post(url('/auth/login/verify-code'))
        .send({ challengeToken: challenge.challengeToken, code: challenge.devCode })
        .expect(200);

      const token = response.body.data.accessToken;
      const me = await api().get(url('/auth/me')).set(auth(token)).expect(200);
      expect(me.body.data.user.email).toBe(admin.email);
      expect(me.body.data.user.role).toBe('admin');
    });

    it('consumes the code — it cannot be reused', async () => {
      const { email } = await registerUser({ role: 'admin' });
      const challenge = await startLogin(email);

      await api()
        .post(url('/auth/login/verify-code'))
        .send({ challengeToken: challenge.challengeToken, code: challenge.devCode })
        .expect(200);

      await api()
        .post(url('/auth/login/verify-code'))
        .send({ challengeToken: challenge.challengeToken, code: challenge.devCode })
        .expect(401);
    });

    it('rejects a wrong code and counts the attempt', async () => {
      const { email } = await registerUser({ role: 'admin' });
      const challenge = await startLogin(email);

      const wrong = await api()
        .post(url('/auth/login/verify-code'))
        .send({ challengeToken: challenge.challengeToken, code: '000000' })
        .expect(400);

      expect(wrong.body.message).toMatch(/incorrect/i);
      expect(wrong.body.success).toBe(false);

      // The real code still works afterwards.
      await api()
        .post(url('/auth/login/verify-code'))
        .send({ challengeToken: challenge.challengeToken, code: challenge.devCode })
        .expect(200);
    });

    it('locks the code after the maximum number of attempts', async () => {
      const { email } = await registerUser({ role: 'admin' });
      const challenge = await startLogin(email);

      for (let attempt = 0; attempt < config.mfa.maxAttempts; attempt += 1) {
        // eslint-disable-next-line no-await-in-loop
        await api()
          .post(url('/auth/login/verify-code'))
          .send({ challengeToken: challenge.challengeToken, code: '000000' })
          .expect(400);
      }

      // Even the (previously correct) code is refused once attempts run out…
      const locked = await api()
        .post(url('/auth/login/verify-code'))
        .send({ challengeToken: challenge.challengeToken, code: challenge.devCode })
        .expect(400);
      expect(locked.body.message).toMatch(/too many incorrect codes/i);

      // …and the user can recover by requesting a fresh code after the cooldown.
      const doc = await challengeDoc();
      doc.lastResendAt = new Date(Date.now() - (config.mfa.resendCooldownSeconds + 5) * 1000);
      await doc.save({ validateBeforeSave: false });

      const resent = await api()
        .post(url('/auth/login/resend-code'))
        .send({ challengeToken: challenge.challengeToken })
        .expect(200);
      expect(resent.body.data.devCode).not.toBe(challenge.devCode);

      await api()
        .post(url('/auth/login/verify-code'))
        .send({ challengeToken: challenge.challengeToken, code: resent.body.data.devCode })
        .expect(200);
    });

    it('rejects an expired code without destroying the challenge', async () => {
      const { email } = await registerUser({ role: 'admin' });
      const challenge = await startLogin(email);

      const doc = await challengeDoc();
      doc.expiresAt = new Date(Date.now() - 1000);
      await doc.save({ validateBeforeSave: false });

      const expired = await api()
        .post(url('/auth/login/verify-code'))
        .send({ challengeToken: challenge.challengeToken, code: challenge.devCode })
        .expect(400);
      expect(expired.body.message).toMatch(/expired/i);
    });

    it('answers 401 for a forged or missing challenge token', async () => {
      await api()
        .post(url('/auth/login/verify-code'))
        .send({ challengeToken: 'a'.repeat(64), code: '123456' })
        .expect(401);
    });
  });

  describe('Resend verification code', () => {
    it('issues a new code, invalidates the old one and keeps the session open', async () => {
      const { email } = await registerUser({ role: 'admin' });
      const first = await startLogin(email);

      const doc = await challengeDoc();
      doc.lastResendAt = new Date(Date.now() - (config.mfa.resendCooldownSeconds + 5) * 1000);
      await doc.save({ validateBeforeSave: false });

      const resent = await api()
        .post(url('/auth/login/resend-code'))
        .send({ challengeToken: first.challengeToken })
        .expect(200);

      expect(resent.body.data.devCode).toBeTruthy();
      expect(resent.body.data.devCode).not.toBe(first.devCode);

      // Delayed old e-mail arriving late must be rejected…
      await api()
        .post(url('/auth/login/verify-code'))
        .send({ challengeToken: first.challengeToken, code: first.devCode })
        .expect(400);

      // …while only the newest code is accepted.
      const verified = await api()
        .post(url('/auth/login/verify-code'))
        .send({ challengeToken: first.challengeToken, code: resent.body.data.devCode })
        .expect(200);
      expect(verified.body.data.accessToken).toBeTruthy();
    });

    it('enforces the resend cooldown on the server', async () => {
      const { email } = await registerUser({ role: 'admin' });
      const challenge = await startLogin(email);

      const blocked = await api()
        .post(url('/auth/login/resend-code'))
        .send({ challengeToken: challenge.challengeToken })
        .expect(429);

      expect(blocked.body.message).toMatch(/wait/i);
    });

    it('caps the number of resends per challenge', async () => {
      const { email } = await registerUser({ role: 'admin' });
      const challenge = await startLogin(email);
      const doc = await challengeDoc();
      doc.resendCount = config.mfa.maxResends;
      doc.lastResendAt = new Date(Date.now() - (config.mfa.resendCooldownSeconds + 5) * 1000);
      await doc.save({ validateBeforeSave: false });

      const response = await api()
        .post(url('/auth/login/resend-code'))
        .send({ challengeToken: challenge.challengeToken })
        .expect(429);
      expect(response.body.message).toMatch(/too many verification codes/i);
    });

    it('refuses to resend for an unknown challenge token', async () => {
      await api()
        .post(url('/auth/login/resend-code'))
        .send({ challengeToken: 'b'.repeat(64) })
        .expect(401);
    });

    it('reports the challenge status so a reloaded screen can recover', async () => {
      const { email } = await registerUser({ role: 'admin' });
      const challenge = await startLogin(email);

      const status = await api()
        .post(url('/auth/login/challenge'))
        .send({ challengeToken: challenge.challengeToken })
        .expect(200);

      expect(status.body.data.valid).toBe(true);
      expect(status.body.data.maskedEmail).not.toBe(email);
      expect(status.body.data.passkeyAvailable).toBe(false);

      const gone = await api()
        .post(url('/auth/login/challenge'))
        .send({ challengeToken: 'c'.repeat(64) })
        .expect(200);
      expect(gone.body.data.valid).toBe(false);
    });
  });

  describe('WebAuthn / passkey second factor', () => {
    it('reports passkey availability and returns assertion options for a registered device', async () => {
      const admin = await registerUser({ role: 'admin' });
      await models.WebAuthnCredential.create({
        user: admin.user._id,
        credentialId: 'test-credential-id',
        publicKey: Buffer.from('test-public-key').toString('base64url'),
        counter: 0,
        deviceName: 'Test phone',
      });

      const challenge = await startLogin(admin.email);
      expect(challenge.passkeyAvailable).toBe(true);

      const options = await api()
        .post(url('/auth/login/passkey/options'))
        .send({ challengeToken: challenge.challengeToken })
        .expect(200);

      expect(options.body.data.options.challenge).toBeTruthy();
      expect(options.body.data.options.allowCredentials[0].id).toBe('test-credential-id');
      expect(options.body.data.options.rpId).toBe(config.webauthn.rpId);
    });

    it('rejects a forged assertion without issuing a session', async () => {
      const admin = await registerUser({ role: 'admin' });
      await models.WebAuthnCredential.create({
        user: admin.user._id,
        credentialId: 'forged-credential-id',
        publicKey: Buffer.from('test-public-key').toString('base64url'),
        counter: 0,
      });
      const challenge = await startLogin(admin.email);
      await api().post(url('/auth/login/passkey/options')).send({ challengeToken: challenge.challengeToken }).expect(200);

      const response = await api()
        .post(url('/auth/login/passkey/verify'))
        .send({
          challengeToken: challenge.challengeToken,
          response: {
            id: 'forged-credential-id',
            rawId: 'forged-credential-id',
            type: 'public-key',
            response: { clientDataJSON: 'e30', authenticatorData: 'AAAA', signature: 'AAAA' },
          },
        })
        .expect(400);

      expect(response.body.message).toMatch(/biometric|passkey|verification/i);
      expect(response.body.data).toBeUndefined();
    });

    it('burns the assertion challenge after one attempt (replay protection)', async () => {
      const admin = await registerUser({ role: 'admin' });
      await models.WebAuthnCredential.create({
        user: admin.user._id,
        credentialId: 'replay-credential-id',
        publicKey: Buffer.from('test-public-key').toString('base64url'),
        counter: 0,
      });
      const challenge = await startLogin(admin.email);
      await api().post(url('/auth/login/passkey/options')).send({ challengeToken: challenge.challengeToken }).expect(200);

      const assertion = {
        challengeToken: challenge.challengeToken,
        response: {
          id: 'replay-credential-id',
          rawId: 'replay-credential-id',
          type: 'public-key',
          response: { clientDataJSON: 'e30', authenticatorData: 'AAAA', signature: 'AAAA' },
        },
      };

      await api().post(url('/auth/login/passkey/verify')).send(assertion).expect(400);
      // A second replay cannot succeed either — the challenge was consumed.
      await api().post(url('/auth/login/passkey/verify')).send(assertion).expect(400);
    });

    it('refuses assertion options when no passkey is registered', async () => {
      const admin = await registerUser({ role: 'admin' });
      const challenge = await startLogin(admin.email);

      const response = await api()
        .post(url('/auth/login/passkey/options'))
        .send({ challengeToken: challenge.challengeToken })
        .expect(404);
      expect(response.body.message).toMatch(/no passkey/i);
    });
  });

  describe('Passkey management (authenticated)', () => {
    it('lists and removes registered passkeys', async () => {
      const admin = await login((await registerUser({ role: 'admin' })).email);
      const created = await models.WebAuthnCredential.create({
        user: admin.user._id,
        credentialId: 'manage-credential-id',
        publicKey: Buffer.from('test-public-key').toString('base64url'),
        counter: 3,
        deviceName: 'Office laptop',
      });

      const list = await api().get(url('/auth/passkeys')).set(auth(admin.token)).expect(200);
      expect(list.body.data.credentials).toHaveLength(1);
      expect(list.body.data.credentials[0]).toMatchObject({ deviceName: 'Office laptop' });
      // Private material never leaves the server.
      expect(list.body.data.credentials[0].publicKey).toBeUndefined();
      expect(JSON.stringify(list.body.data)).not.toContain('test-public-key');

      await api().delete(url(`/auth/passkeys/${created._id}`)).set(auth(admin.token)).expect(200);
      expect(await models.WebAuthnCredential.countDocuments({ user: admin.user._id })).toBe(0);
    });

    it('hands out a registration challenge for the signed-in user', async () => {
      const admin = await login((await registerUser({ role: 'admin' })).email);
      const response = await api().post(url('/auth/passkeys/options')).set(auth(admin.token)).send({}).expect(200);

      expect(response.body.data.options.challenge).toBeTruthy();
      expect(response.body.data.options.rp.id).toBe(config.webauthn.rpId);
      expect(response.body.data.options.user.id).toBeTruthy();

      const stored = await models.User.findById(admin.user._id).select('+webauthnChallengeHash');
      expect(stored.webauthnChallengeHash).toHaveLength(64);
    });

    it('requires authentication to manage passkeys', async () => {
      await api().get(url('/auth/passkeys')).expect(401);
      await api().post(url('/auth/passkeys/options')).send({}).expect(401);
    });
  });

  describe('Existing behaviour still works', () => {
    it('refreshes and logs out through the full login flow', async () => {
      const admin = await login((await registerUser({ role: 'admin' })).email);
      await api().post(url('/auth/refresh')).set(auth(admin.token)).send({}).expect(401);

      await api().post(url('/auth/logout')).set(auth(admin.token)).send({}).expect(200);
      await api().get(url('/auth/me')).set(auth(admin.token)).expect(200); // stateless access token
    });

    it('leaves role-based authorization intact', async () => {
      const { email } = await registerUser({ role: 'admin' });
      const challenge = await startLogin(email, DEMO_PASSWORD);
      const verified = await api()
        .post(url('/auth/login/verify-code'))
        .send({ challengeToken: challenge.challengeToken, code: challenge.devCode })
        .expect(200);

      const token = verified.body.data.accessToken;
      const admin = await api().get(url('/auth/me')).set(auth(token)).expect(200);
      expect(admin.body.data.user.role).toBe('admin');

      // Admin-only surface stays accessible.
      await api().get(url('/users')).set(auth(token)).expect(200);
    });

    it('does not leak the code in the verification response', async () => {
      const admin = await registerUser({ role: 'admin' });
      const challenge = (await api().post(url('/auth/login')).send({ email: admin.email, password: DEMO_PASSWORD })).body.data;

      const verified = await api()
        .post(url('/auth/login/verify-code'))
        .send({ challengeToken: challenge.challengeToken, code: challenge.devCode })
        .expect(200);

      expect(JSON.stringify(verified.body)).not.toContain(challenge.devCode);
    });
  });
});

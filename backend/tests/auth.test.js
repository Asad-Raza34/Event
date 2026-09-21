'use strict';

const { api, url, auth, registerUser, login, models, DEMO_PASSWORD, uniqueEmail } = require('./helpers');

describe('Authentication', () => {
  describe('POST /api/auth/register', () => {
    it('creates an attendee, hashes the password and returns an access token', async () => {
      const email = uniqueEmail('register');
      const response = await api()
        .post(url('/auth/register'))
        .send({ name: 'New Attendee', email, password: DEMO_PASSWORD, role: 'attendee' })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.accessToken).toBeTruthy();
      expect(response.body.data.user).toMatchObject({ email, role: 'attendee' });
      expect(response.body.data.user.password).toBeUndefined();

      const stored = await models.User.findOne({ email }).select('+password');
      expect(stored.password).not.toBe(DEMO_PASSWORD);
      expect(stored.password.startsWith('$2')).toBe(true); // bcrypt hash
    });

    it('creates the role-specific profile document', async () => {
      const exhibitor = await registerUser({ role: 'exhibitor', organization: 'Profile Check Ltd' });
      const profile = await models.ExhibitorProfile.findOne({ user: exhibitor.user._id });
      expect(profile).toBeTruthy();
      expect(profile.companyName).toBe('Profile Check Ltd');

      const attendee = await registerUser({ role: 'attendee' });
      expect(await models.AttendeeProfile.findOne({ user: attendee.user._id })).toBeTruthy();
    });

    it('rejects a duplicate email with 409', async () => {
      const { email } = await registerUser();
      const response = await api()
        .post(url('/auth/register'))
        .send({ name: 'Copy Cat', email, password: DEMO_PASSWORD })
        .expect(409);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toMatch(/already exists/i);
    });

    it('validates input and returns field-level errors', async () => {
      const response = await api()
        .post(url('/auth/register'))
        .send({ name: 'A', email: 'not-an-email', password: 'short' })
        .expect(422);

      expect(response.body.success).toBe(false);
      expect(Array.isArray(response.body.errors)).toBe(true);
      const fields = response.body.errors.map((error) => error.field);
      expect(fields).toEqual(expect.arrayContaining(['email', 'password']));
    });

    it('requires an invitation code for organizer accounts', async () => {
      await api()
        .post(url('/auth/register'))
        .send({ name: 'Fake Admin', email: uniqueEmail('fakeadmin'), password: DEMO_PASSWORD, role: 'admin' })
        .expect(403);

      const admin = await registerUser({ role: 'admin' });
      expect(admin.user.role).toBe('admin');
    });
  });

  describe('POST /api/auth/login', () => {
    it('authenticates with valid credentials', async () => {
      const { email } = await registerUser();
      const response = await api().post(url('/auth/login')).send({ email, password: DEMO_PASSWORD }).expect(200);
      expect(response.body.data.accessToken).toBeTruthy();
      expect(response.body.message).toMatch(/welcome back/i);
    });

    it('rejects a wrong password without revealing which field failed', async () => {
      const { email } = await registerUser();
      const response = await api().post(url('/auth/login')).send({ email, password: 'WrongPassword123' }).expect(401);
      expect(response.body.message).toBe('Invalid email or password');
    });

    it('rejects unknown accounts', async () => {
      await api().post(url('/auth/login')).send({ email: 'nobody@example.test', password: DEMO_PASSWORD }).expect(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns the signed-in user with their profile', async () => {
      const attendee = await registerUser();
      const response = await api().get(url('/auth/me')).set(auth(attendee.token)).expect(200);
      expect(response.body.data.user._id).toBe(attendee.user._id);
      expect(response.body.data.profile).toBeTruthy();
    });

    it('rejects requests without a token (401)', async () => {
      const response = await api().get(url('/auth/me')).expect(401);
      expect(response.body.success).toBe(false);
    });

    it('rejects malformed tokens', async () => {
      await api().get(url('/auth/me')).set({ Authorization: 'Bearer not.a.jwt' }).expect(401);
    });
  });

  describe('Profile and password management', () => {
    it('updates the profile and notification preferences', async () => {
      const attendee = await registerUser();
      const updated = await api()
        .patch(url('/users/me'))
        .set(auth(attendee.token))
        .send({ name: 'Updated Name', jobTitle: 'Head of Operations', city: 'Berlin' })
        .expect(200);
      expect(updated.body.data.user.name).toBe('Updated Name');

      const prefs = await api()
        .patch(url('/users/me/notification-preferences'))
        .set(auth(attendee.token))
        .send({ reminders: false })
        .expect(200);
      expect(prefs.body.data.reminders).toBe(false);
    });

    it('changes the password and invalidates the old one', async () => {
      const attendee = await registerUser();
      const response = await api()
        .post(url('/auth/change-password'))
        .set(auth(attendee.token))
        .send({ currentPassword: DEMO_PASSWORD, newPassword: 'BrandNewPass99' })
        .expect(200);
      expect(response.body.data.accessToken).toBeTruthy();

      await api().post(url('/auth/login')).send({ email: attendee.email, password: DEMO_PASSWORD }).expect(401);
      await api().post(url('/auth/login')).send({ email: attendee.email, password: 'BrandNewPass99' }).expect(200);
    });

    it('rejects an incorrect current password', async () => {
      const attendee = await registerUser();
      await api()
        .post(url('/auth/change-password'))
        .set(auth(attendee.token))
        .send({ currentPassword: 'NotMyPassword1', newPassword: 'BrandNewPass99' })
        .expect(400);
    });

    it('supports the forgot / reset password flow', async () => {
      const attendee = await registerUser();
      const forgot = await api().post(url('/auth/forgot-password')).send({ email: attendee.email }).expect(200);
      // In demo mode (default outside production) the token is returned for testing.
      const token = forgot.body.data.resetToken;
      expect(token).toBeTruthy();

      await api()
        .post(url('/auth/reset-password'))
        .send({ token, email: attendee.email, password: 'ResetPassword77' })
        .expect(200);

      await api().post(url('/auth/login')).send({ email: attendee.email, password: 'ResetPassword77' }).expect(200);
      await api().post(url('/auth/reset-password')).send({ token, password: 'AnotherPassword11' }).expect(400);
    });

    it('does not leak whether an email exists', async () => {
      const response = await api().post(url('/auth/forgot-password')).send({ email: 'ghost@example.test' }).expect(200);
      expect(response.body.data.resetToken).toBeUndefined();
      expect(response.body.message).toMatch(/if an account exists/i);
    });
  });

  describe('Session refresh', () => {
    it('issues a new access token using the refresh cookie', async () => {
      const agent = require('supertest').agent(require('../src/app'));
      const email = uniqueEmail('refresh');
      await agent.post(url('/auth/register')).send({ name: 'Refresh User', email, password: DEMO_PASSWORD }).expect(201);

      const refreshed = await agent.post(url('/auth/refresh')).send({}).expect(200);
      expect(refreshed.body.data.accessToken).toBeTruthy();
    });

    it('rejects a refresh without a session cookie', async () => {
      await api().post(url('/auth/refresh')).send({}).expect(401);
    });
  });
});

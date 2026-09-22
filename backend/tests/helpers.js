'use strict';

const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const models = require('../src/models');
const { slugify, humanCode, addDays } = require('../src/utils/helpers');

const api = () => request(app);
const url = (path) => `/api${path}`;

let counter = 0;
const uniqueEmail = (prefix = 'user') => {
  counter += 1;
  return `${prefix}.${Date.now().toString(36)}${counter}@example.test`;
};

const DEMO_PASSWORD = 'Sample@123';

/** Register any role and return `{ user, token, password, email }`. */
const registerUser = async (overrides = {}) => {
  const role = overrides.role || 'attendee';
  const email = overrides.email || uniqueEmail(role);
  const payload = {
    name: overrides.name || `${role === 'admin' ? 'Ada' : role === 'exhibitor' ? 'Nina' : 'Omar'} ${counter + 1} Tester`,
    email,
    password: overrides.password || DEMO_PASSWORD,
    role,
    organization: overrides.organization || (role === 'exhibitor' ? 'Tester Industries' : 'Tester Group'),
    city: overrides.city || 'San Francisco',
    country: overrides.country || 'United States',
    ...(role === 'admin' ? { adminInviteCode: process.env.ADMIN_INVITE_CODE || 'EVENTSPHERE-ADMIN' } : {}),
    ...overrides,
  };

  const response = await api().post(url('/auth/register')).send(payload).expect(201);
  const { user, accessToken } = response.body.data;
  // `token` is a convenience alias for the access token used in auth headers.
  return { user, accessToken, token: accessToken, password: payload.password, email, role };
};

/**
 * Step 1 of sign-in: submit the e-mail + password pair and return the
 * temporary challenge (no session is issued at this point).
 * Only works for admin users (who require 2FA).
 */
const startLogin = async (email, password = DEMO_PASSWORD) => {
  const response = await api().post(url('/auth/login')).send({ email, password }).expect(200);
  const data = response.body.data;
  expect(data.mfaRequired).toBe(true);
  expect(data.accessToken).toBeUndefined();
  return data;
};

/**
 * Full sign-in for admin users: credentials → e-mail verification code → session.
 * In test/demo mode the code is returned (`devCode`) because SMTP is not
 * configured, exactly like the password-reset token in demo mode.
 */
const login = async (email, password = DEMO_PASSWORD) => {
  const challenge = await startLogin(email, password);
  const response = await api()
    .post(url('/auth/login/verify-code'))
    .send({ challengeToken: challenge.challengeToken, code: challenge.devCode })
    .expect(200);
  const { user, accessToken } = response.body.data;
  return { user, accessToken, token: accessToken };
};

/**
 * Full sign-in for non-admin users (attendee, exhibitor): credentials → session (no 2FA).
 */
const loginDirect = async (email, password = DEMO_PASSWORD) => {
  const response = await api().post(url('/auth/login')).send({ email, password }).expect(200);
  const data = response.body.data;
  expect(data.mfaRequired).toBe(false);
  expect(data.accessToken).toBeTruthy();
  const { user, accessToken } = data;
  return { user, accessToken, token: accessToken };
};

const auth = (token) => ({ Authorization: `Bearer ${token}` });

/** Create an expo owned by `admin` and publish it so it is registrable. */
const createPublishedExpo = async (admin, overrides = {}) => {
  const payload = {
    title: overrides.title || `Test Expo ${uniqueEmail('expo').split('@')[0]}`,
    description: 'A test expo created by the automated test suite covering validation, scheduling and registration flows.',
    category: 'technology',
    theme: 'Automated testing',
    startDate: addDays(new Date(), 10).toISOString(),
    endDate: addDays(new Date(), 12).toISOString(),
    registrationDeadline: addDays(new Date(), 8).toISOString(),
    maxAttendees: 200,
    ticketPrice: overrides.ticketPrice ?? 0,
    location: { venue: 'Test Hall', city: 'San Francisco', country: 'United States' },
    ...overrides,
  };

  const created = await api().post(url('/expos')).set(auth(admin.token)).send(payload).expect(201);
  const expo = created.body.data;
  const published = await api().post(url(`/expos/${expo._id}/publish`)).set(auth(admin.token)).expect(200);
  return published.body.data;
};

/** Approve the exhibitor's application for an expo (organizer action). */
const approveApplication = async (admin, applicationId, extra = {}) => {
  const response = await api()
    .patch(url(`/exhibitors/admin/applications/${applicationId}`))
    .set(auth(admin.token))
    .send({ status: 'approved', reviewNote: 'Approved by test suite', ...extra })
    .expect(200);
  return response.body.data;
};

/** Create a booth grid for an expo and return the created booths. */
const createBooths = async (admin, expoId, options = {}) => {
  const response = await api()
    .post(url(`/expos/${expoId}/booths/bulk`))
    .set(auth(admin.token))
    .send({ zone: 'A', rows: 2, cols: 3, size: 'medium', price: 1200, currency: 'USD', ...options })
    .expect(201);
  return response.body.data.booths;
};

const createSpeaker = async (admin, overrides = {}) => {
  const response = await api()
    .post(url('/speakers'))
    .set(auth(admin.token))
    .send({ name: 'Dr. Test Speaker', title: 'Principal Engineer', organization: 'Testing Labs', expertise: ['testing'], ...overrides })
    .expect(201);
  return response.body.data;
};

const createSession = async (admin, expoId, overrides = {}) => {
  const response = await api()
    .post(url('/sessions'))
    .set(auth(admin.token))
    .send({
      expo: expoId,
      title: 'Automated test session',
      description: 'Session created by the automated test suite.',
      type: 'workshop',
      category: 'testing',
      date: addDays(new Date(), 10).toISOString(),
      startTime: '10:00',
      endTime: '11:00',
      capacity: 30,
      location: { room: 'Test Room 1' },
      ...overrides,
    })
    .expect(201);
  return response.body.data;
};

const cleanupCollections = async () => {
  const collections = await mongoose.connection.db.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
};

module.exports = {
  api,
  url,
  auth,
  registerUser,
  login,
  startLogin,
  createPublishedExpo,
  approveApplication,
  createBooths,
  createSpeaker,
  createSession,
  cleanupCollections,
  uniqueEmail,
  DEMO_PASSWORD,
  models,
  slugify,
  humanCode,
  addDays,
};

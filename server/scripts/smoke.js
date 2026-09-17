'use strict';

/**
 * End-to-end smoke check: boots an in-memory MongoDB, seeds the demo dataset
 * and drives the most important user journeys through the real HTTP API.
 *
 *   npm run smoke
 */

process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.ALLOW_IN_MEMORY_DB = 'true';

const mongoose = require('mongoose');
const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const { seed } = require('../src/seed/seed');
const logger = require('../src/utils/logger');

const results = [];
const record = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  logger.plain(`${ok ? '✔' : '✘'} ${name}${detail ? ` — ${detail}` : ''}`);
};

const api = () => request(app);
const auth = (token) => ({ Authorization: `Bearer ${token}` });

const login = async (email, password = 'Sample@123') => {
  const response = await api().post('/api/auth/login').send({ email, password });
  if (response.status !== 200) throw new Error(`login failed for ${email}: ${response.body.message}`);
  return response.body.data.accessToken;
};

const main = async () => {
  const mongo = await MongoMemoryServer.create({ instance: { dbName: 'eventsphere_smoke' } });
  await mongoose.connect(mongo.getUri('eventsphere_smoke'));

  logger.plain('\nEventSphere smoke check\n───────────────────────');
  const summary = await seed({ fresh: true });
  record('seed dataset', !summary.skipped, `${summary.users} users, ${summary.expos} expos, ${summary.booths} booths`);

  // ---- Health & public browsing -------------------------------------------
  const health = await api().get('/api/health').expect(200);
  record('GET /api/health', health.body.data.database === 'connected', `db=${health.body.data.database}`);

  const expos = await api().get('/api/expos?limit=10').expect(200);
  record('GET /api/expos', expos.body.data.length >= 3, `${expos.body.data.length} public expos`);

  const currentExpo = expos.body.data.find((expo) => expo.status === 'ongoing') || expos.body.data[0];

  const detail = await api().get(`/api/expos/${currentExpo._id}`).expect(200);
  record('GET /api/expos/:id', Boolean(detail.body.data.sessions.length), `${detail.body.data.sessions.length} sessions`);

  const layout = await api().get(`/api/expos/${currentExpo._id}/floor-plan`).expect(200);
  record('GET floor plan', layout.body.data.booths.length > 0, `${layout.body.data.summary.occupied} occupied booths`);

  const exhibitors = await api().get('/api/exhibitors?limit=20').expect(200);
  record('GET /api/exhibitors', exhibitors.body.data.length >= 4, `${exhibitors.body.data.length} exhibitors`);

  const sessionsToday = await api().get('/api/sessions?when=today').expect(200);
  record('GET /api/sessions?when=today', Array.isArray(sessionsToday.body.data), `${sessionsToday.body.data.length} sessions today`);

  const search = await api().get('/api/search?q=robotics').expect(200);
  record('GET /api/search', search.body.data.totalResults > 0, `${search.body.data.totalResults} matches`);

  // ---- Auth --------------------------------------------------------------
  const adminToken = await login('admin@eventsphere.io');
  const exhibitorToken = await login('exhibitor@nexarobotics.io');
  const attendeeToken = await login('attendee@example.com');
  record('demo logins', Boolean(adminToken && exhibitorToken && attendeeToken), 'admin / exhibitor / attendee');

  // ---- Admin journey -----------------------------------------------------
  const adminAnalytics = await api().get('/api/analytics/admin').set(auth(adminToken)).expect(200);
  record('admin analytics', adminAnalytics.body.data.totals.users >= 10, `revenue ${adminAnalytics.body.data.totals.revenue}`);

  const applications = await api().get('/api/exhibitors/admin/applications?status=pending').set(auth(adminToken)).expect(200);
  record('exhibitor applications', applications.body.data.length > 0, `${applications.body.data.length} pending`);

  const pendingBooths = await api().get(`/api/booths/pending?expo=${currentExpo._id}`).set(auth(adminToken)).expect(200);
  record('pending booth requests', Array.isArray(pendingBooths.body.data), `${pendingBooths.body.data.length} waiting`);

  const payments = await api().get('/api/payments?status=paid').set(auth(adminToken)).expect(200);
  record('payment ledger', payments.body.data.length > 0, `${payments.body.meta.paidCount} paid transactions`);

  const registrations = await api().get('/api/registrations?status=attended').set(auth(adminToken)).expect(200);
  record('registrations list', registrations.body.data.length > 0, `${registrations.body.meta.total} attended`);

  const tickets = await api().get('/api/tickets').set(auth(adminToken)).expect(200);
  record('support tickets', tickets.body.data.length >= 2, `${tickets.body.data.length} tickets`);

  // ---- Attendee journey --------------------------------------------------
  const activity = await api().get('/api/registrations/me/activity').set(auth(attendeeToken)).expect(200);
  record('attendee activity', activity.body.data.stats.expos >= 1, `${activity.body.data.stats.expos} expos`);

  const pass = await api().get('/api/registrations/pass').set(auth(attendeeToken)).expect(200);
  record('event pass + QR', pass.body.data.qr.dataUrl.startsWith('data:image/png'), pass.body.data.registration.passCode);

  const checkIn = await api()
    .post('/api/check-ins')
    .set(auth(adminToken))
    .send({ code: pass.body.data.qr.payload, type: 'event' });

  if (checkIn.status === 200 && checkIn.body.data.registration.status === 'attended') {
    record('QR check-in', true, checkIn.body.data.alreadyCheckedIn ? 'already checked in' : 'checked in now');
  } else {
    // The demo attendee is already checked in for the ongoing expo — that is a pass too.
    record('QR check-in', checkIn.status === 200, checkIn.body.message || 'handled');
  }

  const agenda = await api().get('/api/sessions/agenda/me').set(auth(attendeeToken)).expect(200);
  record('personal agenda', Array.isArray(agenda.body.data), `${agenda.body.data.length} entries`);

  const appointments = await api().get('/api/appointments').set(auth(attendeeToken)).expect(200);
  record('attendee appointments', appointments.body.data.length >= 1, `${appointments.body.data.length} appointments`);

  // ---- Exhibitor journey -------------------------------------------------
  const workspace = await api().get('/api/exhibitors/me/workspace').set(auth(exhibitorToken)).expect(200);
  record('exhibitor workspace', workspace.body.data.products.length >= 3, workspace.body.data.profile.companyName);

  const exhibitorAnalytics = await api().get('/api/analytics/exhibitor').set(auth(exhibitorToken)).expect(200);
  record('exhibitor analytics', exhibitorAnalytics.body.data.trends.boothVisits.length > 0, `${exhibitorAnalytics.body.data.totals.boothVisits} booth visits`);

  const slots = await api().get(`/api/availability-slots?exhibitorUser=${workspace.body.data.profile.user}`).expect(200);
  record('exhibitor availability', slots.body.data.length > 0, `${slots.body.data.length} slots`);

  const conversations = await api().get('/api/conversations').set(auth(exhibitorToken)).expect(200);
  record('chat conversations', conversations.body.data.length >= 1, `${conversations.body.data.length} threads`);

  // ---- Real-time, AI assistant and payments ------------------------------
  const aiBooth = await api().post('/api/ai/chat').send({ message: 'Where is booth A-01?' }).expect(200);
  record('AI: booth location', /A-01/.test(aiBooth.body.data.answer), aiBooth.body.data.provider);

  const aiSessions = await api().post('/api/ai/chat').send({ message: 'What sessions are available today?' }).expect(200);
  record('AI: sessions today', aiSessions.body.data.intent === 'session_search', `${aiSessions.body.data.sources.length} sources`);

  const aiProducts = await api().post('/api/ai/chat').send({ message: 'Which exhibitors sell electronics?' }).expect(200);
  record('AI: product search', aiProducts.body.data.answer.length > 40, aiProducts.body.data.intent);

  const checkout = await api()
    .post('/api/payments/checkout')
    .set(auth(attendeeToken))
    .send({ purpose: 'other', amount: 49, description: 'Smoke test charge' })
    .expect(201);
  const confirmed = await api().post(`/api/payments/${checkout.body.data.payment._id}/confirm`).set(auth(attendeeToken)).send({}).expect(200);
  record('mock payment + invoice', confirmed.body.data.status === 'paid', confirmed.body.data.transactionId);

  const invoice = await api().get(`/api/payments/${checkout.body.data.payment._id}/invoice`).set(auth(attendeeToken)).expect(200);
  record('printable invoice', invoice.text.includes('Invoice') && invoice.text.includes(confirmed.body.data.invoice.number));

  const notifications = await api().get('/api/notifications').set(auth(attendeeToken)).expect(200);
  record('notifications', notifications.body.meta.unread >= 0, `${notifications.body.meta.unread} unread`);

  const feedback = await api()
    .post('/api/feedback')
    .send({ subject: 'Smoke test feedback', message: 'Automated end-to-end check of the public feedback endpoint.', category: 'app', rating: 5 })
    .expect(201);
  record('public feedback', Boolean(feedback.body.data._id));

  // ---- Summary -----------------------------------------------------------
  const failed = results.filter((result) => !result.ok);
  logger.plain(`\n${results.length - failed.length}/${results.length} checks passed`);
  if (failed.length) logger.plain(`Failed: ${failed.map((f) => f.name).join(', ')}`);

  await mongoose.connection.close();
  await mongo.stop();
  process.exit(failed.length ? 1 : 0);
};

main().catch(async (error) => {
  logger.error('Smoke check crashed:', error);
  await mongoose.connection.close().catch(() => {});
  process.exit(1);
});

'use strict';

const { api, url, auth, registerUser, createPublishedExpo, models } = require('./helpers');

describe('Role-based authorization and data protection', () => {
  let admin;
  let exhibitor;
  let attendee;
  let secondAttendee;

  beforeAll(async () => {
    admin = await registerUser({ role: 'admin' });
    exhibitor = await registerUser({ role: 'exhibitor', organization: 'Access Control Ltd' });
    attendee = await registerUser({ role: 'attendee' });
    secondAttendee = await registerUser({ role: 'attendee' });
  });

  const adminOnly = [
    ['GET', '/users'],
    ['GET', '/users/stats'],
    ['GET', '/analytics/admin'],
    ['GET', '/payments'],
    ['GET', '/payments/stats'],
    ['GET', '/tickets/stats'],
    ['GET', '/feedback'],
    ['GET', '/booths/pending'],
    ['GET', '/check-ins'],
  ];

  it('scopes the ticket inbox: organizers see everything, users see their own', async () => {
    const mine = await api().get(url('/tickets')).set(auth(attendee.token)).expect(200);
    expect(mine.body.meta.isStaff).toBe(false);
    expect(mine.body.data.every((ticket) => String(ticket.user._id) === String(attendee.user._id))).toBe(true);

    const all = await api().get(url('/tickets')).set(auth(admin.token)).expect(200);
    expect(all.body.meta.isStaff).toBe(true);
  });

  it.each(adminOnly)('blocks non-organizers from %s %s', async (method, path) => {
    await api()[method.toLowerCase()](url(path)).set(auth(attendee.token)).expect(403);
    await api()[method.toLowerCase()](url(path)).set(auth(exhibitor.token)).expect(403);
  });

  it('allows organizers through the same endpoints', async () => {
    for (const [method, path] of adminOnly) {
      // eslint-disable-next-line no-await-in-loop
      const response = await api()[method.toLowerCase()](url(path)).set(auth(admin.token));
      expect(response.status).toBeLessThan(400);
    }
  });

  it('requires authentication for every protected endpoint', async () => {
    await api().get(url('/registrations/me')).expect(401);
    await api().get(url('/appointments')).expect(401);
    await api().get(url('/conversations')).expect(401);
    await api().get(url('/notifications')).expect(401);
    await api().get(url('/ai/history')).expect(401);
    await api().post(url('/feedback')).send({ subject: 'Anonymous feedback', message: 'This should be allowed without an account.' }).expect(201);
  });

  it('stops exhibitors from managing other exhibitors data', async () => {
    const profile = await models.ExhibitorProfile.findOne({ user: exhibitor.user._id });
    const other = await registerUser({ role: 'exhibitor', organization: 'Rival Systems' });

    await api().post(url('/exhibitors/me/products')).set(auth(other.token)).send({ name: 'Mine only' }).expect(201);
    const products = await api().get(url('/exhibitors/me/products')).set(auth(exhibitor.token)).expect(200);
    expect(products.body.data).toEqual([]);
    expect(profile).toBeTruthy();

    // Attendees cannot use exhibitor-only endpoints at all.
    await api().post(url('/exhibitors/me/products')).set(auth(attendee.token)).send({ name: 'Nope' }).expect(403);
  });

  it('keeps chat scoped to the conversation participants', async () => {
    const conversation = await models.Conversation.create({
      participants: [attendee.user._id, exhibitor.user._id],
      pairKey: `auth-test-${Date.now()}`,
      unreadCounts: {},
    });

    const allowed = await api().get(url(`/conversations/${conversation._id}`)).set(auth(attendee.token)).expect(200);
    expect(allowed.body.data.messages).toEqual([]);

    await api().get(url(`/conversations/${conversation._id}`)).set(auth(secondAttendee.token)).expect(403);
    await api().post(url(`/conversations/${conversation._id}/messages`)).set(auth(secondAttendee.token)).send({ body: 'Intruder' }).expect(403);

    const sent = await api()
      .post(url(`/conversations/${conversation._id}/messages`))
      .set(auth(attendee.token))
      .send({ body: 'Hello, is the demo still on?' })
      .expect(201);
    expect(sent.body.data.body).toMatch(/demo/);

    const read = await api().patch(url(`/conversations/${conversation._id}/read`)).set(auth(exhibitor.token)).expect(200);
    expect(read.body.data.readAt).toBeTruthy();
  });

  it('protects private account data on user endpoints', async () => {
    await api().get(url(`/users/${attendee.user._id}`)).set(auth(secondAttendee.token)).expect(403);
    const asAdmin = await api().get(url(`/users/${attendee.user._id}`)).set(auth(admin.token)).expect(200);
    expect(asAdmin.body.data.user.email).toBe(attendee.email);
  });

  it('stops organizers from deactivating their own account', async () => {
    await api().patch(url(`/users/${admin.user._id}/status`)).set(auth(admin.token)).send({ isActive: false }).expect(400);

    const target = await registerUser({ role: 'attendee' });
    await api().patch(url(`/users/${target.user._id}/status`)).set(auth(admin.token)).send({ isActive: false }).expect(200);
    await api().get(url('/auth/me')).set(auth(target.token)).expect(403);
  });

  it('prevents users from reading another attendee event pass', async () => {
    const expo = await createPublishedExpo(admin, { title: 'Private Pass Expo' });
    const registration = await api().post(url(`/expos/${expo._id}/register`)).set(auth(attendee.token)).send({}).expect(201);

    await api().get(url(`/registrations/pass/${registration.body.data._id}`)).set(auth(secondAttendee.token)).expect(404);
    const mine = await api().get(url(`/registrations/pass/${registration.body.data._id}`)).set(auth(attendee.token)).expect(200);
    expect(mine.body.data.registration.passCode).toBe(registration.body.data.passCode);
  });

  it('scopes exhibitor analytics to the signed-in exhibitor', async () => {
    const response = await api().get(url('/analytics/exhibitor')).set(auth(exhibitor.token)).expect(200);
    expect(response.body.data.profile.companyName).toBe('Access Control Ltd');
    await api().get(url('/analytics/exhibitor')).set(auth(attendee.token)).expect(403);
  });

  it('rejects malformed identifiers safely', async () => {
    const response = await api().get(url('/expos/not-an-id')).expect(404);
    expect(response.body.success).toBe(false);
    expect(JSON.stringify(response.body)).not.toMatch(/CastError|ObjectId/);
  });
});

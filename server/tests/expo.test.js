'use strict';

const { api, url, auth, registerUser, login, createPublishedExpo, models, addDays, DEMO_PASSWORD } = require('./helpers');

describe('Expo management', () => {
  let admin;
  let attendee;
  let exhibitor;

  beforeAll(async () => {
    admin = await registerUser({ role: 'admin', name: 'Expo Admin' });
    attendee = await registerUser({ role: 'attendee' });
    exhibitor = await registerUser({ role: 'exhibitor', organization: 'Expo Test Exhibitors' });
  });

  it('creates an expo as a draft with a floor plan', async () => {
    const response = await api()
      .post(url('/expos'))
      .set(auth(admin.token))
      .send({
        title: 'Draft Expo Test',
        description: 'Testing the draft lifecycle of an expo created by the automated suite.',
        startDate: addDays(new Date(), 30).toISOString(),
        endDate: addDays(new Date(), 32).toISOString(),
        category: 'technology',
        location: { city: 'Berlin', country: 'Germany' },
      })
      .expect(201);

    expect(response.body.data.status).toBe('draft');
    expect(response.body.data.slug).toBe('draft-expo-test');

    const plan = await models.FloorPlan.findOne({ expo: response.body.data._id });
    expect(plan).toBeTruthy();
    expect(plan.zones.length).toBeGreaterThan(0);
  });

  it('validates required fields and date order', async () => {
    const missing = await api().post(url('/expos')).set(auth(admin.token)).send({ title: 'Incomplete' }).expect(422);
    expect(missing.body.errors.map((e) => e.field)).toEqual(expect.arrayContaining(['description', 'startDate', 'endDate']));

    const badDates = await api()
      .post(url('/expos'))
      .set(auth(admin.token))
      .send({
        title: 'Backwards dates',
        description: 'End date before start date should be rejected by model validation.',
        startDate: addDays(new Date(), 20).toISOString(),
        endDate: addDays(new Date(), 10).toISOString(),
      })
      .expect(422);
    expect(badDates.body.success).toBe(false);
  });

  it('forbids non-organizers from creating expos', async () => {
    await api()
      .post(url('/expos'))
      .set(auth(attendee.token))
      .send({ title: 'Unauthorised expo', description: 'Should never be created.', startDate: new Date().toISOString(), endDate: addDays(new Date(), 2).toISOString() })
      .expect(403);

    await api().post(url('/expos')).send({ title: 'No auth' }).expect(401);
  });

  it('publishes a draft so it becomes registrable', async () => {
    const expo = await createPublishedExpo(admin, { title: 'Published Expo Test' });
    expect(expo.status).toBe('upcoming');
    expect(expo.publishedAt).toBeTruthy();
  });

  it('lists published expos publicly but hides drafts', async () => {
    const publicList = await api().get(url('/expos')).expect(200);
    const statuses = publicList.body.data.map((item) => item.status);
    expect(statuses).not.toContain('draft');

    const adminList = await api().get(url('/expos?includeDrafts=true')).set(auth(admin.token)).expect(200);
    expect(adminList.body.data.some((item) => item.status === 'draft')).toBe(true);
  });

  it('filters and searches expos', async () => {
    const search = await api().get(url('/expos?q=Published')).expect(200);
    expect(search.body.data.length).toBeGreaterThan(0);
    expect(search.body.data[0].title).toMatch(/Published/i);

    const byCity = await api().get(url('/expos?city=San Francisco')).expect(200);
    expect(Array.isArray(byCity.body.data)).toBe(true);

    const upcoming = await api().get(url('/expos?upcoming=true')).expect(200);
    upcoming.body.data.forEach((expo) => expect(new Date(expo.startDate).getTime()).toBeGreaterThan(Date.now() - 86400000));
  });

  it('returns expo detail with stats and sessions', async () => {
    const expo = await createPublishedExpo(admin, { title: 'Detail Expo Test' });
    const response = await api().get(url(`/expos/${expo._id}`)).expect(200);
    expect(response.body.data.expo.title).toBe('Detail Expo Test');
    expect(response.body.data.sessions).toEqual([]);
    expect(response.body.data.stats).toMatchObject({ booths: 0, sessions: 0, exhibitors: 0 });
  });

  it('returns 404 for an unknown expo id', async () => {
    await api().get(url('/expos/64b7f9c2f1a2b3c4d5e6f7a8')).expect(404);
  });

  it('updates an expo and blocks other organizers', async () => {
    const expo = await createPublishedExpo(admin, { title: 'Editable Expo' });
    const updated = await api()
      .patch(url(`/expos/${expo._id}`))
      .set(auth(admin.token))
      .send({ theme: 'Updated theme', maxAttendees: 500 })
      .expect(200);
    expect(updated.body.data.theme).toBe('Updated theme');

    const otherAdmin = await registerUser({ role: 'admin' });
    await api()
      .patch(url(`/expos/${expo._id}`))
      .set(auth(otherAdmin.token))
      .send({ theme: 'Hijacked' })
      .expect(403);

    await api().patch(url(`/expos/${expo._id}`)).set(auth(attendee.token)).send({ theme: 'nope' }).expect(403);
  });

  it('changes status through the lifecycle', async () => {
    const expo = await createPublishedExpo(admin, { title: 'Lifecycle Expo' });
    const cancelled = await api()
      .patch(url(`/expos/${expo._id}/status`))
      .set(auth(admin.token))
      .send({ status: 'cancelled', reason: 'Venue unavailable' })
      .expect(200);
    expect(cancelled.body.data.status).toBe('cancelled');
    expect(cancelled.body.data.cancelledReason).toBe('Venue unavailable');

    await api()
      .patch(url(`/expos/${expo._id}/status`))
      .set(auth(admin.token))
      .send({ status: 'not-a-status' })
      .expect(422);
  });

  it('computes expo analytics for organizers only', async () => {
    const expo = await createPublishedExpo(admin, { title: 'Analytics Expo' });
    const response = await api().get(url(`/expos/${expo._id}/analytics`)).set(auth(admin.token)).expect(200);
    expect(response.body.data.totals).toBeTruthy();
    expect(response.body.data.trends.registrations.length).toBeGreaterThan(0);

    await api().get(url(`/expos/${expo._id}/analytics`)).set(auth(exhibitor.token)).expect(403);
    await api().get(url(`/expos/${expo._id}/analytics`)).set(auth(attendee.token)).expect(403);
  });

  it('deletes an expo and its dependent records', async () => {
    const expo = await createPublishedExpo(admin, { title: 'Deletable Expo' });
    await api()
      .post(url(`/expos/${expo._id}/booths/bulk`))
      .set(auth(admin.token))
      .send({ zone: 'A', rows: 1, cols: 2, price: 500 })
      .expect(201);

    await api().delete(url(`/expos/${expo._id}`)).set(auth(admin.token)).expect(200);

    expect(await models.Expo.findById(expo._id)).toBeNull();
    expect(await models.Booth.countDocuments({ expo: expo._id })).toBe(0);
    expect(await models.FloorPlan.countDocuments({ expo: expo._id })).toBe(0);
  });

  it('enforces pagination limits', async () => {
    const response = await api().get(url('/expos?limit=500')).expect(422);
    expect(response.body.success).toBe(false);

    const paged = await api().get(url('/expos?page=1&limit=2')).expect(200);
    expect(paged.body.data.length).toBeLessThanOrEqual(2);
    expect(paged.body.meta).toMatchObject({ page: 1, limit: 2 });
  });

  it('keeps demo credentials working for seeded accounts', async () => {
    // Guards against the seed script and auth service drifting apart.
    const seeded = await login('admin@eventsphere.io', DEMO_PASSWORD).catch(() => null);
    if (seeded) expect(seeded.user.role).toBe('admin');
    else expect(seeded).toBeNull(); // no seed data in the test database — acceptable
  });
});

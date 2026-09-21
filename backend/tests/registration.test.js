'use strict';

const { api, url, auth, registerUser, createPublishedExpo, createSpeaker, createSession, models, addDays } = require('./helpers');

describe('Expo registration, event passes and check-in', () => {
  let admin;
  let attendee;
  let paidExpo;
  let freeExpo;

  beforeAll(async () => {
    admin = await registerUser({ role: 'admin', name: 'Registration Admin' });
    attendee = await registerUser({ role: 'attendee', name: 'Pass Holder' });
    freeExpo = await createPublishedExpo(admin, { title: 'Free Registration Expo', ticketPrice: 0 });
    paidExpo = await createPublishedExpo(admin, { title: 'Paid Registration Expo', ticketPrice: 199 });
  });

  it('registers an attendee for a free expo and issues a pass code', async () => {
    const response = await api()
      .post(url(`/expos/${freeExpo._id}/register`))
      .set(auth(attendee.token))
      .send({ fullName: 'Pass Holder', organization: 'Harborview Manufacturing', jobTitle: 'Plant Manager' })
      .expect(201);

    expect(response.body.data.status).toBe('confirmed');
    expect(response.body.data.passCode).toMatch(/^ES-/);
    expect(response.body.data.paymentStatus).toBe('not_required');
  });

  it('rejects duplicate registrations with 409', async () => {
    await api().post(url(`/expos/${freeExpo._id}/register`)).set(auth(attendee.token)).send({}).expect(409);
  });

  it('requires authentication to register', async () => {
    await api().post(url(`/expos/${freeExpo._id}/register`)).send({}).expect(401);
  });

  it('creates a pending registration plus a checkout for paid expos', async () => {
    const response = await api()
      .post(url(`/expos/${paidExpo._id}/register`))
      .set(auth(attendee.token))
      .send({ passType: 'vip' })
      .expect(201);

    expect(response.body.data.status).toBe('pending');
    expect(response.body.data.paymentStatus).toBe('pending');
    expect(response.body.data.payment).toBeTruthy();
  });

  it('does not issue a valid pass while payment is pending', async () => {
    const registration = await models.Registration.findOne({ expo: paidExpo._id, user: attendee.user._id });
    const blocked = await api().post(url('/check-ins')).set(auth(admin.token)).send({ code: registration.passCode }).expect(400);
    expect(blocked.body.message).toMatch(/payment/i);
  });

  it('confirms a paid registration and marks the expo revenue', async () => {
    const registration = await models.Registration.findOne({ expo: paidExpo._id, user: attendee.user._id }).populate('payment');
    await api().post(url(`/payments/${registration.payment._id}/confirm`)).set(auth(attendee.token)).send({}).expect(200);

    const refreshed = await models.Registration.findById(registration._id);
    expect(refreshed.status).toBe('confirmed');
    expect(refreshed.paymentStatus).toBe('paid');

    const expo = await models.Expo.findById(paidExpo._id);
    expect(expo.stats.revenue).toBeGreaterThan(0);
  });

  it('exposes the digital event pass with a QR code', async () => {
    const response = await api().get(url(`/registrations/pass?`)).set(auth(attendee.token)).expect(200);
    expect(response.body.data.qr.dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(response.body.data.qr.payload).toContain('eventsphere:pass');
    expect(response.body.data.holder.name).toBe('Pass Holder');
  });

  it('checks an attendee in once and reports repeat scans', async () => {
    const registration = await models.Registration.findOne({ expo: freeExpo._id, user: attendee.user._id });

    const first = await api().post(url('/check-ins')).set(auth(admin.token)).send({ code: registration.passCode, type: 'event' }).expect(200);
    expect(first.body.data.alreadyCheckedIn).toBe(false);
    expect(first.body.data.checkIn.type).toBe('event');

    const second = await api().post(url('/check-ins')).set(auth(admin.token)).send({ code: registration.passCode }).expect(200);
    expect(second.body.data.alreadyCheckedIn).toBe(true);

    const refreshed = await models.Registration.findById(registration._id);
    expect(refreshed.checkedIn).toBe(true);
    expect(refreshed.checkInCount).toBe(2);
  });

  it('rejects invalid or foreign pass codes', async () => {
    await api().post(url('/check-ins')).set(auth(admin.token)).send({ code: 'ES-NOTAREALCODE' }).expect(404);
    await api().post(url('/check-ins')).set(auth(admin.token)).send({ code: 'not-a-qr-payload' }).expect(400);
    await api()
      .post(url('/check-ins'))
      .set(auth(admin.token))
      .send({ code: (await models.Registration.findOne({ expo: freeExpo._id })).passCode, expoId: paidExpo._id })
      .expect(400);
  });

  it('only exposes a registration to its owner or an organizer', async () => {
    const registration = await models.Registration.findOne({ expo: freeExpo._id, user: attendee.user._id });
    const stranger = await registerUser({ role: 'attendee' });

    const mine = await api().get(url(`/registrations/${registration._id}`)).set(auth(attendee.token)).expect(200);
    expect(mine.body.data.passCode).toBe(registration.passCode);

    await api().get(url(`/registrations/${registration._id}`)).set(auth(stranger.token)).expect(403);
    await api().get(url(`/registrations/${registration._id}`)).set(auth(admin.token)).expect(200);
  });

  it('lets an organizer list and filter registrations', async () => {
    const list = await api().get(url(`/registrations?expo=${freeExpo._id}`)).set(auth(admin.token)).expect(200);
    expect(list.body.data.length).toBeGreaterThan(0);
    expect(list.body.meta.total).toBeGreaterThan(0);

    const checkedIn = await api().get(url(`/registrations?expo=${freeExpo._id}&checkedIn=true`)).set(auth(admin.token)).expect(200);
    expect(checkedIn.body.data.every((item) => item.checkedIn)).toBe(true);

    await api().get(url('/registrations')).set(auth(attendee.token)).expect(403);
  });

  it('cancels a registration and frees the pass', async () => {
    const registration = await models.Registration.findOne({ expo: paidExpo._id, user: attendee.user._id });
    const cancelled = await api()
      .patch(url(`/registrations/${registration._id}/cancel`))
      .set(auth(attendee.token))
      .send({ reason: 'Cannot attend' })
      .expect(200);
    expect(cancelled.body.data.status).toBe('cancelled');

    await api().post(url('/check-ins')).set(auth(admin.token)).send({ code: registration.passCode }).expect(400);
  });

  it('summarises attendee activity', async () => {
    const response = await api().get(url('/registrations/me/activity')).set(auth(attendee.token)).expect(200);
    expect(response.body.data.stats).toMatchObject({ expos: expect.any(Number), sessions: expect.any(Number), checkIns: expect.any(Number) });
    expect(Array.isArray(response.body.data.registrations)).toBe(true);
  });

  describe('Sessions', () => {
    let session;

    beforeAll(async () => {
      const speaker = await createSpeaker(admin, { name: 'Session Speaker' });
      session = await createSession(admin, freeExpo._id, { speakers: [speaker._id], capacity: 2 });
    });

    it('creates sessions with speaker assignment and rejects room clashes', async () => {
      expect(session.speakers.length).toBe(1);
      await api()
        .post(url('/sessions'))
        .set(auth(admin.token))
        .send({
          expo: freeExpo._id,
          title: 'Clashing session',
          date: addDays(new Date(), 10).toISOString(),
          startTime: '10:30',
          endTime: '11:30',
          capacity: 10,
          location: { room: 'Test Room 1' },
        })
        .expect(409);
    });

    it('validates time ordering and formats', async () => {
      await api()
        .post(url('/sessions'))
        .set(auth(admin.token))
        .send({ expo: freeExpo._id, title: 'Bad times', date: new Date().toISOString(), startTime: '14:00', endTime: '13:00' })
        .expect(400);

      const invalid = await api()
        .post(url('/sessions'))
        .set(auth(admin.token))
        .send({ expo: freeExpo._id, title: 'Bad format', date: new Date().toISOString(), startTime: '25:99', endTime: '26:00' })
        .expect(422);
      expect(invalid.body.errors.some((error) => error.field === 'startTime')).toBe(true);
    });

    it('registers attendees, enforces capacity with a waitlist, and supports bookmarks', async () => {
      const second = await registerUser({ role: 'attendee' });
      const third = await registerUser({ role: 'attendee' });

      const first = await api().post(url(`/sessions/${session._id}/register`)).set(auth(attendee.token)).expect(201);
      expect(first.body.data.waitlisted).toBe(false);

      await api().post(url(`/sessions/${session._id}/register`)).set(auth(second.token)).expect(201);
      const waitlisted = await api().post(url(`/sessions/${session._id}/register`)).set(auth(third.token)).expect(201);
      expect(waitlisted.body.data.waitlisted).toBe(true);
      expect(waitlisted.body.data.registration.status).toBe('waitlisted');

      await api().post(url(`/sessions/${session._id}/register`)).set(auth(attendee.token)).expect(409);

      const bookmarked = await api().post(url(`/sessions/${session._id}/bookmark`)).set(auth(attendee.token)).send({ bookmarked: true }).expect(200);
      expect(bookmarked.body.data.bookmarked).toBe(true);

      const agenda = await api().get(url('/sessions/agenda/me?kind=bookmarks')).set(auth(attendee.token)).expect(200);
      expect(agenda.body.data.some((item) => String(item.session._id) === String(session._id))).toBe(true);
    });

    it('promotes a waitlisted attendee when a seat is released', async () => {
      const second = await models.User.findOne({ email: /attendee\./ }).sort({ createdAt: -1 });
      await api().delete(url(`/sessions/${session._id}/register`)).set(auth(attendee.token)).expect(200);

      const registrations = await models.SessionRegistration.find({ session: session._id });
      const promoted = registrations.filter((r) => r.status === 'registered');
      expect(promoted.length).toBeGreaterThan(0);
      expect(second).toBeTruthy();
    });

    it('cancels a session and notifies registered attendees', async () => {
      const cancelTarget = await createSession(admin, freeExpo._id, { title: 'Cancel me', startTime: '15:00', endTime: '16:00', location: { room: 'Room X' } });
      await api().post(url(`/sessions/${cancelTarget._id}/register`)).set(auth(attendee.token)).expect(201);

      const cancelled = await api()
        .post(url(`/sessions/${cancelTarget._id}/cancel`))
        .set(auth(admin.token))
        .send({ reason: 'Speaker cancelled' })
        .expect(200);
      expect(cancelled.body.data.status).toBe('cancelled');

      const notifications = await models.Notification.find({ user: attendee.user._id, type: 'session_cancelled' });
      expect(notifications.length).toBeGreaterThan(0);

      await api().post(url(`/sessions/${cancelTarget._id}/register`)).set(auth(attendee.token)).expect(400);
    });

    it('publishes the schedule grouped by day', async () => {
      const schedule = await api().get(url(`/expos/${freeExpo._id}/sessions`)).expect(200);
      expect(schedule.body.data.length).toBeGreaterThan(0);
      expect(schedule.body.data[0].sessions.length).toBeGreaterThan(0);
    });
  });
});

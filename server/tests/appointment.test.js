'use strict';

const { api, url, auth, registerUser, createPublishedExpo, approveApplication, createBooths, models, addDays } = require('./helpers');

describe('Appointments between attendees and exhibitors', () => {
  let admin;
  let exhibitor;
  let otherExhibitor;
  let attendee;
  let expo;
  let slots;

  beforeAll(async () => {
    admin = await registerUser({ role: 'admin' });
    exhibitor = await registerUser({ role: 'exhibitor', organization: 'Appointment Robotics' });
    otherExhibitor = await registerUser({ role: 'exhibitor', organization: 'Appointment Energy' });
    attendee = await registerUser({ role: 'attendee', name: 'Meeting Booker' });
    expo = await createPublishedExpo(admin, { title: 'Appointment Expo' });

    const booths = await createBooths(admin, expo._id, { zone: 'A', rows: 1, cols: 2, price: 0 });
    const application = await api()
      .post(url('/exhibitors/me/applications'))
      .set(auth(exhibitor.token))
      .send({ expoId: expo._id, boothPreferences: { size: 'medium' } })
      .expect(201);
    await approveApplication(admin, application.body.data._id);

    // Give the exhibitor a booth so appointments can point attendees to it.
    const profile = await models.ExhibitorProfile.findOne({ user: exhibitor.user._id });
    await api().post(url(`/booths/${booths[0]._id}/assign`)).set(auth(admin.token)).send({ exhibitorId: profile._id }).expect(200);
  });

  it('publishes a day of availability as fixed-length slots', async () => {
    const date = addDays(new Date(), 10).toISOString();
    const response = await api()
      .post(url('/availability-slots'))
      .set(auth(exhibitor.token))
      .send({ expo: expo._id, dates: [date], startTime: '09:00', endTime: '11:00', durationMinutes: 30, location: 'Booth A-01' })
      .expect(201);

    expect(response.body.data.created).toBe(4);
    expect(response.body.data.slots[0]).toMatchObject({ startTime: '09:00', endTime: '09:30', durationMinutes: 30, status: 'open' });
    slots = response.body.data.slots;
  });

  it('validates the availability window and duration', async () => {
    await api()
      .post(url('/availability-slots'))
      .set(auth(exhibitor.token))
      .send({ expo: expo._id, date: addDays(new Date(), 11).toISOString(), startTime: '15:00', endTime: '14:00' })
      .expect(400);

    const invalid = await api()
      .post(url('/availability-slots'))
      .set(auth(exhibitor.token))
      .send({ expo: expo._id, date: addDays(new Date(), 11).toISOString(), startTime: '9am', endTime: '10am' })
      .expect(422);
    expect(invalid.body.errors.some((error) => error.field === 'startTime')).toBe(true);
  });

  it('only lets exhibitors publish availability', async () => {
    await api()
      .post(url('/availability-slots'))
      .set(auth(attendee.token))
      .send({ expo: expo._id, date: addDays(new Date(), 10).toISOString(), startTime: '09:00', endTime: '10:00' })
      .expect(403);
  });

  it('lists open slots publicly so attendees can browse calendars', async () => {
    const open = await api().get(url(`/availability-slots?exhibitorUser=${exhibitor.user._id}&availableOnly=true`)).expect(200);
    expect(open.body.data.length).toBeGreaterThanOrEqual(4);
    expect(open.body.data.every((slot) => slot.status === 'open')).toBe(true);
  });

  it('books an appointment and notifies the exhibitor', async () => {
    const response = await api()
      .post(url('/appointments'))
      .set(auth(attendee.token))
      .send({ slotId: slots[0]._id, topic: 'Fleet sizing for our Chicago warehouse', agenda: 'Need throughput numbers and pricing.' })
      .expect(201);

    expect(response.body.data.status).toBe('pending');
    expect(response.body.data.reference).toMatch(/^APT-/);
    expect(response.body.data.location.boothNumber).toBe('A-01');

    const slot = await models.AvailabilitySlot.findById(slots[0]._id);
    expect(slot.status).toBe('booked');

    const notifications = await models.Notification.find({ user: exhibitor.user._id, type: 'appointment_requested' });
    expect(notifications.length).toBe(1);
  });

  it('prevents double booking the same slot', async () => {
    const other = await registerUser({ role: 'attendee' });
    await api().post(url('/appointments')).set(auth(other.token)).send({ slotId: slots[0]._id, topic: 'Second attempt' }).expect(409);
  });

  it('rejects bookings from exhibitors and for missing topics', async () => {
    await api().post(url('/appointments')).set(auth(exhibitor.token)).send({ slotId: slots[1]._id, topic: 'Self booking' }).expect(403);
    await api().post(url('/appointments')).set(auth(attendee.token)).send({ slotId: slots[1]._id }).expect(422);
  });

  it('lets the exhibitor confirm the appointment and notifies the attendee', async () => {
    const appointment = await models.Appointment.findOne({ attendee: attendee.user._id, status: 'pending' });
    const response = await api()
      .patch(url(`/appointments/${appointment._id}/respond`))
      .set(auth(exhibitor.token))
      .send({ status: 'confirmed', note: 'See you at booth A-01, please arrive 5 minutes early.' })
      .expect(200);

    expect(response.body.data.status).toBe('confirmed');
    expect(response.body.data.respondedAt).toBeTruthy();

    const notifications = await models.Notification.find({ user: attendee.user._id, type: 'appointment_confirmed' });
    expect(notifications.length).toBeGreaterThan(0);
  });

  it('blocks an unrelated user from responding or reading the appointment', async () => {
    const appointment = await models.Appointment.findOne({ attendee: attendee.user._id });
    const stranger = await registerUser({ role: 'attendee' });

    await api().get(url(`/appointments/${appointment._id}`)).set(auth(stranger.token)).expect(403);
    await api().patch(url(`/appointments/${appointment._id}/respond`)).set(auth(stranger.token)).send({ status: 'confirmed' }).expect(403);
    await api().patch(url(`/appointments/${appointment._id}/respond`)).set(auth(otherExhibitor.token)).send({ status: 'confirmed' }).expect(403);
  });

  it('prevents a second active appointment with the same exhibitor on the same day', async () => {
    await api().post(url('/appointments')).set(auth(attendee.token)).send({ slotId: slots[2]._id, topic: 'Another meeting same day' }).expect(409);
  });

  it('completes a confirmed appointment', async () => {
    const appointment = await models.Appointment.findOne({ attendee: attendee.user._id, status: 'confirmed' });
    const response = await api()
      .patch(url(`/appointments/${appointment._id}/complete`))
      .set(auth(exhibitor.token))
      .send({ meetingNotes: 'Requested a quotation for 8 units.' })
      .expect(200);
    expect(response.body.data.status).toBe('completed');
    expect(response.body.data.meetingNotes).toMatch(/quotation/i);
  });

  it('cancels an appointment, frees the slot and notifies the other party', async () => {
    const second = await registerUser({ role: 'attendee' });
    const booked = await api().post(url('/appointments')).set(auth(second.token)).send({ slotId: slots[1]._id, topic: 'Cancel me' }).expect(201);

    const response = await api()
      .patch(url(`/appointments/${booked.body.data._id}/cancel`))
      .set(auth(second.token))
      .send({ reason: 'Flight cancelled' })
      .expect(200);
    expect(response.body.data.status).toBe('cancelled');

    const slot = await models.AvailabilitySlot.findById(slots[1]._id);
    expect(slot.status).toBe('open');
  });

  it('lists appointments per role and exposes a calendar', async () => {
    const attendeeList = await api().get(url('/appointments')).set(auth(attendee.token)).expect(200);
    expect(attendeeList.body.data.every((item) => String(item.attendee._id) === String(attendee.user._id))).toBe(true);

    const exhibitorList = await api().get(url('/appointments')).set(auth(exhibitor.token)).expect(200);
    expect(exhibitorList.body.data.every((item) => String(item.exhibitorUser._id) === String(exhibitor.user._id))).toBe(true);
    expect(exhibitorList.body.meta.statusCounts).toBeTruthy();

    const calendar = await api().get(url('/appointments/calendar')).set(auth(exhibitor.token)).expect(200);
    expect(Array.isArray(calendar.body.data)).toBe(true);

    const adminStats = await api().get(url('/appointments/stats')).set(auth(admin.token)).expect(200);
    expect(adminStats.body.data.total).toBeGreaterThan(0);
    await api().get(url('/appointments/stats')).set(auth(attendee.token)).expect(403);
  });

  it('lets exhibitors edit and delete unbooked slots', async () => {
    const open = await models.AvailabilitySlot.findOne({ exhibitorUser: exhibitor.user._id, status: 'open' });
    const updated = await api()
      .patch(url(`/availability-slots/${open._id}`))
      .set(auth(exhibitor.token))
      .send({ location: 'Booth A-01, meeting table 2' })
      .expect(200);
    expect(updated.body.data.location).toMatch(/table 2/);

    await api().delete(url(`/availability-slots/${open._id}`)).set(auth(exhibitor.token)).expect(200);
  });
});

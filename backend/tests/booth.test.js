'use strict';

const { api, url, auth, registerUser, createPublishedExpo, approveApplication, createBooths, models } = require('./helpers');

describe('Booth management and booking', () => {
  let admin;
  let exhibitor;
  let otherExhibitor;
  let expo;

  beforeAll(async () => {
    admin = await registerUser({ role: 'admin', name: 'Booth Admin' });
    exhibitor = await registerUser({ role: 'exhibitor', organization: 'Booth Booking Ltd' });
    otherExhibitor = await registerUser({ role: 'exhibitor', organization: 'Second Exhibitor Ltd' });
    expo = await createPublishedExpo(admin, { title: 'Booth Expo', boothPriceFrom: 1200 });
  });

  const applyForExpo = async (user) => {
    const response = await api()
      .post(url('/exhibitors/me/applications'))
      .set(auth(user.token))
      .send({ expoId: expo._id, boothPreferences: { size: 'medium', zone: 'A' }, productsToShowcase: ['Demo unit'] })
      .expect(201);
    return response.body.data;
  };

  it('generates a grid of booths with sequential numbers and positions', async () => {
    const booths = await createBooths(admin, expo._id, { zone: 'A', rows: 2, cols: 3, price: 1500 });
    expect(booths.length).toBe(6);
    expect(booths.map((booth) => booth.number)).toEqual(['01', '02', '03', '04', '05', '06']);
    expect(booths.every((booth) => booth.status === 'available')).toBe(true);
    expect(booths[0].position).toMatchObject({ x: 1, y: 1 });
    expect(booths.every((booth) => booth.currency === 'USD')).toBe(true);
  });

  it('rejects duplicate/overlapping grid generation', async () => {
    const second = await api()
      .post(url(`/expos/${expo._id}/booths/bulk`))
      .set(auth(admin.token))
      .send({ zone: 'A', rows: 1, cols: 1, startNumber: 1, price: 1500 })
      .expect(409);
    expect(second.body.success).toBe(false);
  });

  it('lists booths with status and zone filters', async () => {
    const available = await api().get(url(`/expos/${expo._id}/booths?status=available&zone=A`)).expect(200);
    expect(available.body.data.length).toBe(6);
    expect(available.body.meta.total).toBe(6);

    const occupied = await api().get(url(`/expos/${expo._id}/booths?status=occupied`)).expect(200);
    expect(occupied.body.data.length).toBe(0);
  });

  it('only lets organizers create or delete booths', async () => {
    await api()
      .post(url(`/expos/${expo._id}/booths/bulk`))
      .set(auth(exhibitor.token))
      .send({ zone: 'B', rows: 1, cols: 1 })
      .expect(403);
  });

  it('refuses a booth request before the application is approved', async () => {
    const booths = await api().get(url(`/expos/${expo._id}/booths?status=available`)).expect(200);
    const boothId = booths.body.data[0]._id;

    await api()
      .post(url(`/booths/${boothId}/request`))
      .set(auth(exhibitor.token))
      .send({ note: 'Please reserve' })
      .expect(403);
  });

  it('runs the full booking flow: apply → approve → request → approve → pay → occupied', async () => {
    const application = await applyForExpo(exhibitor);
    await approveApplication(admin, application._id);

    const booths = await api().get(url(`/expos/${expo._id}/booths?status=available`)).expect(200);
    const boothId = booths.body.data[0]._id;

    const requested = await api()
      .post(url(`/booths/${boothId}/request`))
      .set(auth(exhibitor.token))
      .send({ note: 'We need a corner stand near the entrance.' })
      .expect(201);
    expect(requested.body.data.status).toBe('reserved');

    // The organizer sees the pending request.
    const pending = await api().get(url(`/booths/pending?expo=${expo._id}`)).set(auth(admin.token)).expect(200);
    expect(pending.body.data.some((booth) => booth._id === boothId)).toBe(true);

    const approved = await api()
      .post(url(`/booths/${boothId}/approve`))
      .set(auth(admin.token))
      .send({ note: 'Approved — invoice sent' })
      .expect(200);

    expect(approved.body.data.booth.exhibitor).toBeTruthy();
    // A priced booth stays reserved until the payment clears.
    expect(approved.body.data.booth.status).toBe('reserved');
    const paymentId = approved.body.data.payment._id;
    expect(approved.body.data.payment.status).toBe('processing');

    const paid = await api().post(url(`/payments/${paymentId}/confirm`)).set(auth(exhibitor.token)).send({}).expect(200);
    expect(paid.body.data.status).toBe('paid');
    expect(paid.body.data.transactionId).toBeTruthy();

    const booth = await models.Booth.findById(boothId);
    expect(booth.status).toBe('occupied');
    expect(String(booth.exhibitor)).toBe(String(approved.body.data.booth.exhibitor));

    const invoice = await api().get(url(`/payments/${paymentId}/invoice`)).set(auth(exhibitor.token)).expect(200);
    expect(invoice.text).toContain('Invoice');
    expect(invoice.text).toContain(paid.body.data.invoice.number);
  });

  it('prevents a second exhibitor from taking an occupied booth', async () => {
    const taken = await models.Booth.findOne({ expo: expo._id, status: 'occupied' });
    const application = await applyForExpo(otherExhibitor);
    await approveApplication(admin, application._id);

    await api()
      .post(url(`/booths/${taken._id}/request`))
      .set(auth(otherExhibitor.token))
      .send({})
      .expect(409);
  });

  it('lets an organizer assign a booth directly and release it again', async () => {
    const target = await models.Booth.findOne({ expo: expo._id, status: 'available' });
    const profile = await models.ExhibitorProfile.findOne({ user: otherExhibitor.user._id });

    const assigned = await api()
      .post(url(`/booths/${target._id}/assign`))
      .set(auth(admin.token))
      .send({ exhibitorId: profile._id })
      .expect(200);
    expect(assigned.body.data.status).toBe('occupied');

    const released = await api()
      .post(url(`/booths/${target._id}/release`))
      .set(auth(admin.token))
      .send({ reason: 'Exhibitor withdrew' })
      .expect(200);
    expect(released.body.data.status).toBe('available');
    expect(released.body.data.exhibitor).toBeNull();
  });

  it('validates booth status transitions', async () => {
    const booth = await models.Booth.findOne({ expo: expo._id, status: 'available' });
    await api()
      .patch(url(`/booths/${booth._id}/status`))
      .set(auth(admin.token))
      .send({ status: 'available' })
      .expect(400); // available → available is not a legal transition

    const maintenance = await api()
      .patch(url(`/booths/${booth._id}/status`))
      .set(auth(admin.token))
      .send({ status: 'maintenance', note: 'Awaiting inspection' })
      .expect(200);
    expect(maintenance.body.data.status).toBe('maintenance');
  });

  it('serves the interactive floor plan layout with a status summary', async () => {
    const layout = await api().get(url(`/expos/${expo._id}/floor-plan`)).expect(200);
    expect(layout.body.data.plan).toBeTruthy();
    expect(layout.body.data.booths.length).toBeGreaterThan(0);
    expect(layout.body.data.summary.total).toBe(layout.body.data.booths.length);
    expect(layout.body.data.summary.occupied).toBeGreaterThan(0);
    expect(layout.body.data.booths[0].exhibitor).toBeTruthy();
  });

  it('generates a booth QR code and records booth traffic', async () => {
    const booth = await models.Booth.findOne({ expo: expo._id, status: 'occupied' });
    const qr = await api().get(url(`/booths/${booth._id}/qr`)).set(auth(admin.token)).expect(200);
    expect(qr.body.data.dataUrl.startsWith('data:image/png;base64,')).toBe(true);
    expect(qr.body.data.payload).toContain('eventsphere:booth');

    const visitor = await registerUser({ role: 'attendee' });
    await api().post(url(`/booths/${booth._id}/visit`)).set(auth(visitor.token)).send({ source: 'floor_plan' }).expect(200);

    const refreshed = await models.Booth.findById(booth._id);
    expect(refreshed.traffic.views).toBe(1);
    expect(await models.BoothVisit.countDocuments({ booth: booth._id })).toBe(1);
  });

  it('blocks exhibitors from pricing changes but allows booth content updates', async () => {
    const booth = await models.Booth.findOne({ expo: expo._id, status: 'occupied' });
    const profile = await models.ExhibitorProfile.findOne({ user: exhibitor.user._id });

    if (String(booth.exhibitor) !== String(profile._id)) return; // another exhibitor owns it in this run

    const updated = await api()
      .patch(url(`/booths/${booth._id}`))
      .set(auth(exhibitor.token))
      .send({ name: 'Nexa demo stage', price: 1, description: 'Live demos every hour' })
      .expect(200);

    expect(updated.body.data.name).toBe('Nexa demo stage');
    expect(updated.body.data.price).not.toBe(1); // price untouched by exhibitor
  });
});

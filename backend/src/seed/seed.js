'use strict';

const mongoose = require('mongoose');
const models = require('../models');
const {
  User,
  AttendeeProfile,
  ExhibitorProfile,
  Expo,
  ExpoApplication,
  Booth,
  FloorPlan,
  Speaker,
  Session,
  Product,
  Registration,
  SessionRegistration,
  AvailabilitySlot,
  Appointment,
  Conversation,
  Message,
  Notification,
  Payment,
  Review,
  Feedback,
  SupportTicket,
  CheckIn,
  Announcement,
  BoothVisit,
} = models;

const logger = require('../utils/logger');
const { addDays, startOfDay, humanCode } = require('../utils/helpers');
const expoService = require('../services/expoService');
const boothService = require('../services/boothService');
const invoiceService = require('../services/invoiceService');
const data = require('./data');

const ALL_COLLECTIONS = [
  Expo, ExpoApplication, FloorPlan, Booth, Session, Speaker, Product, Registration, SessionRegistration,
  AvailabilitySlot, Appointment, Conversation, Message, Notification, Payment, Review, Feedback,
  SupportTicket, CheckIn, Announcement, BoothVisit, AttendeeProfile, ExhibitorProfile, User,
];

const pick = (dayOffset, hour = 9, minute = 0) => {
  const date = startOfDay(addDays(new Date(), dayOffset));
  date.setUTCHours(hour, minute, 0, 0);
  return date;
};

const daysAgo = (days, hour = 10) => pick(-days, hour, Math.abs(days * 7) % 60);

const wipe = async () => {
  await Promise.all(ALL_COLLECTIONS.map((model) => model.deleteMany({})));
};

const seedUsers = async () => {
  const admin = await User.create({ ...data.users.admin, password: data.DEMO_PASSWORD, isEmailVerified: true, lastLoginAt: new Date() });
  const coAdmin = await User.create({ ...data.users.coAdmin, password: data.DEMO_PASSWORD, isEmailVerified: true });

  const exhibitorRecords = [];
  for (const entry of data.users.exhibitors) {
    // eslint-disable-next-line no-await-in-loop
    const user = await User.create({
      ...entry.user,
      password: data.DEMO_PASSWORD,
      isEmailVerified: true,
      lastLoginAt: daysAgo(1, 9),
      lastSeenAt: new Date(),
    });
    // eslint-disable-next-line no-await-in-loop
    const profile = await ExhibitorProfile.create({ ...entry.profile, user: user._id });
    exhibitorRecords.push({ user, profile, seed: entry });
  }

  const attendeeRecords = [];
  for (const entry of data.users.attendees) {
    // eslint-disable-next-line no-await-in-loop
    const user = await User.create({ ...entry, password: data.DEMO_PASSWORD, isEmailVerified: true, lastLoginAt: daysAgo(2, 14) });
    // eslint-disable-next-line no-await-in-loop
    const profile = await AttendeeProfile.create({
      user: user._id,
      headline: `${entry.jobTitle} at ${entry.organization}`,
      organization: entry.organization,
      jobTitle: entry.jobTitle,
      city: entry.city,
      country: entry.country,
      interests: entry.interests,
    });
    attendeeRecords.push({ user, profile });
  }

  return { admin, coAdmin, exhibitorRecords, attendeeRecords };
};

const seedExpos = async (admin) => {
  const records = {};
  for (const definition of data.expos) {
    const { offsetDays, key, published, ...rest } = definition;
    // eslint-disable-next-line no-await-in-loop
    const expo = await expoService.createExpo(
      {
        ...rest,
        startDate: pick(offsetDays.start, 9),
        endDate: pick(offsetDays.end, 18),
        registrationDeadline: pick(offsetDays.deadline, 23, 59),
        organizer: admin._id,
      },
      admin,
    );
    expo.publishedAt = published ? daysAgo(Math.max(1, 30 - offsetDays.start)) : null;
    expo.status = definition.status;
    // eslint-disable-next-line no-await-in-loop
    await expo.save();
    records[key] = expo;
  }
  return records;
};

const seedBooths = async (expos, admin) => {
  const plan = {
    tech: [
      { zone: 'A', rows: 3, cols: 5, size: 'premium', price: 4200, startX: 1, startY: 1, prefix: 'Innovation' },
      { zone: 'B', rows: 4, cols: 6, size: 'large', price: 2600, startX: 8, startY: 1, prefix: 'Showcase' },
      { zone: 'C', rows: 3, cols: 6, size: 'medium', price: 1800, startX: 1, startY: 6, prefix: 'Startup' },
      { zone: 'D', rows: 2, cols: 4, size: 'small', price: 1200, startX: 14, startY: 6, prefix: 'Workshop' },
    ],
    energy: [
      { zone: 'A', rows: 3, cols: 4, size: 'premium', price: 3400, startX: 1, startY: 1, prefix: 'Grid' },
      { zone: 'B', rows: 3, cols: 5, size: 'large', price: 2200, startX: 7, startY: 1, prefix: 'Storage' },
      { zone: 'C', rows: 2, cols: 5, size: 'medium', price: 1400, startX: 1, startY: 5, prefix: 'Solar' },
    ],
    health: [
      { zone: 'A', rows: 2, cols: 4, size: 'premium', price: 2800, startX: 1, startY: 1, prefix: 'Clinic' },
      { zone: 'B', rows: 3, cols: 4, size: 'medium', price: 1600, startX: 6, startY: 1, prefix: 'Lab' },
    ],
    manufacturing: [
      { zone: 'A', rows: 2, cols: 4, size: 'large', price: 2400, startX: 1, startY: 1, prefix: 'Factory' },
    ],
  };

  const created = {};
  for (const [key, expo] of Object.entries(expos)) {
    created[key] = [];
    for (const zone of plan[key] || []) {
      // eslint-disable-next-line no-await-in-loop
      const result = await boothService.bulkCreateBooths(expo._id, zone, admin);
      created[key].push(...result.booths);
    }
  }
  return created;
};

const seedExhibitorApplications = async (expos, boothRecords, exhibitorRecords, admin) => {
  // Nexa Robotics + VoltEdge exhibit at the tech expo, MediCore at health,
  // VoltEdge and MediCore at the ongoing energy summit.
  const plan = [
    { exhibitor: 0, expo: 'tech', status: 'approved', boothCount: 2 },
    { exhibitor: 1, expo: 'tech', status: 'approved', boothCount: 2 },
    { exhibitor: 3, expo: 'tech', status: 'pending', boothCount: 0 },
    { exhibitor: 1, expo: 'energy', status: 'approved', boothCount: 2 },
    { exhibitor: 2, expo: 'energy', status: 'approved', boothCount: 2 },
    { exhibitor: 0, expo: 'energy', status: 'pending', boothCount: 0 },
    { exhibitor: 2, expo: 'health', status: 'approved', boothCount: 2 },
    { exhibitor: 3, expo: 'health', status: 'rejected', boothCount: 0 },
  ];

  const applications = [];
  const assigned = [];

  for (const entry of plan) {
    const { user, profile } = exhibitorRecords[entry.exhibitor];
    const expo = expos[entry.expo];
    const available = boothRecords[entry.expo].filter((b) => b.status === 'available');

    // eslint-disable-next-line no-await-in-loop
    const application = await ExpoApplication.create({
      expo: expo._id,
      exhibitor: profile._id,
      applicant: user._id,
      status: entry.status,
      boothPreferences: { size: entry.boothCount > 1 ? 'large' : 'medium', zone: available[0]?.zone || 'A', notes: 'Prefer a corner position near the main entrance if available.' },
      productsToShowcase: (profile.products || []).slice(0, 3).map((p) => p.name),
      specialRequests: entry.status === 'pending' ? 'We would like a second table for live demos.' : '',
      documents: (profile.documents || []).map((doc) => ({ title: doc.title, file: `/uploads/documents/${doc.type || 'document'}.pdf`, mimeType: 'application/pdf', size: 184320 })),
      reviewedBy: entry.status === 'pending' ? null : admin._id,
      reviewedAt: entry.status === 'pending' ? null : daysAgo(6, 11),
      reviewNote: entry.status === 'rejected' ? 'Fully allocated for this edition — please apply for the next forum.' : '',
      timeline: [
        { status: 'pending', note: 'Application submitted', at: daysAgo(12, 9) },
        ...(entry.status === 'pending' ? [] : [{ status: entry.status, note: `Marked ${entry.status} by organizer`, at: daysAgo(6, 11) }]),
      ],
      createdAt: daysAgo(12, 9),
    });
    applications.push(application);

    // Assign booths for approved applications
    for (let i = 0; i < entry.boothCount; i += 1) {
      const booth = available[i];
      if (!booth) continue;
      booth.status = 'occupied';
      booth.exhibitor = profile._id;
      booth.application = application._id;
      booth.assignedAt = daysAgo(5, 10);
      booth.description = `${profile.companyName} — ${profile.tagline}`;
      booth.staff = (profile.staff || []).map((s) => ({ name: s.name, role: s.role, email: s.email, phone: s.phone }));
      booth.featuredProducts = [];
      // eslint-disable-next-line no-await-in-loop
      await booth.save();
      assigned.push({ booth, profile, expo });
    }

    if (entry.status === 'approved') {
      application.assignedBooth = available[0]?._id || null;
      // eslint-disable-next-line no-await-in-loop
      await application.save();
    }
  }

  // Link products to the booths that showcase them and reserve a demo booth.
  const products = await Product.find({});
  for (const { booth, profile } of assigned) {
    const featured = products.filter((p) => String(p.exhibitor) === String(profile._id)).slice(0, 2);
    booth.featuredProducts = featured.map((p) => p._id);
    // eslint-disable-next-line no-await-in-loop
    await booth.save();
    // eslint-disable-next-line no-await-in-loop
    await Product.updateMany({ _id: { $in: featured.map((p) => p._id) } }, { $inc: { 'stats.boothShares': 1 } });
  }

  // One booth under maintenance so the floor plan shows every status.
  const maintenance = boothRecords.tech.find((b) => b.status === 'available');
  if (maintenance) {
    maintenance.status = 'maintenance';
    maintenance.maintenanceNote = 'Electrical inspection scheduled before opening.';
    await maintenance.save();
  }

  // A pending reservation request from BlueOrbit Software.
  const pendingBooth = boothRecords.tech.filter((b) => b.status === 'available')[1];
  if (pendingBooth) {
    const { user, profile } = exhibitorRecords[3];
    pendingBooth.status = 'reserved';
    pendingBooth.reservation = { requestedBy: user._id, exhibitor: profile._id, requestedAt: daysAgo(2, 15), note: 'We would like a booth next to the workshop lab.' };
    await pendingBooth.save();
  }

  return applications;
};

const seedProducts = async (exhibitorRecords) => {
  const created = {};
  for (let index = 0; index < exhibitorRecords.length; index += 1) {
    const { user, profile, seed } = exhibitorRecords[index];
    created[index] = [];
    for (const product of seed.products || []) {
      // eslint-disable-next-line no-await-in-loop
      const doc = await Product.create({ ...product, exhibitor: profile._id, user: user._id, stats: { views: Math.floor(Math.random() * 240) + 40 } });
      created[index].push(doc);
    }
  }
  return created;
};

const seedSpeakersAndSessions = async (expos) => {
  const speakerMap = {};
  for (const speaker of data.users.speakers) {
    // eslint-disable-next-line no-await-in-loop
    const doc = await Speaker.create(speaker);
    speakerMap[speaker.name] = doc;
  }

  // Speakers referenced by name in the session templates are also on staff.
  const exhibitorStaff = await User.find({ role: 'exhibitor' }).select('name organization');
  for (const user of exhibitorStaff) {
    const match = Object.values(speakerMap).find((s) => s.organization === user.organization);
    if (match && !match.user) {
      match.user = user._id;
      // eslint-disable-next-line no-await-in-loop
      await match.save();
    }
  }

  const sessions = [];
  for (const template of data.sessions) {
    const expo = expos[template.expoKey];
    const expoStart = startOfDay(expo.startDate);
    const date = addDays(expoStart, template.dayOffset);
    const speakers = (template.speakers || []).map((name) => speakerMap[name]?._id).filter(Boolean);
    // eslint-disable-next-line no-await-in-loop
    const session = await Session.create({
      expo: expo._id,
      title: template.title,
      description: template.description,
      type: template.type,
      category: template.category,
      level: template.level,
      date,
      startTime: template.startTime,
      endTime: template.endTime,
      speakers,
      location: { venue: expo.location.venue, hall: expo.location.hall, room: template.room },
      capacity: template.capacity,
      isFeatured: Boolean(template.isFeatured),
      tags: template.tags,
      materials: template.isFeatured
        ? [{ title: 'Slide deck', url: 'https://cdn.eventsphere.example.com/slides/keynote.pdf' }]
        : [],
    });
    sessions.push(session);
  }

  // A cancelled session so the schedule UI can show that state too.
  const energyExpo = expos.energy;
  const cancelled = await Session.create({
    expo: energyExpo._id,
    title: 'Seminar: Hydrogen pilot economics (cancelled)',
    description: 'Cancelled because the presenting utility withdrew its speakers. Registered attendees were notified.',
    type: 'seminar',
    category: 'energy',
    date: addDays(startOfDay(energyExpo.startDate), 1),
    startTime: '16:00',
    endTime: '17:00',
    speakers: [speakerMap['Clara Bergström']._id],
    location: { venue: energyExpo.location.venue, room: 'Hall 2 — Seminar Stage' },
    capacity: 120,
    status: 'cancelled',
    cancellationReason: 'Speaker unavailable — replacement session announced for the next edition.',
  });
  sessions.push(cancelled);

  return sessions;
};

const seedEngagement = async ({ expos, sessions, exhibitorRecords, attendeeRecords, boothRecords, admin }) => {
  const exhibitorBooths = await Booth.find({ exhibitor: { $ne: null } }).populate('exhibitor');
  const byExpo = (key) => exhibitorBooths.filter((b) => String(b.expo) === String(expos[key]._id));

  // ---- Expo registrations ------------------------------------------------
  const registrations = [];
  const plan = [
    { attendee: 0, expo: 'energy', checkedIn: true, passType: 'vip' },
    { attendee: 1, expo: 'energy', checkedIn: true, passType: 'standard' },
    { attendee: 3, expo: 'energy', checkedIn: false, passType: 'standard' },
    { attendee: 0, expo: 'tech', checkedIn: false, passType: 'vip' },
    { attendee: 1, expo: 'tech', checkedIn: false, passType: 'standard' },
    { attendee: 2, expo: 'health', checkedIn: true, passType: 'standard' },
    { attendee: 4, expo: 'tech', checkedIn: false, passType: 'standard' },
    { attendee: 5, expo: 'energy', checkedIn: true, passType: 'standard' },
  ];

  for (const entry of plan) {
    const attendee = attendeeRecords[entry.attendee].user;
    const expo = expos[entry.expo];
    const price = Number(expo.ticketPrice || 0);
    // eslint-disable-next-line no-await-in-loop
    const registration = await Registration.create({
      user: attendee._id,
      expo: expo._id,
      passType: entry.passType,
      status: entry.checkedIn ? 'attended' : 'confirmed',
      passCode: humanCode('ES', 8),
      attendeeDetails: {
        fullName: attendee.name,
        email: attendee.email,
        phone: attendee.phone || '',
        organization: attendee.organization,
        jobTitle: attendee.jobTitle,
        country: attendee.country,
      },
      interests: attendee.interests || [],
      amount: price,
      currency: expo.currency,
      paymentStatus: price > 0 ? 'paid' : 'not_required',
      checkedIn: entry.checkedIn,
      checkedInAt: entry.checkedIn ? daysAgo(entry.expo === 'energy' ? 1 : 60, 9) : null,
      checkInCount: entry.checkedIn ? 1 : 0,
      badgeIssuedAt: daysAgo(3, 8),
      createdAt: daysAgo(Math.max(2, 10 - entry.attendee), 8 + entry.attendee),
    });
    registrations.push(registration);

    if (entry.checkedIn) {
      // eslint-disable-next-line no-await-in-loop
      await CheckIn.create({
        expo: expo._id,
        user: attendee._id,
        registration: registration._id,
        type: 'event',
        code: registration.passCode,
        method: 'qr',
        scannedBy: admin._id,
        scannerName: admin.name,
        device: 'Door scanner 1',
        checkedInAt: registration.checkedInAt,
      });
    }
  }

  // ---- Session registrations + bookmarks ---------------------------------
  for (const session of sessions) {
    const candidates = registrations.filter((r) => String(r.expo) === String(session.expo) && r.status !== 'cancelled');
    for (let i = 0; i < candidates.length; i += 1) {
      const registration = candidates[i];
      const registered = session.status !== 'cancelled' && i % 2 === 0;
      const bookmarked = i % 3 === 0;
      if (!registered && !bookmarked) continue;
      const attended = registered && session.status !== 'cancelled' && new Date(session.date) < new Date();
      // eslint-disable-next-line no-await-in-loop
      await SessionRegistration.create({
        user: registration.user,
        session: session._id,
        expo: session.expo,
        registered,
        bookmarked,
        status: session.status === 'cancelled' ? 'cancelled' : attended ? 'attended' : registered ? 'registered' : 'registered',
        registeredAt: registered ? daysAgo(4, 12) : null,
        attendedAt: attended ? daysAgo(1, 11) : null,
      });
      if (registered) {
        session.registeredCount += 1;
        // eslint-disable-next-line no-await-in-loop
        await session.save();
      }
    }
  }

  // ---- Availability slots + appointments ---------------------------------
  const slotPlan = [
    { exhibitorIndex: 0, expo: 'energy', dayOffset: 0, start: '13:00', end: '16:00' },
    { exhibitorIndex: 1, expo: 'energy', dayOffset: 0, start: '10:00', end: '13:00' },
    { exhibitorIndex: 2, expo: 'energy', dayOffset: 1, start: '09:00', end: '12:00' },
    { exhibitorIndex: 0, expo: 'tech', dayOffset: 0, start: '14:00', end: '17:00' },
    { exhibitorIndex: 1, expo: 'tech', dayOffset: 1, start: '10:00', end: '12:00' },
  ];

  const slots = [];
  for (const planEntry of slotPlan) {
    const { user, profile } = exhibitorRecords[planEntry.exhibitorIndex];
    const expo = expos[planEntry.expo];
    const date = addDays(startOfDay(expo.startDate), planEntry.dayOffset);
    const [startHour, startMinute] = planEntry.start.split(':').map(Number);
    const [endHour] = planEntry.end.split(':').map(Number);

    for (let hour = startHour; hour < endHour; hour += 1) {
      for (const minute of hour === startHour ? [startMinute] : [0]) {
        const slotStart = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        const endMinutes = hour * 60 + minute + 30;
        const slotEnd = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
        // eslint-disable-next-line no-await-in-loop
        const slot = await AvailabilitySlot.create({
          exhibitor: profile._id,
          exhibitorUser: user._id,
          expo: expo._id,
          date,
          startTime: slotStart,
          endTime: slotEnd,
          durationMinutes: 30,
          location: `${profile.companyName} booth`,
        });
        slots.push(slot);
      }
    }
  }

  const appointmentPlan = [
    { slot: 0, attendee: 0, topic: 'Pilot deployment of NexaArm C6 on two lines', status: 'confirmed' },
    { slot: 3, attendee: 1, topic: 'AMR fleet sizing for a 12,000 m² warehouse', status: 'pending' },
    { slot: 8, attendee: 3, topic: 'Grid-scale storage monitoring options', status: 'completed' },
    { slot: 12, attendee: 2, topic: 'Machine-vision inspection for medical devices', status: 'confirmed' },
  ];

  const appointments = [];
  for (const entry of appointmentPlan) {
    const slot = slots[entry.slot];
    if (!slot) continue;
    const attendee = attendeeRecords[entry.attendee].user;
    const booth = exhibitorBooths.find((b) => String(b.exhibitor._id) === String(slot.exhibitor));
    // eslint-disable-next-line no-await-in-loop
    const appointment = await Appointment.create({
      expo: slot.expo,
      exhibitor: slot.exhibitor,
      exhibitorUser: slot.exhibitorUser,
      attendee: attendee._id,
      slot: slot._id,
      date: slot.date,
      startTime: slot.startTime,
      endTime: slot.endTime,
      durationMinutes: slot.durationMinutes,
      topic: entry.topic,
      agenda: 'Walk through requirements, integration constraints and indicative pricing.',
      status: entry.status,
      requestedBy: 'attendee',
      location: {
        boothNumber: booth ? `${booth.zone}-${booth.number}` : '',
        meetingPoint: 'Exhibitor booth',
        venue: booth?.expo?.name || '',
      },
      respondedAt: entry.status === 'pending' ? null : daysAgo(3, 16),
      responseNote: entry.status === 'confirmed' ? 'Confirmed — see you at the booth, please arrive on time.' : '',
      completedAt: entry.status === 'completed' ? daysAgo(1, 12) : null,
      meetingNotes: entry.status === 'completed' ? 'Requested a proposal for 8 monitoring points. Follow up with pricing.' : '',
      createdAt: daysAgo(5, 13),
    });
    appointments.push(appointment);

    slot.status = entry.status === 'pending' ? 'open' : 'booked';
    slot.bookedBy = attendee._id;
    slot.appointment = appointment._id;
    // eslint-disable-next-line no-await-in-loop
    await slot.save();
  }

  // ---- Conversations + messages ------------------------------------------
  const conversations = [];
  const pairs = [
    { a: attendeeRecords[0].user, b: exhibitorRecords[0].user, expo: expos.energy, exhibitor: exhibitorRecords[0].profile, thread: [
      { from: 'attendee', body: 'Hi! Is the NexaArm C6 available for a live demo at your booth tomorrow?' },
      { from: 'exhibitor', body: 'Hello Jordan — yes, we run demos every hour from 11:00. Which slot suits you?' },
      { from: 'attendee', body: '13:00 works. Should I book an appointment through the platform?' },
      { from: 'exhibitor', body: 'That would help us reserve a table. See you then!' },
    ] },
    { a: attendeeRecords[2].user, b: exhibitorRecords[2].user, expo: expos.energy, exhibitor: exhibitorRecords[2].profile, thread: [
      { from: 'attendee', body: 'Do you have documentation on HL7 FHIR mapping for the VitalLink monitor?' },
      { from: 'exhibitor', body: 'We do — there is a technical brief in our profile documents and we can walk through it at the booth.' },
    ] },
    { a: exhibitorRecords[0].user, b: exhibitorRecords[1].user, expo: expos.energy, exhibitor: exhibitorRecords[1].profile, thread: [
      { from: 'exhibitor', body: 'Are you bringing the GaN module demo to Stockholm? We have a customer asking about inverter efficiency.' },
      { from: 'exhibitor', body: '' },
    ] },
  ];

  for (const pair of pairs) {
    const pairKey = Conversation.buildPairKey(pair.a._id, pair.b._id);
    // eslint-disable-next-line no-await-in-loop
    const conversation = await Conversation.create({
      participants: [pair.a._id, pair.b._id],
      pairKey,
      expo: pair.expo._id,
      exhibitor: pair.exhibitor._id,
      lastMessagePreview: pair.thread.filter((m) => m.body).slice(-1)[0]?.body.slice(0, 160) || '',
      lastSender: pair.thread.filter((m) => m.body).slice(-1)[0]?.from === 'attendee' ? pair.a._id : pair.b._id,
      lastMessageAt: daysAgo(1, 17),
      unreadCounts: { [String(pair.b._id)]: 1 },
    });

    for (let i = 0; i < pair.thread.length; i += 1) {
      const item = pair.thread[i];
      if (!item.body) continue;
      const sender = item.from === 'attendee' ? pair.a._id : pair.b._id;
      const recipient = item.from === 'attendee' ? pair.b._id : pair.a._id;
      // eslint-disable-next-line no-await-in-loop
      const message = await Message.create({
        conversation: conversation._id,
        sender,
        body: item.body,
        readBy: i === pair.thread.length - 1 ? [sender] : [sender, recipient],
        createdAt: daysAgo(2 - Math.min(2, i), 15 + i),
      });
      conversation.lastMessage = message._id;
    }
    // eslint-disable-next-line no-await-in-loop
    await conversation.save();
    conversations.push(conversation);
  }

  // ---- Payments ----------------------------------------------------------
  const payments = [];
  const paidBooths = exhibitorBooths.slice(0, 6);
  for (let i = 0; i < paidBooths.length; i += 1) {
    const booth = paidBooths[i];
    // `exhibitor` is populated, so its owner id is available for the invoice.
    const ownerId = booth.exhibitor.user;
    // eslint-disable-next-line no-await-in-loop
    const invoiceNumber = await invoiceService.nextInvoiceNumber();
    // eslint-disable-next-line no-await-in-loop
    const payment = await Payment.create({
      user: ownerId,
      purpose: 'booth_booking',
      description: `Booth ${booth.zone}-${booth.number} — booth booking`,
      amount: booth.price,
      tax: Math.round(booth.price * 0.05 * 100) / 100,
      total: Math.round(booth.price * 1.05 * 100) / 100,
      currency: booth.currency,
      status: 'paid',
      provider: 'mock',
      providerRef: `mock_sess_${humanCode('', 10).replace('-', '').toLowerCase()}`,
      transactionId: humanCode('TXN', 10),
      related: { expo: booth.expo, booth: booth._id, exhibitor: booth.exhibitor._id },
      metadata: { boothNumber: `${booth.zone}-${booth.number}` },
      invoice: {
        number: invoiceNumber,
        issuedAt: daysAgo(4, 10),
        billedTo: { name: booth.exhibitor.companyName, email: booth.exhibitor.contact?.email || '', company: booth.exhibitor.companyName, address: booth.exhibitor.contact?.address || '' },
      },
      paidAt: daysAgo(4, 10),
      history: [
        { status: 'pending', note: 'Checkout session created', at: daysAgo(5, 9) },
        { status: 'paid', note: 'Confirmed by mock gateway', at: daysAgo(4, 10) },
      ],
      createdAt: daysAgo(5, 9),
    });
    payments.push(payment);
  }

  // Ticket payments for the paid expos.
  for (const registration of registrations.filter((r) => r.amount > 0)) {
    // eslint-disable-next-line no-await-in-loop
    const expo = expos.tech;
    // eslint-disable-next-line no-await-in-loop
    const invoiceNumber = await invoiceService.nextInvoiceNumber();
    // eslint-disable-next-line no-await-in-loop
    const payment = await Payment.create({
      user: registration.user,
      purpose: 'event_ticket',
      description: `${expo.title} — event pass (${registration.passType})`,
      amount: registration.amount,
      tax: 0,
      total: registration.amount,
      currency: expo.currency,
      status: 'paid',
      provider: 'mock',
      providerRef: `mock_sess_${humanCode('', 10).replace('-', '').toLowerCase()}`,
      transactionId: humanCode('TXN', 10),
      related: { expo: expo._id, registration: registration._id },
      invoice: {
        number: invoiceNumber,
        issuedAt: daysAgo(3, 11),
        billedTo: { name: registration.attendeeDetails.fullName, email: registration.attendeeDetails.email, company: registration.attendeeDetails.organization, address: registration.attendeeDetails.country },
      },
      paidAt: daysAgo(3, 11),
      history: [{ status: 'paid', note: 'Confirmed by mock gateway', at: daysAgo(3, 11) }],
      createdAt: daysAgo(3, 11),
    });
    registration.payment = payment._id;
    // eslint-disable-next-line no-await-in-loop
    await registration.save();
    payments.push(payment);
  }

  // ---- Reviews -----------------------------------------------------------
  const reviewPlan = [
    { attendee: 0, exhibitor: 0, rating: 5, title: 'Genuinely production-ready robotics', comment: 'The NexaArm demo answered every question our plant team had. The SDK documentation is the best I have seen from a robotics vendor.' },
    { attendee: 1, exhibitor: 0, rating: 4, title: 'Strong hardware, book the demo early', comment: 'Excellent performance in the demo, though the queue for hands-on time was long during peak hours.' },
    { attendee: 3, exhibitor: 1, rating: 5, title: 'Vibration sensors paid for themselves', comment: 'We deployed VoltSense on six pumps and caught a bearing failure within three weeks.' },
    { attendee: 2, exhibitor: 2, rating: 4, title: 'FHIR mapping works as advertised', comment: 'Integration took a day with the provided mapping guide. Would like more billing documentation.' },
    { attendee: 5, exhibitor: 3, rating: 4, title: 'Promising streaming platform', comment: 'OrbitStream handled our event volume comfortably. Alerting UI needs a little polish.' },
  ];

  for (const entry of reviewPlan) {
    const author = attendeeRecords[entry.attendee].user;
    const profile = exhibitorRecords[entry.exhibitor].profile;
    const booth = exhibitorBooths.find((b) => String(b.exhibitor._id) === String(profile._id));
    // eslint-disable-next-line no-await-in-loop
    await Review.create({
      author: author._id,
      targetType: 'ExhibitorProfile',
      target: profile._id,
      expo: booth?.expo || expos.energy._id,
      rating: entry.rating,
      title: entry.title,
      comment: entry.comment,
      verifiedAttendance: true,
      createdAt: daysAgo(3 + entry.attendee, 16),
      replies: entry.rating === 5
        ? [{ author: exhibitorRecords[entry.exhibitor].user._id, body: 'Thank you for the feedback — our engineering team will be delighted to hear it.' }]
        : [],
    });
  }

  const sessionReviewPlan = [
    { attendee: 0, sessionIndex: 0, rating: 5, title: 'Best keynote in years', comment: 'Real deployment data instead of vendor slides. The bottleneck analysis was worth the trip on its own.' },
    { attendee: 1, sessionIndex: 2, rating: 4, title: 'Good panel, wanted more depth', comment: 'Great speakers but 60 minutes is too short for six panellists.' },
    { attendee: 2, sessionIndex: 9, rating: 5, title: 'Practical clinical safety guidance', comment: 'The FHIR examples were directly applicable to our rollout.' },
  ];

  for (const entry of sessionReviewPlan) {
    const session = sessions[entry.sessionIndex];
    if (!session) continue;
    // eslint-disable-next-line no-await-in-loop
    await Review.create({
      author: attendeeRecords[entry.attendee].user._id,
      targetType: 'Session',
      target: session._id,
      expo: session.expo,
      rating: entry.rating,
      title: entry.title,
      comment: entry.comment,
      verifiedAttendance: true,
      createdAt: daysAgo(2, 18),
    });
  }

  // Keep the denormalised exhibitor ratings in sync.
  for (const { profile } of exhibitorRecords) {
    // eslint-disable-next-line no-await-in-loop
    const [result] = await Review.aggregate([
      { $match: { targetType: 'ExhibitorProfile', target: new mongoose.Types.ObjectId(String(profile._id)), status: 'published' } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
    ]);
    profile.avgRating = result ? Math.round(result.avg * 10) / 10 : 0;
    profile.reviewCount = result?.count || 0;
    profile.profileViews = Math.floor(Math.random() * 400) + 120;
    profile.totalBoothVisits = Math.floor(Math.random() * 300) + 60;
    // eslint-disable-next-line no-await-in-loop
    await profile.save();
  }

  // ---- Notifications ----------------------------------------------------
  // Note: the model field is `user` (the notification recipient).
  const notificationSamples = [
    { user: attendeeRecords[0].user._id, type: 'booth_assigned', title: 'Your appointment is confirmed', body: 'Nexa Robotics confirmed your 30-minute meeting at the Green Energy Summit.', read: false, priority: 'high' },
    { user: attendeeRecords[0].user._id, type: 'session_reminder', title: 'Opening keynote starts in 30 minutes', body: 'Summit Hall — Stage 1 at 09:00.', read: false, priority: 'high' },
    { user: attendeeRecords[0].user._id, type: 'expo_registration', title: 'You are registered for Global Tech Expo 2026', body: 'Your event pass is ready — open Event Pass to view the QR code.', read: true },
    { user: exhibitorRecords[0].user._id, type: 'appointment_requested', title: 'New appointment request', body: 'Jordan Blake requested a 30-minute meeting about AMR fleet sizing.', read: false, priority: 'high' },
    { user: exhibitorRecords[3].user._id, type: 'application_received', title: 'Application under review', body: 'Your application for Global Tech Expo 2026 is being reviewed by the organizers.', read: false },
    { user: exhibitorRecords[0].user._id, type: 'review_received', title: 'New 5★ review', body: 'Genuinely production-ready robotics — from Jordan Blake.', read: true },
    { user: admin._id, type: 'payment_confirmed', title: 'Booth payment received', body: 'Nexa Robotics paid for booth A-01 at the Green Energy Summit.', read: false },
    { user: admin._id, type: 'support_ticket_update', title: 'New high priority ticket', body: 'TKT: Invoice shows the wrong company name.', read: false, priority: 'high' },
  ];

  for (let i = 0; i < notificationSamples.length; i += 1) {
    const sample = notificationSamples[i];
    // eslint-disable-next-line no-await-in-loop
    await Notification.create({ ...sample, createdAt: daysAgo(i % 4, 9 + i) });
  }

  // ---- Feedback + support tickets ---------------------------------------
  for (let i = 0; i < data.feedbackSamples.length; i += 1) {
    const sample = data.feedbackSamples[i];
    const attendee = attendeeRecords[i].user;
    // eslint-disable-next-line no-await-in-loop
    await Feedback.create({
      user: attendee._id,
      name: attendee.name,
      email: attendee.email,
      expo: expos.energy._id,
      category: sample.category,
      subject: sample.subject,
      message: sample.message,
      rating: sample.rating,
      status: i === 0 ? 'reviewed' : 'new',
      response: i === 0 ? 'Thanks for the suggestion — we are adding a second workshop lab next edition.' : '',
      respondedBy: i === 0 ? admin._id : null,
      respondedAt: i === 0 ? daysAgo(1, 12) : null,
      createdAt: daysAgo(2 + i, 13),
    });
  }

  for (let i = 0; i < data.tickets.length; i += 1) {
    const sample = data.tickets[i];
    const requester = i === 0 ? exhibitorRecords[1].user : exhibitorRecords[0].user;
    // eslint-disable-next-line no-await-in-loop
    const ticket = await SupportTicket.create({
      user: requester._id,
      subject: sample.subject,
      description: sample.description,
      category: sample.category,
      priority: sample.priority,
      status: sample.status,
      assignedTo: sample.status === 'in_progress' ? admin._id : null,
      relatedExpo: expos.energy._id,
      messages: [
        { author: requester._id, authorName: requester.name, authorRole: requester.role, body: sample.description },
        ...sample.replies.map((reply) => ({ author: admin._id, authorName: admin.name, authorRole: 'admin', body: reply.body, isStaff: true })),
      ],
      lastActivityAt: daysAgo(i, 14),
      createdAt: daysAgo(2 + i, 14),
    });
    // eslint-disable-next-line no-await-in-loop
    await ticket.save();
  }

  // ---- Announcements ----------------------------------------------------
  for (const announcement of data.announcements) {
    // eslint-disable-next-line no-await-in-loop
    await Announcement.create({
      expo: expos[announcement.expoKey]._id,
      author: admin._id,
      title: announcement.title,
      body: announcement.body,
      audience: announcement.audience,
      priority: announcement.priority,
      pinned: announcement.pinned,
      recipientCount: announcement.audience === 'exhibitors' ? 3 : 8,
      publishedAt: daysAgo(1, 8),
    });
  }

  // ---- Booth traffic (analytics) ---------------------------------------
  const realisticSources = ['floor_plan', 'directory', 'search', 'profile', 'qr', 'direct'];
  for (let day = 0; day < 14; day += 1) {
    const visitsToday = 6 + Math.floor(Math.random() * 10);
    for (let v = 0; v < visitsToday; v += 1) {
      const booth = exhibitorBooths[Math.floor(Math.random() * exhibitorBooths.length)];
      const visitor = attendeeRecords[Math.floor(Math.random() * attendeeRecords.length)].user;
      // eslint-disable-next-line no-await-in-loop
      await BoothVisit.create({
        kind: Math.random() > 0.65 ? 'profile' : 'booth',
        booth: booth._id,
        expo: booth.expo,
        exhibitor: booth.exhibitor._id,
        visitor: visitor._id,
        source: realisticSources[Math.floor(Math.random() * realisticSources.length)],
        createdAt: daysAgo(day, 9 + (v % 9)),
      });
    }
  }

  // ---- Counter sync ----------------------------------------------------
  for (const expo of Object.values(expos)) {
    // eslint-disable-next-line no-await-in-loop
    await expoService.refreshStats(expo._id);
  }

  return { registrations, appointments, conversations, payments };
};

/**
 * Populate the database with demo data.
 * @param {{fresh?: boolean, silent?: boolean}} options
 */
const seed = async ({ fresh = false, silent = false } = {}) => {
  const existing = await User.countDocuments();
  if (existing > 0 && !fresh) {
    return { skipped: true, message: 'Database already contains data — run "npm run seed:fresh" to reset it.' };
  }

  if (fresh) await wipe();

  const log = (message) => {
    if (!silent) logger.plain(message);
  };

  log('Seeding EventSphere demo data…');

  const { admin, attendeeRecords, exhibitorRecords } = await seedUsers();
  const products = await seedProducts(exhibitorRecords);

  // Attach catalogue entries to the profiles for convenience in later steps.
  exhibitorRecords.forEach((record, index) => {
    record.profile.products = (products[index] || []).map((p) => ({ _id: p._id, name: p.name }));
  });

  const expos = await seedExpos(admin);
  const boothRecords = await seedBooths(expos, admin);
  await seedExhibitorApplications(expos, boothRecords, exhibitorRecords, admin);
  const sessions = await seedSpeakersAndSessions(expos);
  const engagement = await seedEngagement({ expos, sessions, exhibitorRecords, attendeeRecords, boothRecords, admin });

  const summary = {
    users: await User.countDocuments(),
    exhibitors: await ExhibitorProfile.countDocuments(),
    attendees: await AttendeeProfile.countDocuments(),
    expos: await Expo.countDocuments(),
    booths: await Booth.countDocuments(),
    sessions: await Session.countDocuments(),
    registrations: await Registration.countDocuments(),
    appointments: await Appointment.countDocuments(),
    payments: await Payment.countDocuments(),
    reviews: await Review.countDocuments(),
    messages: await Message.countDocuments(),
    notifications: await Notification.countDocuments(),
    checkIns: await CheckIn.countDocuments(),
    tickets: await SupportTicket.countDocuments(),
    announcements: await Announcement.countDocuments(),
    engagement,
  };

  log('');
  log('✔ Seed complete');
  log(`  users          ${summary.users}`);
  log(`  expos          ${summary.expos} (draft / upcoming / ongoing / completed)`);
  log(`  booths         ${summary.booths}`);
  log(`  exhibitors     ${summary.exhibitors}`);
  log(`  sessions       ${summary.sessions}`);
  log(`  registrations  ${summary.registrations}`);
  log(`  appointments   ${summary.appointments}`);
  log(`  payments       ${summary.payments}`);
  log(`  reviews        ${summary.reviews}`);
  log(`  chat messages  ${summary.messages}`);
  log(`  notifications  ${summary.notifications}`);
  log('');
  log('Demo accounts (password: Sample@123)');
  log('  Organizer  admin@eventsphere.io');
  log('  Exhibitor  exhibitor@nexarobotics.io');
  log('  Attendee   attendee@example.com');

  return summary;
};

module.exports = { seed, wipe };

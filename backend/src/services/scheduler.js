'use strict';

const config = require('../config');
const logger = require('../utils/logger');
const expoService = require('./expoService');
const sessionService = require('./sessionService');
const appointmentService = require('./appointmentService');
const paymentService = require('./paymentService');
const notificationService = require('./notificationService');

let timer = null;
let running = false;

/**
 * Background jobs. A single interval keeps everything dependency-free and easy
 * to reason about; each job is isolated so one failure never stops the others.
 */
const jobs = [
  {
    name: 'expo-status-transitions',
    run: async () => {
      const result = await expoService.syncStatuses();
      return result.started || result.completed ? result : null;
    },
  },
  {
    name: 'session-reminders',
    run: async () => {
      const sessions = await sessionService.dueReminders(config.scheduler.sessionReminderLeadMinutes);
      for (const session of sessions) {
        // eslint-disable-next-line no-await-in-loop
        const attendees = await sessionService.attendeeIdsForSession(session._id);
        // eslint-disable-next-line no-await-in-loop
        await notificationService.createMany(attendees, {
          type: 'session_reminder',
          title: `Starting soon: ${session.title}`,
          body: `${session.startTime}${session.location?.room ? ` in ${session.location.room}` : ''} — see you there!`,
          link: '/attendee/sessions',
          priority: 'high',
          data: { sessionId: session._id, expoId: session.expo?._id },
        });
        session.reminderSentAt = new Date();
        // eslint-disable-next-line no-await-in-loop
        await session.save();
      }
      return sessions.length ? { reminders: sessions.length } : null;
    },
  },
  {
    name: 'appointment-reminders',
    run: async () => {
      const appointments = await appointmentService.dueReminders(config.scheduler.sessionReminderLeadMinutes);
      for (const appointment of appointments) {
        const body = `${appointment.startTime}${appointment.location?.boothNumber ? ` at booth ${appointment.location.boothNumber}` : ''} — "${appointment.topic}"`;
        // eslint-disable-next-line no-await-in-loop
        await notificationService.createMany([appointment.attendee, appointment.exhibitorUser], {
          type: 'session_reminder',
          title: 'Appointment starting soon',
          body,
          priority: 'high',
          link: '/attendee/appointments',
          data: { appointmentId: appointment._id },
        });
        appointment.reminderSentAt = new Date();
        // eslint-disable-next-line no-await-in-loop
        await appointment.save();
      }
      return appointments.length ? { reminders: appointments.length } : null;
    },
  },
  {
    name: 'expire-abandoned-payments',
    run: async () => {
      const count = await paymentService.expireStalePayments(24);
      return count ? { expired: count } : null;
    },
  },
];

const runOnce = async () => {
  if (running) return;
  running = true;
  try {
    for (const job of jobs) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const result = await job.run();
        if (result) logger.info(`[scheduler] ${job.name}:`, result);
      } catch (error) {
        logger.error(`[scheduler] ${job.name} failed:`, error.message);
      }
    }
  } finally {
    running = false;
  }
};

const start = () => {
  if (!config.scheduler.enabled || timer) return null;
  logger.info(`Scheduler started (every ${Math.round(config.scheduler.intervalMs / 1000)}s)`);
  timer = setInterval(() => {
    runOnce().catch((error) => logger.error('[scheduler] tick failed:', error.message));
  }, config.scheduler.intervalMs);
  timer.unref?.();
  // Kick the first pass shortly after boot so the UI reflects reality quickly.
  setTimeout(() => runOnce().catch(() => {}), 3000).unref?.();
  return timer;
};

const stop = () => {
  if (timer) clearInterval(timer);
  timer = null;
};

module.exports = { start, stop, runOnce, jobs };

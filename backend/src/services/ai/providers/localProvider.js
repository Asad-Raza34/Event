'use strict';

const { formatCurrency } = require('../../../utils/helpers');

/**
 * Deterministic provider that answers straight from the gathered database
 * context. No API key, no network, and the answers are always consistent with
 * what the platform actually contains.
 */
const name = 'local';

const fmtDate = (value) => (value ? new Date(value).toDateString() : 'date to be announced');

const list = (items, mapper) => items.map(mapper).join('\n');

const composeAnswer = (intent, ctx) => {
  const { context } = ctx;

  switch (intent) {
    case 'greeting':
      return `Hello! I'm the EventSphere assistant. I can help you find sessions, exhibitors, booth locations, tickets and appointments for ${context.currentExpo?.title || 'your events'}. What would you like to know?`;

    case 'help':
      return [
        'I answer questions using live EventSphere data. Try asking me:',
        '• "What sessions are available today?"',
        '• "Where is booth B-12?"',
        '• "Which exhibitors sell electronics?"',
        '• "When does the keynote start?"',
        '• "Show me workshops available tomorrow."',
      ].join('\n');

    case 'booth_location': {
      if (context.booths?.length) {
        return list(context.booths, (booth) => {
          const who = booth.exhibitor ? ` — ${booth.exhibitor.companyName}` : ' (currently unbooked)';
          return `Booth ${booth.label} is in zone ${booth.zone} on the floor plan${who}. Status: ${booth.status}.${booth.exhibitor?.description ? `\n${booth.exhibitor.description}` : ''}`;
        });
      }
      return 'I could not find that booth. Booths are numbered 01 onwards per zone (for example A-01, B-12) — try "where is booth A-01?" or open the floor plan to browse every stand.';
    }

    case 'exhibitor_location': {
      if (context.exhibitors?.length) {
        return list(context.exhibitors, (exhibitor) => {
          const stands = exhibitor.booths?.length ? exhibitor.booths.map((b) => b.label).join(', ') : 'no booth assigned yet';
          return `${exhibitor.companyName}${exhibitor.booths?.length ? ` is at booth ${stands}` : ''} — ${exhibitor.description || 'no description provided'}${exhibitor.rating ? ` (${exhibitor.rating}★)` : ''}`;
        });
      }
      return 'I could not match that name to an exhibitor. Try a company name or a category such as "energy" or "software", or browse the exhibitor directory.';
    }

    case 'product_search': {
      if (context.products?.length) {
        return [
          'Here is what I found:',
          list(context.products.slice(0, 8), (product) => `• ${product.name} by ${product.company}${product.booth ? ` (booth ${product.booth})` : ''}${product.price ? ` — ${formatCurrency(product.price, product.currency)}` : ''}`),
        ].join('\n');
      }
      return 'No products matched that. Try a broader term like "software", "electronics", "energy" or "logistics".';
    }

    case 'session_search': {
      if (context.sessions?.length) {
        return [
          `${context.sessions.length} session${context.sessions.length === 1 ? '' : 's'} found ${context.window ? `for ${context.window}` : ''}:`,
          list(context.sessions, (session) => {
            const speakers = session.speakers?.length ? ` — ${session.speakers.map((s) => s.name).join(', ')}` : '';
            const seats = session.seatsRemaining > 0 ? `${session.seatsRemaining} seats left` : 'full (waitlist available)';
            return `• ${session.title} (${session.type}) — ${fmtDate(session.date)} ${session.startTime}–${session.endTime}${session.room ? ` in ${session.room}` : ''}${speakers} • ${seats}`;
          }),
        ].join('\n');
      }
      return 'I did not find sessions matching that. Try "sessions today", "workshops tomorrow" or the keynote.';
    }

    case 'speaker_search': {
      if (context.speakers?.length) {
        return list(context.speakers, (speaker) => {
          const sessions = speaker.sessions?.length
            ? ` Sessions: ${speaker.sessions.map((s) => `${s.title} (${new Date(s.date).toDateString()} ${s.startTime})`).join('; ')}.`
            : '';
          return `${speaker.name}${speaker.title ? `, ${speaker.title}` : ''}${speaker.organization ? ` at ${speaker.organization}` : ''}.${speaker.bio ? ` ${speaker.bio}` : ''}${sessions}`;
        });
      }
      return 'I could not find that speaker. Ask "who is speaking today?" to see today\'s line-up.';
    }

    case 'venue_info': {
      const venue = context.venue;
      if (!venue) return 'I could not find venue details for this expo yet.';
      const amenities = venue.amenities?.length ? list(venue.amenities, (a) => `• ${a.name}${a.type ? ` (${a.type})` : ''}`) : 'No facilities have been published yet.';
      return [
        `Venue: ${venue.venue || 'to be announced'}${venue.address ? ` — ${venue.address}` : ''}`,
        venue.hall ? `Hall: ${venue.hall}` : '',
        'Facilities on the floor plan:',
        amenities,
        venue.zones?.length ? `Zones: ${venue.zones.map((z) => `${z.name} (${z.description || 'exhibitor zone'})`).join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'expo_info':
    case 'expo_overview': {
      const expo = context.expo?.expo;
      if (!expo) return 'There is no published expo to describe right now.';
      return [
        `${expo.title} (${expo.status}) — ${expo.theme || expo.category}`,
        `Dates: ${fmtDate(expo.startDate)} → ${fmtDate(expo.endDate)}${expo.registrationDeadline ? ` • registration closes ${fmtDate(expo.registrationDeadline)}` : ''}`,
        `Location: ${[expo.venue, expo.city, expo.country].filter(Boolean).join(', ') || 'to be announced'}`,
        `Sessions: ${context.expo.sessionCount} • Exhibitors: ${context.expo.featuredExhibitors?.length || 0} featured`,
        `Tickets: ${expo.ticketPrice ? formatCurrency(expo.ticketPrice, expo.currency) : 'free'} • Booths from ${expo.boothPriceFrom ? formatCurrency(expo.boothPriceFrom, expo.currency) : 'contact organizers'}`,
      ].join('\n');
    }

    case 'registration_help': {
      const registration = context.registration;
      if (!registration) return 'Tell me which expo you are interested in and I will walk you through registering.';
      return registration.alreadyRegistered
        ? `You are registered for ${registration.expo.title} (status: ${registration.myStatus}). Your pass code is ${registration.myPassCode} — open "Event Pass" to show the QR code at the door. You have ${registration.mySessionRegistrations} session registration(s).`
        : `${registration.expo.title} registration is ${registration.expo.registrationOpen ? 'open' : 'closed'}. Tickets are ${registration.expo.ticketPrice ? formatCurrency(registration.expo.ticketPrice, registration.expo.currency) : 'free'} and registration closes ${fmtDate(registration.expo.registrationDeadline)}. Open the expo page and press "Register".`;
    }

    case 'appointment_help': {
      if (context.openSlots?.length) {
        return [
          'These exhibitors have open meeting slots:',
          list(context.openSlots.slice(0, 8), (slot) => `• ${slot.exhibitor} — ${fmtDate(slot.date)} ${slot.startTime}–${slot.endTime} (${slot.durationMinutes} min)`),
          'Open the exhibitor profile and book a slot from their availability calendar.',
        ].join('\n');
      }
      return 'No open slots have been published yet. Exhibitors publish their availability from their dashboard — check back soon or message them directly.';
    }

    case 'payment_help': {
      if (context.payments?.length) {
        return [
          'Your latest transactions:',
          list(context.payments, (p) => `• ${p.description} — ${formatCurrency(p.amount, p.currency)} • ${p.status}${p.transactionId ? ` (${p.transactionId})` : ''}`),
          'Invoices can be downloaded from Payments → Invoice.',
        ].join('\n');
      }
      return 'You have no transactions yet. Payments for booth bookings and tickets are processed by the platform payment provider — EventSphere never stores card details.';
    }

    default: {
      const expo = context.expo?.expo;
      if (!expo) return 'I could not find an answer to that in the event data. Try asking about sessions, exhibitors, booths or tickets.';
      return [
        `Here is what I know about ${expo.title}:`,
        `• Runs ${fmtDate(expo.startDate)} → ${fmtDate(expo.endDate)} at ${[expo.venue, expo.city].filter(Boolean).join(', ') || 'the venue'}`,
        context.sessions?.length
          ? `• Next up: ${context.sessions.map((s) => `${s.title} at ${s.startTime}`).join(' • ')}`
          : '• No sessions scheduled yet',
        'Ask me about booths ("where is booth A-01?"), exhibitors ("which exhibitors sell software?") or workshops.',
      ].join('\n');
    }
  }
};

const answer = async ({ intent, context }) => ({
  answer: composeAnswer(intent, context),
  provider: name,
});

module.exports = { name, answer, composeAnswer };

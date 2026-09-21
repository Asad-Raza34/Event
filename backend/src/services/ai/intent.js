'use strict';

/**
 * Lightweight rule-based NLU. It only needs to classify intent and pull out
 * entities — the database does the actual answering, which keeps responses
 * accurate and removes any dependency on an external model.
 */

const TIME_HINTS = [
  { key: 'today', regex: /\btoday\b|\bnow\b|\bthis (morning|afternoon|evening)\b/i },
  { key: 'tomorrow', regex: /\btomorrow\b/i },
  { key: 'upcoming', regex: /\bupcoming\b|\bnext\b|\bsoon\b|\bfuture\b/i },
];

const detectTimeHint = (text) => TIME_HINTS.find((hint) => hint.regex.test(text))?.key || null;

const SESSION_TYPES = [
  { key: 'workshop', regex: /\bworkshops?\b|\bhands[- ]on\b/i },
  { key: 'keynote', regex: /\bkeynote\b|\bopening talk\b/i },
  { key: 'seminar', regex: /\bseminars?\b/i },
  { key: 'panel', regex: /\bpanels?\b|\broundtable\b/i },
  { key: 'presentation', regex: /\bpresentations?\b|\bdemo\b/i },
  { key: 'session', regex: /\bsessions?\b|\btalks?\b|\blectures?\b/i },
];

const detectSessionType = (text) => SESSION_TYPES.find((type) => type.regex.test(text))?.key || null;

/** Words that carry no search value when looking up a company or product. */
const STOP_WORDS = new Set([
  'where', 'is', 'the', 'a', 'an', 'at', 'in', 'on', 'of', 'for', 'to', 'find', 'show', 'me', 'what',
  'which', 'who', 'when', 'how', 'can', 'i', 'are', 'was', 'do', 'does', 'company', 'exhibitor', 'vendor',
  'booth', 'stand', 'sells', 'sell', 'selling', 'products', 'product', 'services', 'service', 'about',
  'please', 'and', 'or', 'tell', 'list', 'give', 'available', 'there', 'its', 'their', 'with', 'any',
]);

const extractKeywords = (text, { max = 4 } = {}) =>
  String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
    .slice(0, max);

const detectIntent = (rawMessage) => {
  const message = String(rawMessage || '').trim();
  const lower = message.toLowerCase();
  const entities = { keywords: extractKeywords(message), timeHint: detectTimeHint(message), sessionType: detectSessionType(message) };
  if (!message) return { intent: 'unknown', entities };

  const has = (regex) => regex.test(lower);

  // Greetings / help
  if (/^\s*(hi|hello|hey|yo|good (morning|afternoon|evening))\b/.test(lower) && message.length < 40) {
    return { intent: 'greeting', entities };
  }
  if (has(/\b(help|what can you do|how do you work)\b/)) return { intent: 'help', entities };

  // Booth location: "where is booth B-12", "locate stand 7"
  const boothMatch = lower.match(/\bbooth\s*#?\s*([a-f])?\s*[-\s]?(\d{1,3})\b/) || lower.match(/\b([a-f])\s*-\s*(\d{1,3})\b/);
  if (boothMatch && has(/where|locate|find|which|position|map|floor/)) {
    entities.boothZone = boothMatch[1] ? boothMatch[1].toUpperCase() : null;
    entities.boothNumber = boothMatch[2];
    return { intent: 'booth_location', entities };
  }
  if (boothMatch) {
    entities.boothZone = boothMatch[1] ? boothMatch[1].toUpperCase() : null;
    entities.boothNumber = boothMatch[2];
    return { intent: 'booth_location', entities };
  }

  if (has(/appointments?|meetings?|meet with|book a (slot|meeting)|schedule a meet/)) return { intent: 'appointment_help', entities };
  if (has(/\b(register|registration|sign ?up|ticket|pass|badge)\b/)) return { intent: 'registration_help', entities };
  if (has(/\b(payment|invoice|refund|receipt|paid|price|cost|fee|how much)\b/) && !has(/\bbooth\b/)) {
    return { intent: 'payment_help', entities };
  }
  if (has(/\b(wifi|wi-fi|food|cafeteria|coffee|restrooms?|toilets?|parking|entrances?|registration desk|lost)\b/)) {
    return { intent: 'venue_info', entities };
  }
  if (has(/\b(speakers?|presenters?|panelists?|who is speaking)\b/)) return { intent: 'speaker_search', entities };
  // Plurals matter here: "sessions", "workshops", "panels" are the common phrasings.
  if (has(/\b(sessions?|workshops?|seminars?|keynotes?|talks?|presentations?|panels?|agendas?|schedules?|calendar)\b/)) {
    return { intent: 'session_search', entities };
  }
  // Product/category questions are answered with the catalogue plus booth locations.
  if (has(/\b(sells?|selling|products?|solutions?|offers?|looking for|electronics?|software|hardware|sensors?|robots?|drones?)\b/)) {
    return { intent: 'product_search', entities };
  }
  const asksForSomeone =
    (has(/\b(exhibitors?|compan(y|ies)|vendors?|brands?|startups?)\b/) && has(/where|find|locate|location|address|stand|which|list|show/)) ||
    // "What is the location of ABC Technologies?" — a company named by the user.
    (has(/\b(location|address|booth|stand)\b/) && has(/\bof\b/) && entities.keywords.length > 0);
  if (asksForSomeone) return { intent: 'exhibitor_location', entities };
  if (has(/\b(expos?|exhibitions?|events?|conferences?|fairs?)\b/) && has(/when|date|where|venue|location|about|detail|start|end|open/)) {
    return { intent: 'expo_info', entities };
  }
  if (has(/\b(expos?|exhibitions?|events?|conferences?|fairs?|who is exhibiting|exhibitors?)\b/)) return { intent: 'expo_overview', entities };

  return { intent: 'unknown', entities };
};

module.exports = { detectIntent, extractKeywords, detectTimeHint, detectSessionType };

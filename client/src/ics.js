import { uid, parseISO } from './utils.js';

/* ============================================================
   .ics (RFC 5545) IMPORT — pure parsing, no DOM/state here.
   Scoped to the common cases (single events, and RRULEs with
   FREQ=DAILY/WEEKLY/MONTHLY/YEARLY, BYDAY, UNTIL) rather than full RFC 5545 —
   INTERVAL other than 1, COUNT, EXDATE, and named timezones aren't modeled,
   since Gaja's own recurrence engine (engine.js:fires) doesn't have anywhere
   to put most of that anyway. Every result goes through a review step
   (edit/icsImport.js) before anything is added, same as the app's other
   import-shaped features (syllabus-style review-and-correct).
   ============================================================ */
const DOW_MAP = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

/* RFC 5545 line folding: a line starting with a space/tab continues the previous one */
function unfold(text) {
  const out = [];
  for (const line of text.replace(/\r\n/g, '\n').split('\n')) {
    if ((line.startsWith(' ') || line.startsWith('\t')) && out.length) out[out.length - 1] += line.slice(1);
    else if (line.trim()) out.push(line);
  }
  return out;
}

function parseLine(line) {
  const i = line.indexOf(':');
  if (i < 0) return null;
  const [key, ...paramParts] = line.slice(0, i).split(';');
  const params = {};
  for (const p of paramParts) { const [k, v] = p.split('='); if (k) params[k.toUpperCase()] = v; }
  return { key: key.toUpperCase(), params, value: line.slice(i + 1) };
}

const unescape = s => (s || '').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\n/gi, ' ').trim();

/* "20260315T090000Z" / "20260315T090000" / "20260315" (VALUE=DATE) */
function parseDT(raw, params) {
  const m = String(raw).match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  const date = `${y}-${mo}-${d}`;
  if (params.VALUE === 'DATE' || h == null) return { date, time: null, allDay: true };
  return { date, time: `${h}:${mi}`, allDay: false };
}

/* PT1H30M / PT45M / P1DT2H — minute granularity is enough here */
function parseDuration(iso) {
  const m = String(iso).match(/P(?:\d+W)?(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/);
  if (!m) return 60;
  const [, d, h, mi] = m;
  return (Number(d) || 0) * 1440 + (Number(h) || 0) * 60 + (Number(mi) || 0);
}

function parseRRule(raw) {
  const parts = {};
  raw.split(';').forEach(p => { const [k, v] = p.split('='); if (k) parts[k.toUpperCase()] = v; });
  return parts;
}

export function parseICS(text) {
  const raw = [];
  let cur = null;
  for (const parsed of unfold(text).map(parseLine)) {
    if (!parsed) continue;
    const { key, params, value } = parsed;
    if (key === 'BEGIN' && value === 'VEVENT') { cur = {}; continue; }
    if (key === 'END' && value === 'VEVENT') { if (cur) raw.push(cur); cur = null; continue; }
    if (!cur) continue;
    if (key === 'SUMMARY') cur.title = unescape(value);
    else if (key === 'DTSTART') cur.dtstart = parseDT(value, params);
    else if (key === 'DTEND') cur.dtend = parseDT(value, params);
    else if (key === 'DURATION') cur.durationMin = parseDuration(value);
    else if (key === 'RRULE') cur.rrule = parseRRule(value);
    else if (key === 'LOCATION') cur.location = unescape(value);
  }
  return raw.map(normalize).filter(Boolean);
}

function addMinutes(hhmm, mins) {
  const [h, m] = hhmm.split(':').map(Number);
  const total = ((h * 60 + m + mins) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function normalize(e) {
  if (!e.dtstart) return null;
  const allDay = !!e.dtstart.allDay;
  const start = e.dtstart.time || '09:00';
  const end = (e.dtend && e.dtend.time) || addMinutes(start, e.durationMin || 60);

  let repeat = 'once', days = [], until = null;
  if (e.rrule) {
    const freq = (e.rrule.FREQ || '').toUpperCase();
    if (freq === 'DAILY') repeat = 'daily';
    else if (freq === 'WEEKLY') {
      repeat = 'weekly';
      days = e.rrule.BYDAY
        ? e.rrule.BYDAY.split(',').map(d => DOW_MAP[d.trim().slice(-2)]).filter(n => n != null)
        : [parseISO(e.dtstart.date).getDay()];
    } else if (freq === 'MONTHLY') repeat = 'monthly';
    else if (freq === 'YEARLY') repeat = 'yearly';
    if (e.rrule.UNTIL) { const u = parseDT(e.rrule.UNTIL, {}); if (u) until = u.date; }
  }

  return {
    id: uid(), title: e.title || 'Imported event', date: e.dtstart.date,
    repeat, days, until, start, end, allDay, location: e.location || '',
  };
}

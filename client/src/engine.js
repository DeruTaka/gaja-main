import { state } from './state.js';
import { getCat, isTask } from './categories.js';
import { t2m, clock, dur, iso, parseISO, addDays, daysBetween, clamp, TODAY } from './utils.js';

/* ============================================================
   THE ENGINE
   ============================================================ */
let VERSION = 0; // bumped on every mutation; invalidates caches
export const bump = () => { VERSION++; dayCache.clear(); studyCache.clear(); };
const dayCache = new Map();
const studyCache = new Map();

export const markKey = (date, src, i = 0) => `${date}|${src}|${i}`;
export const getMark = (date, src, i = 0) => state.S.marks[markKey(date, src, i)] || null;

/* --- does a rule fire on this date? --- */
export function fires(rule, dstr, d) {
  if (rule.from && dstr < rule.from) return false;
  if (rule.until && dstr > rule.until) return false;
  switch (rule.repeat) {
    case 'once': return dstr === rule.date;
    case 'daily': return true;
    case 'weekly': return (rule.days || []).includes(d.getDay());
    case 'monthly': return parseISO(rule.date).getDate() === d.getDate();
    case 'yearly': { const a = parseISO(rule.date); return a.getDate() === d.getDate() && a.getMonth() === d.getMonth(); }
    default: return false;
  }
}

/* an accepted adaptive suggestion that raises this week's study cap for a goal
   (see adaptive.js) — separate from priorityOverrides, which only affects who
   wins a slot when two things compete for the same time; this actually grants
   more study minutes per day, which is the part that catches an exam back up */
function effectiveCap(goal, dstr) {
  let cap = (Number(goal.maxDaily) || 3) * 60;
  for (const o of state.S.capOverrides || []) {
    if (o.goalId === goal.id && dstr >= o.from && dstr <= o.until) cap += (Number(o.extraMinutes) || 0);
  }
  return cap;
}

/* --- assessments: minutes to study each day, with catch-up --- */
export function studyMap(goal) {
  const hit = studyCache.get(goal.id);
  if (hit && hit.v === VERSION) return hit.map;
  const map = {}; let done = 0;
  const total = (Number(goal.hours) || 0) * 60;
  let d = goal.from > state.S.created ? goal.from : state.S.created;
  let guard = 0;
  while (d <= goal.deadline && guard++ < 800) {
    const cap = effectiveCap(goal, d);
    const left = Math.max(0, total - done);
    const daysLeft = Math.max(1, daysBetween(d, goal.deadline)); // exam day itself is not a study day
    let target = left <= 0 ? 0 : clamp(Math.ceil(left / daysLeft / 5) * 5, 0, cap);
    if (daysLeft <= 1) target = Math.min(left, cap);
    map[d] = target;
    const mk = getMark(d, goal.id, 0);
    if (d < TODAY) done += (mk && mk.done) ? (mk.mins ?? target) : 0; // missed days roll forward
    else done += (mk && mk.skipped) ? 0 : target;
    d = iso(addDays(parseISO(d), 1));
  }
  studyCache.set(goal.id, { v: VERSION, map });
  return map;
}

export function studyProgress(goal) {
  const total = (Number(goal.hours) || 0) * 60; let done = 0;
  for (const k in state.S.marks) {
    const [dt, src] = k.split('|');
    if (src === goal.id && state.S.marks[k].done) done += (state.S.marks[k].mins ?? 0) || (studyMap(goal)[dt] || 0);
  }
  return { done, total, pct: total ? clamp(done / total, 0, 1) : 0 };
}

/* an accepted adaptive suggestion doesn't touch the rule directly — it just lowers
   its effective priority for a date range, and the existing conflict-resolution
   pass in layout() does the actual trimming/moving from there (see adaptive.js) */
function effectivePri(rule, dstr) {
  for (const o of state.S.priorityOverrides || []) {
    if (o.ruleId === rule.id && dstr >= o.from && dstr <= o.until) return o.pri;
  }
  return rule.pri;
}

/* --- collect everything that wants a slot on this date --- */
function candidates(dstr, win) {
  const d = parseISO(dstr), out = [];
  const push = c => out.push(Object.assign({
    idx: 0, rigid: false, split: false, minMin: 15, movable: true, allowInside: [],
  }, c));

  for (const r of state.S.rules) {
    if (!fires(r, dstr, d)) continue;
    const c = getCat(r.cat);
    let start = t2m(r.start), end = t2m(r.end);
    if (end <= start) end += 1440; // crosses midnight
    const mk = getMark(dstr, r.id);
    if (mk && mk.skipped) continue;
    if (mk && mk.start) { const s = t2m(mk.start), e = t2m(mk.end); start = s; end = e > s ? e : e + 1440; }
    const padB = r.travelBefore || 0, padA = r.travelAfter || 0; // travel rides with the block
    push({
      src: r.id, cat: r.cat, title: (mk && mk.title) || r.title, pri: effectivePri(r, dstr),
      start: start - padB, end: end + padA, padB, padA,
      rigid: c.rigid, movable: !c.rigid, carve: r.cat === 'work' && !!r.mealBreak,
      split: c.split && !padB && !padA,
      minMin: r.minMin || (c.rigid ? end - start + padB + padA : Math.max(15, Math.round((end - start) * 0.5)) + padB + padA),
      place: r.place, mode: r.mode, note: r.note,
      drift: c.rigid ? 0 : ({ habit: 180, health: 360, special: 240 }[r.cat] || 0),
    });
  }

  for (const g of state.S.goals) {
    if (g.kind === 'assessment') {
      if (dstr === g.deadline) {
        const s = t2m(g.examTime || '09:00');
        push({
          src: g.id, cat: 'assessment', title: `${g.title} — exam`, pri: 1, order: 0.5, start: s, end: s + (Number(g.examLen) || 120),
          rigid: true, movable: false, idx: 9, place: g.place, isExam: true,
        });
        continue;
      }
      if (dstr < g.from || dstr > g.deadline) continue;
      const mins = studyMap(g)[dstr] || 0;
      if (mins < 10) continue;
      const mk = getMark(dstr, g.id);
      if (mk && mk.skipped) continue;
      let s = t2m(g.pref || '18:00'), e = s + mins;
      if (mk && mk.start) { s = t2m(mk.start); e = t2m(mk.end); }
      push({
        src: g.id, cat: 'assessment', title: `Study — ${g.title}`, pri: g.pri, start: s, end: e,
        split: true, minMin: 30, isStudy: true, goal: g.id,
      });
    }
    if (g.kind === 'tournament') {
      if (dstr === g.deadline) {
        const s = t2m(g.startTime || '09:00');
        push({
          src: g.id, cat: 'tournament', title: `${g.title}`, pri: g.pri, order: 0.5, start: s, end: s + (Number(g.len) || 240),
          rigid: true, movable: false, idx: 9, place: g.place,
        });
      }
    }
  }

  /* meals */
  const P = state.S.profile;
  if (P.meals && P.meals.length) {
    const span = win.end - win.start;
    P.meals.forEach((m, i) => {
      const mk = getMark(dstr, 'meal' + i);
      if (mk && mk.skipped) return;
      let s;
      if (m.time) s = t2m(m.time);
      else {
        const anchor = [win.start + 45, Math.max(win.start + 240, 750), Math.max(win.start + 360, win.end - 210),
          win.start + Math.round(span * 0.55), win.end - 90][Math.min(i, 4)];
        s = Math.round(clamp(anchor, win.start + 15, win.end - 40) / 15) * 15;
      }
      let e = s + (Number(m.len) || 30);
      if (mk && mk.start) { s = t2m(mk.start); e = t2m(mk.end); }
      push({
        src: 'meal' + i, cat: 'meal', title: m.name, pri: 1, start: s, end: e, minMin: 20, drift: 240,
        order: m.time ? 2 : 3.5, // an unspecified meal fills gaps, it does not claim them
        canCarve: !!P.mealAtWork,
      });
    });
  }
  return out;
}

/* --- overlap helpers --- */
const hits = (a, b) => a.start < b.end && b.start < a.end;
function freeGaps(placed, win) {
  const busy = placed.map(p => ({ s: p.start, e: p.end })).sort((a, b) => a.s - b.s);
  const gaps = []; let cur = win.start;
  for (const b of busy) {
    if (b.s > cur) gaps.push({ s: cur, e: Math.min(b.s, win.end) });
    cur = Math.max(cur, b.e);
    if (cur >= win.end) break;
  }
  if (cur < win.end) gaps.push({ s: cur, e: win.end });
  return gaps.filter(g => g.e - g.s >= 5);
}
const clipGaps = (gaps, a, b) => gaps.map(g => ({ s: Math.max(g.s, a), e: Math.min(g.e, b) })).filter(g => g.e - g.s >= 5);
function nearestFit(gaps, pref, len) {
  let best = null, d = Infinity;
  for (const g of gaps) {
    if (g.e - g.s < len) continue;
    const s = clamp(pref, g.s, g.e - len), dd = Math.abs(s - pref);
    if (dd < d) { d = dd; best = { start: s, end: s + len, moved: dd > 0 }; }
  }
  return best;
}
const widest = gaps => gaps.reduce((m, g) => !m || (g.e - g.s) > (m.e - m.s) ? g : m, null);

/* --- the placement pass: priority wins, and nothing ever shares a minute --- */
function layout(cands, win) {
  const placed = [], conflicts = [];
  const ord = c => c.order ?? c.pri;
  cands.sort((a, b) => ord(a) - ord(b) || (b.rigid ? 1 : 0) - (a.rigid ? 1 : 0) || a.start - b.start);

  const clear = (s, e) => s >= win.start - 1 && e <= win.end + 1 && !placed.some(p => hits({ start: s, end: e }, p));
  const take = (c, slot) => placed.push(Object.assign({}, c, slot));

  /* a workday with a meal break can be opened up to let a meal sit between two halves */
  function carve(c, len, strict) {
    for (const p of placed.filter(x => x.carve)) {
      const inS = p.start + (p.padB || 0), inE = p.end - (p.padA || 0);
      if (strict && !(c.start >= inS && c.end <= inE)) continue; // the break you asked for, not one invented
      const lo = inS + 45, hi = inE - 45; // leave real work on both sides
      if (hi - lo < len) continue;
      const s = clamp(c.start, lo, hi - len);
      if (c.drift && Math.abs(s - c.start) > c.drift) continue;
      const i = placed.indexOf(p);
      placed.splice(i, 1,
        Object.assign({}, p, { end: s, padA: 0, part: 'x' }),
        Object.assign({}, p, { start: s + len, padB: 0, part: 'x' }));
      // carved-in blocks don't own a timeframe of their own — they live wherever the
      // rigid block around them has room, so dragging can't treat them like a normal event
      take(c, { start: s, end: s + len, moved: s !== c.start, carved: true });
      return true;
    }
    return false;
  }

  for (const c of cands) {
    const want = c.end - c.start;

    if (c.rigid || !c.movable) { // cannot be moved or shortened in real life
      if (clear(c.start, c.end)) { placed.push(c); continue; }
      const clash = placed.find(p => hits(c, p));
      conflicts.push({
        item: c, kind: 'clash', why: !clash ? 'Falls outside your waking hours.'
          : clash.rigid ? `Runs into ${clash.title}, and neither can be shortened. Gaja kept ${clash.title} — this one needs a real-world move.`
            : `Overlaps ${clash.title} (priority ${clash.pri}).`,
      });
      continue;
    }

    if (clear(c.start, c.end)) { placed.push(c); continue; } // exactly where you asked

    const all = freeGaps(placed, win);
    const near = c.drift ? clipGaps(all, c.start - c.drift, c.end + c.drift) : all;

    if (c.canCarve && carve(c, want, true)) continue; // 1. take the meal break you said you had

    let slot = nearestFit(near, c.start, want); // 2. same length, close to the time you gave
    if (slot) { take(c, slot); continue; }

    if (c.split) { // 3. break it into pieces that do fit
      const pieces = []; let left = want;
      for (const g of near.slice().sort((a, b) => Math.abs(a.s - c.start) - Math.abs(b.s - c.start))) {
        if (left <= 0) break;
        const grab = Math.min(left, g.e - g.s);
        if (grab < c.minMin) continue;
        pieces.push({ start: g.s, end: g.s + grab }); left -= grab;
      }
      if (pieces.length && left < want) {
        pieces.sort((a, b) => a.start - b.start).forEach((p, i) => take(c, Object.assign({}, p,
          { idx: 100 + i, part: pieces.length > 1 ? `${i + 1}/${pieces.length}` : '', moved: true })));
        if (left > 0) conflicts.push({ item: c, kind: 'short', why: `Only ${dur(want - left)} of ${dur(want)} fits today.` });
        continue;
      }
    }

    const roomNear = widest(near); // 4. a shorter session, still near the time
    if (roomNear && roomNear.e - roomNear.s >= c.minMin) {
      const len = Math.min(roomNear.e - roomNear.s, want);
      take(c, { start: roomNear.s, end: roomNear.s + len, moved: true });
      conflicts.push({ item: c, kind: 'short', why: `Trimmed to ${dur(len)} — the hours around ${clock(c.start)} are full.` });
      continue;
    }

    if (c.canCarve && carve(c, want, false)) { // 5. eat at your desk rather than not at all
      conflicts.push({ item: c, kind: 'moved', why: `Moved into your work hours — nothing was open near ${clock(c.start)}.` });
      continue;
    }

    slot = nearestFit(all, c.start, want); // 6. full length, anywhere in the day
    if (slot) {
      take(c, slot);
      conflicts.push({ item: c, kind: 'moved', why: `Moved to ${clock(slot.start)} — nothing was free near ${clock(c.start)}.` });
      continue;
    }

    const roomAny = widest(all); // 7. shorter, anywhere in the day
    if (roomAny && roomAny.e - roomAny.s >= c.minMin) {
      const len = Math.min(roomAny.e - roomAny.s, want);
      take(c, { start: roomAny.s, end: roomAny.s + len, moved: true });
      conflicts.push({ item: c, kind: 'short', why: `Cut to ${dur(len)} at ${clock(roomAny.s)} — the only opening left today.` });
      continue;
    }

    conflicts.push({
      item: c, kind: 'drop', // 8. genuinely nowhere to put it
      why: `Needs ${dur(want)} and the day has no opening left. Dropped so nothing double-books.`,
    });
  }
  placed.sort((a, b) => a.start - b.start || a.pri - b.pri);
  return { placed, conflicts };
}

/* --- one day, fully resolved --- */
export function buildDay(dstr) {
  const hit = dayCache.get(dstr);
  if (hit && hit.v === VERSION) return hit.day;
  const P = state.S.profile;
  const wake = t2m(P.wake); let sleep = t2m(P.sleep);
  if (sleep <= wake) sleep += 1440;
  const win = { start: wake, end: sleep };
  const cands = candidates(dstr, win);
  const { placed, conflicts } = layout(cands, win);
  const booked = placed.reduce((s, p) => s + (p.end - p.start), 0);

  const events = [];
  for (const p of placed) { // split the travel padding back out
    const inS = p.start + (p.padB || 0), inE = p.end - (p.padA || 0);
    if (p.padB) events.push(Object.assign({}, p, {
      cat: 'travel', title: `Travel → ${p.title}`,
      start: p.start, end: inS, src: p.src + ':t1', parent: p.src, padB: 0, padA: 0, part: '',
    }));
    events.push(Object.assign({}, p, { start: inS, end: inE, parent: p.src }));
    if (p.padA) events.push(Object.assign({}, p, {
      cat: 'travel', title: 'Travel home',
      start: inE, end: p.end, src: p.src + ':t2', parent: p.src, padB: 0, padA: 0, part: '',
    }));
  }
  events.sort((a, b) => a.start - b.start || a.end - b.end);

  /* last line of defence: the view is only ever handed a clean, disjoint timeline */
  for (let i = 1; i < events.length; i++) {
    const prev = events[i - 1], cur = events[i];
    if (cur.start < prev.end) {
      if (cur.end - prev.end >= 10) { cur.start = prev.end; cur.trimmed = true; }
      else {
        conflicts.push({ item: cur, kind: 'drop', why: `Would have landed on top of ${prev.title}. Removed to keep the day clean.` });
        events.splice(i--, 1);
      }
    }
  }

  const seen = {}; // number the pieces of anything that got broken up
  events.forEach(e => { if (e.part && e.cat !== 'travel') seen[e.src] = (seen[e.src] || 0) + 1; });
  const run = {};
  events.forEach(e => {
    if (!e.part || e.cat === 'travel') return;
    run[e.src] = (run[e.src] || 0) + 1;
    e.part = seen[e.src] > 1 ? `${run[e.src]}/${seen[e.src]}` : '';
  });

  const gaps = freeGaps(events, win).filter(g => g.e - g.s >= 150);
  const busy = events.filter(p => p.cat !== 'travel').reduce((s, p) => s + (p.end - p.start), 0);
  const asked = cands.reduce((s, c) => s + (c.end - c.start), 0);
  const room = win.end - win.start;
  const lost = conflicts.filter(c => c.kind === 'drop' || c.kind === 'clash');
  const day = {
    date: dstr, win, events, conflicts, gaps, busy,
    free: Math.max(0, room - booked),
    overload: lost.length ? { asked, room, over: Math.max(0, asked - room), lost: lost.length } : null,
  };
  dayCache.set(dstr, { v: VERSION, day });
  return day;
}

/* work/class/meals aren't "tasks" (categories.js:isTask) — this is the shared
   source of truth for both the day view's completion card and the done-toggle
   in wire.js, which updates that card in place without a full repaint (see the
   note there), so both need to compute the exact same number. */
export function taskCompletion(dstr) {
  const day = buildDay(dstr);
  const srcs = [...new Set(day.events.filter(e => isTask(e.cat)).map(e => e.src))];
  const done = srcs.filter(src => { const mk = getMark(dstr, src); return mk && mk.done; }).length;
  return { done, total: srcs.length, pct: srcs.length ? Math.round(done / srcs.length * 100) : null };
}

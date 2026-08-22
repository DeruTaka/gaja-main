import { state } from './state.js';
import { buildDay, getMark, markKey } from './engine.js';
import { source } from './edit/source.js';
import { isTask } from './categories.js';
import { TODAY, addDays, iso, parseISO, uid } from './utils.js';

/* ============================================================
   CATCH-UP PROMPTS — always on, independent of the adaptive-scheduling toggle.
   The morning after a task went unmarked, offer to add it to today (or let it
   go) — one prompt per task, in the same 🔔 panel as adaptive suggestions.

   Only rule-based tasks are candidates (source(src).kind === 'rule') — a missed
   study session or exam isn't a "did you get to this" question, it's already
   accounted for by studyMap()'s own rollover (engine.js — a missed day's
   target minutes just get redistributed across the days still left before the
   deadline). Work/Classes/Meals are excluded the same way they're excluded
   from completion tracking (categories.js:isTask) — nothing to catch up on
   for a fixed block that either happened or didn't.
   ============================================================ */
const yesterday = () => iso(addDays(parseISO(TODAY), -1));

function computeCatchups() {
  const y = yesterday();
  if (y < state.S.created) return []; // yesterday predates the plan — nothing to have missed
  const day = buildDay(y);
  const seen = new Set(), out = [];
  for (const e of day.events) {
    if (e.cat === 'travel' || !isTask(e.cat) || seen.has(e.src)) continue;
    seen.add(e.src);
    const s = source(e.src);
    if (!s || s.kind !== 'rule') continue; // goal-derived (study/exam/tournament match) — not a catch-up candidate
    const mk = getMark(y, e.src);
    if (mk && (mk.done || mk.skipped)) continue; // already resolved one way or the other
    out.push({ id: `catchup:${e.src}:${y}`, src: e.src, date: y, title: e.title, cat: e.cat });
  }
  return out;
}

/* a dismissed/added catch-up is recorded as a normal skip mark on yesterday's
   occurrence — reusing the exact mechanism day-to-day edits already use, so a
   fresh computeCatchups() naturally stops finding it, no separate tracking */
export const pendingCatchups = () => computeCatchups();

export function addCatchupToToday(c) {
  const orig = state.S.rules.find(r => r.id === c.src);
  if (!orig) return;
  state.S.marks[markKey(c.date, c.src)] = Object.assign({}, getMark(c.date, c.src), { skipped: true });
  state.S.rules.push({
    id: uid(), cat: orig.cat, title: `${orig.title} (catch-up)`, pri: orig.pri,
    repeat: 'once', date: TODAY, from: TODAY, start: orig.start, end: orig.end,
  });
}
export function dismissCatchup(c) {
  state.S.marks[markKey(c.date, c.src)] = Object.assign({}, getMark(c.date, c.src), { skipped: true });
}

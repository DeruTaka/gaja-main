import { state } from './state.js';
import { studyMap, studyProgress } from './engine.js';
import { getCat, priLocked } from './categories.js';
import { TODAY, daysBetween, iso, addDays, parseISO, t2m, uid } from './utils.js';

/* ============================================================
   ADAPTIVE SCHEDULING — off by default (fully rigid, today's behavior).
   When on: watches assessments for falling behind pace and proposes trading
   time from a lower-priority category into study, as an Accept/Ignore/Deny
   suggestion — it never changes anything on its own. Accepting does two
   things, both scoped to just the one week:
     1. raises the goal's effective daily study cap (engine.js:studyMap reads
        S.capOverrides) by however much the pace actually needs — this is the
        part that genuinely buys the exam more study time, not just a reshuffle
     2. lowers the traded-away rule's effective priority (engine.js:candidates
        reads S.priorityOverrides), so if the now-longer study block does land
        on top of it, study wins
   Both let the *existing* conflict-resolution pass in layout() do the actual
   placement — same mechanism, same Adjustments-panel transparency as always.
   ============================================================ */

function mondayOf(dstr) {
  const d = parseISO(dstr);
  const back = d.getDay() === 0 ? 6 : d.getDay() - 1;
  return iso(addDays(d, -back));
}

/* only a genuinely recurring weekly/daily load is worth suggesting against —
   a one-off occurrence isn't an ongoing "this week" trade-off */
function weeklyMinutes(rule) {
  if (!rule.start || !rule.end) return 0;
  let mins = t2m(rule.end) - t2m(rule.start);
  if (mins <= 0) mins += 1440;
  if (rule.repeat === 'daily') return mins * 7;
  if (rule.repeat === 'weekly') return mins * (rule.days || []).length;
  return 0;
}

/* fixed-life-scaffolding categories (locked priority) are never up for trading;
   otherwise anything normal/low priority (3-4) is fair game, same bar whether
   it's a built-in category (health/hobby/habit) or a user-defined one */
function isReducible(cat) {
  if (priLocked(cat)) return false;
  const c = getCat(cat);
  return !c.rigid && (Number(c.pri) || 4) >= 3;
}

/* an assessment is "at risk" when today's study target is already pinned at the
   daily cap — studyMap() clamps to that cap, so being pinned there means the
   natural pace calls for *more* than the cap allows: mathematically behind,
   not just busy. Reusing studyMap/studyProgress exactly as buildDay() does. */
function computeSuggestions() {
  if (!state.S.profile.adaptive) return [];
  const weekStart = mondayOf(TODAY), weekEnd = iso(addDays(parseISO(weekStart), 6));
  const out = [];
  for (const g of state.S.goals) {
    if (g.kind !== 'assessment') continue;
    const daysLeft = daysBetween(TODAY, g.deadline);
    if (daysLeft < 0 || daysLeft > 14) continue;
    const prog = studyProgress(g);
    if (prog.pct >= 0.999) continue;
    const cap = (Number(g.maxDaily) || 3) * 60;
    if ((studyMap(g)[TODAY] || 0) < cap - 1) continue; // not actually pinned at the cap

    // how much more per day the pace actually needs, beyond what the cap allows —
    // this is the number that goes into the cap override if accepted, not a guess
    const left = Math.max(0, prog.total - prog.done);
    const neededPerDay = left / Math.max(1, daysLeft);
    const shortfall = Math.max(15, Math.ceil((neededPerDay - cap) / 15) * 15);

    const target = state.S.rules
      .filter(r => isReducible(r.cat))
      .map(r => ({ r, mins: weeklyMinutes(r) }))
      .filter(x => x.mins > 0)
      .sort((a, b) => b.mins - a.mins)[0];
    if (!target) continue;

    const capH = Math.round(cap / 6) / 10;
    out.push({
      id: `${g.id}:${target.r.id}:${weekStart}`, goalId: g.id, ruleId: target.r.id,
      targetCat: target.r.cat, weekStart, weekEnd, extraMinutes: shortfall,
      reason: `${g.title} needs about ${shortfall}m/day more than your ${capH}h/day study cap, with ${daysLeft} day${daysLeft === 1 ? '' : 's'} left. Raise this week's cap and drop ${target.r.title} to make room?`,
    });
  }
  return out;
}

export const pendingSuggestions = () => computeSuggestions().filter(s => !(s.id in (state.S.suggestionResponses || {})));

export function acceptSuggestion(s) {
  const r = state.S.rules.find(x => x.id === s.ruleId);
  const pri = Math.min(4, (r ? r.pri : 4) + 2); // push it two tiers lower (floor: 4, the lowest)
  state.S.priorityOverrides = state.S.priorityOverrides || [];
  state.S.capOverrides = state.S.capOverrides || [];
  state.S.priorityOverrides.push({ id: uid(), ruleId: s.ruleId, from: s.weekStart, until: s.weekEnd, pri });
  state.S.capOverrides.push({ id: uid(), goalId: s.goalId, from: s.weekStart, until: s.weekEnd, extraMinutes: s.extraMinutes });
  state.S.suggestionResponses = state.S.suggestionResponses || {};
  state.S.suggestionResponses[s.id] = 'accepted';
}
export function denySuggestion(s) {
  state.S.suggestionResponses = state.S.suggestionResponses || {};
  state.S.suggestionResponses[s.id] = 'denied';
}

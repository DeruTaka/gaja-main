/* ---------- categories ---------- */
export const CAT = {
  work:       { label: 'Work',          icon: '💼', v: '--work',       pri: 1, rigid: true,  split: false },
  class:      { label: 'Classes',       icon: '🎓', v: '--class',      pri: 1, rigid: true,  split: false },
  assessment: { label: 'Assessments',   icon: '📚', v: '--assessment', pri: 1, rigid: false, split: true },
  tournament: { label: 'Tournaments',   icon: '🏆', v: '--tournament', pri: 2, rigid: true,  split: false },
  health:     { label: 'Health',        icon: '💪', v: '--health',     pri: 3, rigid: false, split: false },
  meal:       { label: 'Meals',         icon: '🍽️', v: '--meal',       pri: 1, rigid: false, split: false },
  habit:      { label: 'Daily habits',  icon: '☕', v: '--habit',      pri: 3, rigid: false, split: false },
  hobby:      { label: 'Hobbies',       icon: '🎨', v: '--hobby',      pri: 4, rigid: false, split: true },
  special:    { label: 'Reminders',     icon: '🔔', v: '--special',    pri: 2, rigid: false, split: false },
  travel:     { label: 'Travel',        icon: '🚗', v: '--travel',     pri: 1, rigid: true,  split: false },
  sleep:      { label: 'Sleep',         icon: '😴', v: '--sleep',      pri: 1, rigid: true,  split: false },
};
export const catColor = c => `var(${(CAT[c] || CAT.habit).v})`;
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DOW1 = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/* categories a user can actually create entries for — travel/sleep are structural
   (auto-generated padding, and the wake/sleep window itself), not filterable */
export const RAIL_CATS = ['work', 'class', 'assessment', 'tournament', 'meal', 'health', 'habit', 'hobby', 'special'];

/* the fixed-life-scaffolding categories set up during onboarding — always priority 1,
   and the priority control is hidden from their forms so nothing can knock them down */
export const PRI_LOCKED = new Set(['work', 'class', 'assessment', 'meal']);
export const priLocked = cat => PRI_LOCKED.has(cat);

/* hiding is a pure display filter — it never touches buildDay()'s placement.
   Travel blocks carry cat:'travel' regardless of what they're padding, so a hidden
   category's travel also has to be dropped by cross-referencing its parent's src. */
export function filterHidden(events, hiddenCats) {
  if (!hiddenCats || !hiddenCats.length) return events;
  const hidden = new Set(hiddenCats);
  const hiddenSrc = new Set(events.filter(e => e.cat !== 'travel' && hidden.has(e.cat)).map(e => e.src));
  return events.filter(e => {
    if (hidden.has(e.cat)) return false;
    if (e.cat === 'travel' && hiddenSrc.has(e.parent)) return false;
    return true;
  });
}

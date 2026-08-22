/* ---------- categories ---------- */
import { state } from './state.js';

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
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const DOW1 = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/* ---------- user-defined categories ----------
   a custom category is {id, label, icon, color, pri} living in S.customCats — `id` is
   used everywhere a fixed CAT key is (rule.cat, marks, catColor, ...). It always
   behaves like Hobbies (movable, splittable) — there's no rigid option for a
   freeform tag, since "cannot move" is a real-world constraint the built-ins model,
   not something a user-named category needs. */
export const customCat = id => (state.S?.customCats || []).find(c => c.id === id);

/* resolves a category key (built-in or custom) to its display/behavior definition.
   Every former direct `CAT[x]` lookup goes through this now, since `x` might be a
   custom category id that isn't in the fixed CAT object at all. */
export function getCat(key) {
  if (CAT[key]) return CAT[key];
  const c = customCat(key);
  if (c) return { label: c.label, icon: c.icon, pri: c.pri, rigid: false, split: true };
  return CAT.habit; // orphaned category (e.g. deleted custom cat) — generic fallback, never errors
}

/* built-ins use a CSS variable (themeable, defined in style.css); a custom category
   carries its own literal color chosen at creation time — there's no variable for it. */
export function catColor(key) {
  const c = CAT[key];
  if (c) return `var(${c.v})`;
  const custom = customCat(key);
  return custom ? custom.color : 'var(--habit)';
}

/* categories a user can actually create entries for — travel/sleep are structural
   (auto-generated padding, and the wake/sleep window itself), not filterable */
const RAIL_CATS_FIXED = ['work', 'class', 'assessment', 'tournament', 'meal', 'health', 'habit', 'hobby', 'special'];
export const railCats = () => [...RAIL_CATS_FIXED, ...(state.S?.customCats || []).map(c => c.id)];

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

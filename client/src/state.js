import { TODAY } from './utils.js';
import { store, KEY } from './api/store.js';

/* ---------- state ----------
   rules   : recurring or one-off blocks the engine lays down
   goals   : assessments + tournaments (hour targets w/ deadlines)
   marks   : per-instance overrides  { "2026-08-04|ruleId|0": {done, start, end, title, skipped} }

   `state` is a single mutable container (rather than bare module-scope `let`s, as
   gaja.html used) because ES modules don't let other modules reassign an imported
   `let` binding — every module that needs to read or write S/D/step/view/cursor
   imports this same object and mutates its properties in place. */
export const state = {
  S: null,       // the saved plan: {profile, rules, goals, marks, dismissed, created}
  D: null,       // onboarding draft: {work:[], class:[], ...}
  step: 0,       // onboarding step index
  view: 'day',   // 'day' | 'month' | 'year'
  cursor: TODAY, // date string the current view is centered on
};

export const blank = () => ({
  profile: { name: '', place: '', hasPlace: false, wake: '07:00', sleep: '23:00',
             meals: [], autoMeals: true, mealCount: 3, mealAtWork: true, hiddenCats: [] },
  rules: [], goals: [], marks: {}, dismissed: {}, created: TODAY,
});

export const save = () => store.set(KEY, state.S);

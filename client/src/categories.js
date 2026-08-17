/* ---------- categories ---------- */
export const CAT = {
  work:       { label: 'Work',          icon: '💼', v: '--work',       pri: 1, rigid: true,  split: false },
  class:      { label: 'Classes',       icon: '🎓', v: '--class',      pri: 1, rigid: true,  split: false },
  assessment: { label: 'Assessments',   icon: '📚', v: '--assessment', pri: 1, rigid: false, split: true },
  tournament: { label: 'Tournaments',   icon: '🏆', v: '--tournament', pri: 2, rigid: true,  split: false },
  health:     { label: 'Health',        icon: '💪', v: '--health',     pri: 3, rigid: false, split: false },
  meal:       { label: 'Meals',         icon: '🍽️', v: '--meal',       pri: 2, rigid: false, split: false },
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

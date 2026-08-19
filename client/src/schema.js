import { clock, t2m, dur, iso, addDays } from './utils.js';
import { F, ROW } from './ui/fields.js';
import { travelFields, modeField, daysLabel } from './ui/forms.js';

/* ============================================================
   ENTRY SCHEMAS  (one shape per category)
   ============================================================ */
const LOCKED_PRI = `<div class="hint">Priority 1 · locked — set up during onboarding, this always gets its slot first.</div>`;

export const SCHEMA = {
  work: {
    cat: 'work', add: 'Add a job', blank: () => ({ title: 'Work', days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00', mode: 'In person', miles: '', vmin: '', mealBreak: true, pri: 1 }),
    sum: e => `${daysLabel(e.days)} · ${clock(t2m(e.start))}–${clock(t2m(e.end))}${e.mode === 'In person' && e.miles ? ` · ${e.miles} mi` : ''}`,
    form: e => F(e, { k: 'title', t: 'text', label: 'Name' }) + F(e, { k: 'days', t: 'days', label: 'Days' })
      + ROW(F(e, { k: 'start', t: 'time', label: 'Starts' }), F(e, { k: 'end', t: 'time', label: 'Ends' }))
      + modeField(e) + travelFields(e)
      + F(e, { k: 'mealBreak', t: 'check', label: 'There is a meal break inside these hours', hint: 'Lets Gaja put lunch inside the workday instead of around it.' })
      + LOCKED_PRI,
  },

  class: {
    cat: 'class', add: 'Add a class', blank: () => ({ title: '', days: [2, 4], start: '13:00', end: '14:30', mode: 'In person', miles: '', vmin: '', pri: 1 }),
    sum: e => `${daysLabel(e.days)} · ${clock(t2m(e.start))}–${clock(t2m(e.end))}`,
    form: e => F(e, { k: 'title', t: 'text', label: 'Class', ph: 'Organic Chemistry II' }) + F(e, { k: 'days', t: 'days', label: 'Days' })
      + ROW(F(e, { k: 'start', t: 'time', label: 'Starts' }), F(e, { k: 'end', t: 'time', label: 'Ends' }))
      + modeField(e) + travelFields(e) + LOCKED_PRI,
  },

  health: {
    cat: 'health', add: 'Add a workout or activity', blank: () => ({ title: 'Gym', days: [1, 3, 5], start: '07:30', end: '08:30', mode: 'In person', miles: '', vmin: '', plan: '', pri: 3 }),
    sum: e => `${daysLabel(e.days)} · ${clock(t2m(e.start))}–${clock(t2m(e.end))}`,
    form: e => F(e, { k: 'title', t: 'text', label: 'Activity', ph: 'Gym, volleyball, run' }) + F(e, { k: 'days', t: 'days', label: 'Days' })
      + ROW(F(e, { k: 'start', t: 'time', label: 'Starts' }), F(e, { k: 'end', t: 'time', label: 'Ends' }))
      + F(e, { k: 'plan', t: 'text', label: 'Split (optional)', ph: 'chest / pull / legs' })
      + modeField(e) + travelFields(e) + F(e, { k: 'pri', t: 'pri', label: 'Priority' }),
  },

  hobby: {
    cat: 'hobby', add: 'Add a hobby', blank: () => ({ title: '', days: [6], start: '15:00', end: '17:00', pri: 4 }),
    sum: e => `${daysLabel(e.days)} · ${clock(t2m(e.start))}–${clock(t2m(e.end))}`,
    form: e => F(e, { k: 'title', t: 'text', label: 'Hobby', ph: 'Guitar, drawing, climbing' }) + F(e, { k: 'days', t: 'days', label: 'Days' })
      + ROW(F(e, { k: 'start', t: 'time', label: 'Starts' }), F(e, { k: 'end', t: 'time', label: 'Ends' }))
      + F(e, { k: 'pri', t: 'pri', label: 'Priority', hint: 'Hobbies give way to anything more urgent, and Gaja will split them across gaps.' }),
  },

  habit: {
    cat: 'habit', add: 'Add a habit', blank: () => ({ title: '', days: [0, 1, 2, 3, 4, 5, 6], start: '07:05', len: 15, pri: 3 }),
    sum: e => `${daysLabel(e.days)} · ${clock(t2m(e.start))} · ${dur(Number(e.len) || 15)}`,
    form: e => F(e, { k: 'title', t: 'text', label: 'Habit', ph: 'Shower, coffee, stretch' }) + F(e, { k: 'days', t: 'days', label: 'Days' })
      + ROW(F(e, { k: 'start', t: 'time', label: 'Around' }), F(e, { k: 'len', t: 'num', label: 'Minutes', min: 5, max: 240 }))
      + F(e, { k: 'pri', t: 'pri', label: 'Priority' }),
  },

  special: {
    cat: 'special', add: 'Add a reminder', blank: () => ({ title: '', date: iso(new Date()), repeat: 'Yearly', start: '10:00', len: 60, pri: 2 }),
    sum: e => `${e.repeat} · from ${e.date} · ${clock(t2m(e.start))}`,
    form: e => F(e, { k: 'title', t: 'text', label: 'Reminder', ph: 'Annual physical, safety inspection, birthday' })
      + ROW(F(e, { k: 'date', t: 'date', label: 'First date' }), F(e, { k: 'start', t: 'time', label: 'Time' }))
      + ROW(F(e, { k: 'len', t: 'num', label: 'Minutes', min: 10, max: 600 }), '')
      + F(e, { k: 'repeat', t: 'choice', label: 'Repeats', opts: ['Once', 'Weekly', 'Monthly', 'Yearly'] })
      + F(e, { k: 'pri', t: 'pri', label: 'Priority' }),
  },

  assessment: {
    cat: 'assessment', add: 'Add an exam or certification',
    blank: () => ({
      title: '', subject: '', deadline: iso(addDays(new Date(), 30)), hours: 20, maxDaily: 2, pref: '18:00',
      examTime: '09:00', examLen: 120, mode: 'In person', place: '', pri: 1,
    }),
    sum: e => `${e.deadline} · ${e.hours}h of study · ${e.maxDaily}h/day cap`,
    form: e => F(e, { k: 'title', t: 'text', label: 'Exam or certification', ph: 'CompTIA Security+' })
      + F(e, { k: 'subject', t: 'text', label: 'Class or subject (optional)' })
      + ROW(F(e, { k: 'deadline', t: 'date', label: 'Exam date' }), F(e, { k: 'examTime', t: 'time', label: 'Exam starts' }))
      + ROW(F(e, { k: 'hours', t: 'num', label: 'Total study hours needed', min: 1, max: 600 }),
            F(e, { k: 'maxDaily', t: 'num', label: 'Max study hours per day', min: 0.5, max: 12, step: '0.5' }))
      + F(e, { k: 'pref', t: 'time', label: 'Preferred study time', hint: 'Gaja spreads the hours to the exam date and catches up whatever you miss.' })
      + modeField(e) + (e.mode === 'In person' ? F(e, { k: 'place', t: 'text', label: 'Test centre', ph: 'Where you sit the exam' }) : '')
      + LOCKED_PRI,
  },

  tournament: {
    cat: 'tournament', add: 'Add a tournament',
    blank: () => ({
      title: '', deadline: iso(addDays(new Date(), 21)), startTime: '09:00', len: 300,
      days: [2, 4], start: '18:00', end: '20:00', place: '', pri: 2,
    }),
    sum: e => `${e.deadline} · practice ${daysLabel(e.days)}`,
    form: e => F(e, { k: 'title', t: 'text', label: 'Tournament', ph: 'Regional volleyball' })
      + ROW(F(e, { k: 'deadline', t: 'date', label: 'Date' }), F(e, { k: 'startTime', t: 'time', label: 'Starts' }))
      + ROW(F(e, { k: 'len', t: 'num', label: 'Minutes', min: 30, max: 900 }), F(e, { k: 'place', t: 'text', label: 'Location (optional)' }))
      + `<div class="field"><span class="flabel">Practice</span></div>`
      + F(e, { k: 'days', t: 'days', label: 'Practice days' })
      + ROW(F(e, { k: 'start', t: 'time', label: 'Practice starts' }), F(e, { k: 'end', t: 'time', label: 'Practice ends' }))
      + F(e, { k: 'pri', t: 'pri', label: 'Priority', hint: 'Set this above classes if the season outranks coursework this month.' }),
  },
};

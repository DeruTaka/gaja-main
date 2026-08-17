import { state, blank } from '../state.js';
import { CAT } from '../categories.js';
import { t2m, m2t, clock, iso, addDays, parseISO, uid, clamp, TODAY } from '../utils.js';
import { entryTravel } from '../travel.js';
import { F, ROW } from '../ui/fields.js';
import { collection, daysLabel } from '../ui/forms.js';
import { bump } from '../engine.js';
import { save } from '../state.js';

export const newDraft = () => ({ work: [], class: [], health: [], hobby: [], habit: [], special: [], assessment: [], tournament: [] });

export const STEPS = [
  {
    no: 'Start', title: '', render: () => `
    <div class="hero">
      <div class="step-no">Gaja · life scheduler</div>
      <h1>Tell it once.<br><span class="mark">It plans the year.</span></h1>
      <p>Gaja takes your fixed hours — work, classes, an exam you have not started studying for — and
      fills everything around them. Answer what applies, skip what doesn't.</p>
      <div class="hero-list">
        <div><span>01</span><span>Your fixed hours: work, classes, practice.</span></div>
        <div><span>02</span><span>Your targets: exam hours, tournament dates, habits you keep dropping.</span></div>
        <div><span>03</span><span>A year of days, resolved by priority, editable anywhere.</span></div>
      </div>
    </div>
    <div class="field" style="margin-top:34px">${F(state.S.profile, { k: 'name', t: 'text', label: 'What should Gaja call you?', ph: 'Optional' })}</div>`,
  },

  {
    no: 'Step 1', title: 'Where are you based?', lede: 'This is optional. Share a location and Gaja can ask for real places later; skip it and it will only ever ask how far away something is.',
    render: () => F(state.S.profile, { k: 'hasPlace', t: 'check', label: 'Use my location for travel estimates', hint: 'Nothing leaves this device.' })
      + (state.S.profile.hasPlace ? F(state.S.profile, { k: 'place', t: 'text', label: 'Home area', ph: 'Alexandria, VA' }) : ''),
  },

  {
    no: 'Step 2', title: 'When does your day start and end?', lede: 'Everything else gets laid inside these two edges. Gaja will never schedule you past them.',
    render: () => ROW(F(state.S.profile, { k: 'wake', t: 'time', label: 'Wake up' }), F(state.S.profile, { k: 'sleep', t: 'time', label: 'Sleep' })),
  },

  {
    no: 'Step 3', title: 'Work', lede: 'Fixed hours that cannot shrink. Priority 1 by default.',
    render: () => collection('work', state.D.work, { empty: 'No job to schedule around.' }),
  },

  {
    no: 'Step 4', title: 'Classes', lede: 'Same idea as work: these hold their slot no matter what else wants it.',
    render: () => collection('class', state.D.class, { empty: 'Not in school right now.' }),
  },

  {
    no: 'Step 5', title: 'Meals', lede: 'Give exact times if you keep them. Leave them blank and Gaja spaces meals across your waking hours, using whatever gaps the day leaves.',
    render: () => F(state.S.profile, { k: 'mealCount', t: 'num', label: 'Meals per day', min: 0, max: 5, re: true })
      + F(state.S.profile, { k: 'autoMeals', t: 'check', label: 'Let Gaja pick the times', re: true })
      + (state.S.profile.autoMeals ? '' : mealTimeFields())
      + F(state.S.profile, { k: 'mealAtWork', t: 'check', label: 'One meal can happen inside my work hours', hint: 'Only applies to jobs you marked as having a meal break.' }),
  },

  {
    no: 'Step 6', title: 'Health', lede: 'Gym, sport, physio, a walk. Repetitive by design — but Gaja will trade a session away when an exam is close.',
    render: () => collection('health', state.D.health, { empty: 'No standing activity yet.' }),
  },

  {
    no: 'Step 7', title: 'Assessments', lede: 'Exams and certifications. Give the total hours you need; Gaja divides them across the days you have left and re-divides whenever you miss one.',
    render: () => collection('assessment', state.D.assessment, { empty: 'Nothing on the calendar to study for.' }),
  },

  {
    no: 'Step 8', title: 'Tournaments', lede: 'A date you have to be ready for, plus the practices leading to it.',
    render: () => collection('tournament', state.D.tournament, { empty: 'No competition dates.' }),
  },

  {
    no: 'Step 9', title: 'Reminders', lede: 'The once-a-year things that are easy to forget: physical, dentist, safety and emissions inspection, birthdays.',
    render: () => collection('special', state.D.special, { empty: 'Nothing to remember yet.' })
      + `<div class="hint" style="margin-top:12px">Common ones: ${['Annual physical', 'Dentist', 'Safety inspection', 'Emissions inspection', 'VIN inspection']
        .map(n => `<button class="chip" data-quick="${n}" style="margin:4px 4px 0 0">+ ${n}</button>`).join('')}</div>`,
  },

  {
    no: 'Step 10', title: 'Daily habits', lede: 'Small anchors — shower, coffee, stretching. They give the rest of the day something to sit against.',
    render: () => collection('habit', state.D.habit, { empty: 'No habits tracked.' }),
  },

  {
    no: 'Step 11', title: 'Hobbies', lede: 'The first thing to bend when the week gets tight, and the first thing Gaja offers back when it loosens.',
    render: () => collection('hobby', state.D.hobby, { empty: 'No hobbies scheduled.' }),
  },

  {
    no: 'Last', title: 'Ready to build', lede: 'Gaja will lay out the next twelve months, resolve every collision by priority, and open on today.',
    render: () => {
      const n = k => state.D[k].length;
      const lines = [
        ['Waking hours', `${clock(t2m(state.S.profile.wake))} – ${clock(t2m(state.S.profile.sleep))}`],
        ['Work', n('work') ? `${n('work')} · ${state.D.work.map(e => daysLabel(e.days)).join(', ')}` : 'none'],
        ['Classes', n('class') || 'none'], ['Meals', state.S.profile.mealCount + ' a day'],
        ['Health', n('health') || 'none'], ['Assessments', n('assessment') || 'none'],
        ['Tournaments', n('tournament') || 'none'], ['Reminders', n('special') || 'none'],
        ['Habits', n('habit') || 'none'], ['Hobbies', n('hobby') || 'none'],
      ];
      return `<div class="card">${lines.map(([a, b]) => `<div class="stat"><span>${a}</span><b>${String(b)}</b></div>`).join('')}</div>`;
    },
  },
];

export function mealTimeFields() {
  syncMeals();
  return state.S.profile.meals.map((m, i) => ROW(
    F(m, { k: 'name', t: 'text', label: `Meal ${i + 1}` }),
    F(m, { k: 'time', t: 'time', label: 'Time' }),
    F(m, { k: 'len', t: 'num', label: 'Minutes', min: 5, max: 180 }))).join('');
}
export function syncMeals() {
  const P = state.S.profile, want = clamp(Number(P.mealCount) || 0, 0, 5);
  const names = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Late snack'];
  P.meals = P.meals || [];
  while (P.meals.length < want) P.meals.push({ name: names[P.meals.length] || 'Meal', time: '', len: 30 });
  P.meals.length = want;
  if (P.autoMeals) P.meals.forEach(m => m.time = '');
}

/* ---------- draft → engine ---------- */
export function draftToItems(D) {
  const rules = [], goals = [];
  const withTravel = (e, base) => {
    const m = entryTravel(e, t2m(e.start));
    return Object.assign(base, { travelBefore: m, travelAfter: m, place: e.place || '', mode: e.mode, miles: e.miles, vmin: e.vmin });
  };
  D.work.forEach(e => rules.push(withTravel(e, { id: uid(), cat: 'work', title: e.title || 'Work', pri: Number(e.pri) || 1, repeat: 'weekly', days: e.days || [], start: e.start, end: e.end, mealBreak: !!e.mealBreak })));
  D.class.forEach(e => rules.push(withTravel(e, { id: uid(), cat: 'class', title: e.title || 'Class', pri: Number(e.pri) || 1, repeat: 'weekly', days: e.days || [], start: e.start, end: e.end })));
  D.health.forEach(e => rules.push(withTravel(e, { id: uid(), cat: 'health', title: e.title || 'Workout', pri: Number(e.pri) || 3, repeat: 'weekly', days: e.days || [], start: e.start, end: e.end, note: e.plan })));
  D.hobby.forEach(e => rules.push({ id: uid(), cat: 'hobby', title: e.title || 'Hobby', pri: Number(e.pri) || 4, repeat: 'weekly', days: e.days || [], start: e.start, end: e.end }));
  D.habit.forEach(e => rules.push({
    id: uid(), cat: 'habit', title: e.title || 'Habit', pri: Number(e.pri) || 3,
    repeat: (e.days || []).length === 7 ? 'daily' : 'weekly', days: e.days || [], start: e.start,
    end: m2t(t2m(e.start) + (Number(e.len) || 15)),
  }));
  D.special.forEach(e => {
    const rep = { Once: 'once', Weekly: 'weekly', Monthly: 'monthly', Yearly: 'yearly' }[e.repeat] || 'once';
    rules.push({
      id: uid(), cat: 'special', title: e.title || 'Reminder', pri: Number(e.pri) || 2, repeat: rep,
      date: e.date, days: [parseISO(e.date).getDay()], from: e.date,
      start: e.start, end: m2t(t2m(e.start) + (Number(e.len) || 60)),
    });
  });
  D.assessment.forEach(e => goals.push({
    id: uid(), kind: 'assessment', cat: 'assessment', title: e.title || 'Exam',
    pri: Number(e.pri) || 1, from: TODAY, deadline: e.deadline, hours: Number(e.hours) || 10,
    maxDaily: Number(e.maxDaily) || 2, pref: e.pref || '18:00', examTime: e.examTime, examLen: Number(e.examLen) || 120,
    place: e.place, mode: e.mode, subject: e.subject,
  }));
  D.tournament.forEach(e => {
    goals.push({ id: uid(), kind: 'tournament', cat: 'tournament', title: e.title || 'Tournament', pri: Number(e.pri) || 2, deadline: e.deadline, startTime: e.startTime, len: Number(e.len) || 240, place: e.place });
    if ((e.days || []).length) rules.push({ id: uid(), cat: 'tournament', title: `${e.title || 'Team'} practice`, pri: Number(e.pri) || 2, repeat: 'weekly', days: e.days, start: e.start, end: e.end, until: e.deadline, place: e.place });
  });
  return { rules, goals };
}
export function compile() {
  const it = draftToItems(state.D);
  state.S.rules = it.rules; state.S.goals = it.goals;
  syncMeals(); bump();
}
export function finish() { compile(); save(); }

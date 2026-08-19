import { state } from '../state.js';
import { t2m, m2t } from '../utils.js';
import { buildDay, getMark, markKey } from '../engine.js';
import { entryTravel } from '../travel.js';
import { priLocked } from '../categories.js';
import { F, ROW } from '../ui/fields.js';
import { modeField, travelFields } from '../ui/forms.js';
import { SCHEMA } from '../schema.js';
import { modal, closeModal, toast, commit, layer } from '../ui/modal.js';

/* ---------- find whatever a scheduled block came from ---------- */
export function source(src) {
  src = src.replace(/:t\d$/, '');
  const r = state.S.rules.find(x => x.id === src); if (r) return { kind: 'rule', o: r };
  const g = state.S.goals.find(x => x.id === src); if (g) return { kind: 'goal', o: g };
  if (/^meal\d+$/.test(src)) return { kind: 'meal', o: state.S.profile.meals[Number(src.slice(4))], idx: Number(src.slice(4)) };
  return null;
}

/* ---------- edit ---------- */
export function openEdit(src, date) {
  const s = source(src);
  if (!s) return toast('Travel blocks follow the event they belong to.');
  const repeating = (s.kind === 'rule' && s.o.repeat !== 'once') || s.kind === 'meal'
    || (s.kind === 'goal' && s.o.kind === 'assessment');
  if (!repeating) return editSeries(src, date);
  modal({
    title: 'Edit which?', body: `
    <button class="pick" data-scope="one"><b>This day only</b><small>${date} keeps its own times. Every other ${
      s.kind === 'goal' ? 'study session' : 'occurrence'} stays as it is.</small></button>
    <button class="pick" data-scope="all"><b>Every one of these</b><small>Changes the whole series from here on.</small></button>`,
  });
  layer().querySelectorAll('[data-scope]').forEach(b => b.onclick = () =>
    b.dataset.scope === 'one' ? editInstance(src, date) : editSeries(src, date));
}

export function editInstance(src, date) {
  const day = buildDay(date), ev = day.events.find(e => e.src === src);
  const mk = getMark(date, src) || {};
  const tmp = { title: mk.title || (ev ? ev.title : ''), start: m2t(ev ? ev.start : 540), end: m2t(ev ? ev.end : 600) };
  modal({
    title: `${date} only`,
    body: F(tmp, { k: 'title', t: 'text', label: 'Title' }) + ROW(F(tmp, { k: 'start', t: 'time', label: 'Starts' }), F(tmp, { k: 'end', t: 'time', label: 'Ends' })),
    foot: `<button class="btn danger" data-skip>Skip this day</button><div class="spacer"></div>
           <button class="btn" data-close2>Cancel</button><button class="btn primary" data-save>Save</button>`,
  });
  layer().querySelector('[data-close2]').onclick = closeModal;
  layer().querySelector('[data-skip]').onclick = () => {
    state.S.marks[markKey(date, src)] = Object.assign({}, mk, { skipped: true }); closeModal(); commit(); toast('Removed from this day.');
  };
  layer().querySelector('[data-save]').onclick = () => {
    if (t2m(tmp.end) <= t2m(tmp.start)) return toast('The end time has to come after the start.');
    state.S.marks[markKey(date, src)] = Object.assign({}, mk, { title: tmp.title, start: tmp.start, end: tmp.end, skipped: false });
    closeModal(); commit(); toast('This day updated.');
  };
}

export function editSeries(src, date) {
  const s = source(src);
  if (s.kind === 'goal') {
    const key = s.o.kind === 'assessment' ? 'assessment' : 'tournament';
    const tmp = Object.assign({}, s.o);
    modal({
      title: `Edit ${s.o.title || 'goal'}`, body: SCHEMA[key].form(tmp),
      foot: `<button class="btn danger" data-del2>Delete</button><div class="spacer"></div>
            <button class="btn primary" data-save>Save</button>`,
    });
    layer().querySelector('[data-save]').onclick = () => {
      const pri = priLocked(key) ? 1 : (Number(tmp.pri) || 1);
      Object.assign(s.o, tmp, { hours: Number(tmp.hours) || 1, maxDaily: Number(tmp.maxDaily) || 1, pri });
      closeModal(); commit(); toast('Series updated.');
    };
    layer().querySelector('[data-del2]').onclick = () => {
      state.S.goals = state.S.goals.filter(g => g !== s.o); closeModal(); commit(); toast('Deleted.');
    };
    return;
  }
  if (s.kind === 'meal') {
    const m = s.o, tmp = Object.assign({}, m);
    modal({
      title: `Edit ${m.name}`,
      body: ROW(F(tmp, { k: 'name', t: 'text', label: 'Name' }), F(tmp, { k: 'time', t: 'time', label: 'Time' }), F(tmp, { k: 'len', t: 'num', label: 'Minutes', min: 5, max: 180 }))
        + `<div class="hint">Leave the time empty to let Gaja place it in the day's gaps.</div>`
        + `<div class="hint">Priority 1 · locked — set up during onboarding, this always gets its slot first.</div>`,
      foot: `<div class="spacer"></div><button class="btn primary" data-save>Save</button>`,
    });
    layer().querySelector('[data-save]').onclick = () => {
      Object.assign(m, tmp); if (m.time) state.S.profile.autoMeals = false; closeModal(); commit(); toast('Meal updated.');
    };
    return;
  }
  const r = s.o, tmp = Object.assign({}, r, { len: t2m(r.end) - t2m(r.start) });
  const isTimed = r.cat !== 'habit';
  const locked = priLocked(r.cat);
  modal({
    title: `Edit ${r.title}`,
    body: F(tmp, { k: 'title', t: 'text', label: 'Title' })
      + (r.repeat === 'weekly' ? F(tmp, { k: 'days', t: 'days', label: 'Days' }) : `<div class="hint">Repeats ${r.repeat}.</div>`)
      + ROW(F(tmp, { k: 'start', t: 'time', label: 'Starts' }), isTimed ? F(tmp, { k: 'end', t: 'time', label: 'Ends' }) : F(tmp, { k: 'len', t: 'num', label: 'Minutes', min: 5 }))
      + (r.mode ? modeField(tmp) + travelFields(tmp) : '')
      + (locked ? `<div class="hint">Priority 1 · locked — set up during onboarding, this always gets its slot first.</div>` : F(tmp, { k: 'pri', t: 'pri', label: 'Priority' })),
    foot: `<button class="btn danger" data-del2>Delete series</button><div class="spacer"></div>
          <button class="btn primary" data-save>Save</button>`,
  });
  layer().querySelector('[data-save]').onclick = () => {
    const end = isTimed ? tmp.end : m2t(t2m(tmp.start) + (Number(tmp.len) || 15));
    if (t2m(end) === t2m(tmp.start)) return toast('Give it some length.');
    const trav = r.mode ? entryTravel(tmp, t2m(tmp.start)) : 0;
    Object.assign(r, {
      title: tmp.title, days: tmp.days, start: tmp.start, end, pri: locked ? 1 : (Number(tmp.pri) || r.pri),
      mode: tmp.mode, miles: tmp.miles, vmin: tmp.vmin, place: tmp.place,
      travelBefore: trav, travelAfter: trav,
    });
    closeModal(); commit(); toast('Series updated.');
  };
  layer().querySelector('[data-del2]').onclick = () => {
    state.S.rules = state.S.rules.filter(x => x !== r); closeModal(); commit(); toast('Deleted.');
  };
}

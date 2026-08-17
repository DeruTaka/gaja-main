import { state } from '../state.js';
import { iso, addDays, esc } from '../utils.js';
import { CAT, catColor } from '../categories.js';
import { SCHEMA } from '../schema.js';
import { buildDay, bump } from '../engine.js';
import { save } from '../state.js';
import { draftToItems, newDraft } from '../onboarding/steps.js';
import { modal, closeModal, toast, layer } from '../ui/modal.js';
import { paint } from '../views/paint.js';

/* ---------- add ---------- */
export const ADDABLE = ['work', 'class', 'health', 'assessment', 'tournament', 'special', 'habit', 'hobby'];
export function openAdd(preset) {
  modal({
    title: 'What kind of event?', body: `<div class="catgrid">${ADDABLE.map(k =>
      `<button data-cat="${k}" style="--c:${catColor(SCHEMA[k].cat)}"><span>${CAT[SCHEMA[k].cat].icon}</span><b>${CAT[SCHEMA[k].cat].label}</b></button>`).join('')}</div>`,
  });
  layer().querySelectorAll('[data-cat]').forEach(b => b.onclick = () => addForm(b.dataset.cat, preset));
  if (preset && preset.cat) addForm(preset.cat, preset);
}
function addForm(key, preset, problems) {
  const e = addForm.draft && addForm.key === key ? addForm.draft : Object.assign(SCHEMA[key].blank(), (preset && preset.fields) || {});
  addForm.draft = e; addForm.key = key;
  modal({
    title: SCHEMA[key].add,
    body: (problems ? `<div class="err"><b>Cannot fit this in</b>${problems.map(p =>
      `${p.date}: ${esc(p.why)}`).join('<br>')}<br><br>Lower another item's priority, shorten this one, or pick a different time.</div>` : '')
      + SCHEMA[key].form(e),
    foot: `<div class="spacer"></div><button class="btn" data-back>Back</button><button class="btn primary" data-save>Check and add</button>`,
  });
  layer().querySelector('[data-back]').onclick = () => { addForm.draft = null; openAdd(); };
  layer().querySelector('[data-save]').onclick = () => {
    if (!String(e.title || '').trim()) return toast('Give it a name first.');
    if (SCHEMA[key].cat !== 'assessment' && SCHEMA[key].cat !== 'special' && 'days' in e && !(e.days || []).length)
      return toast('Pick at least one day.');
    const res = tryAdd(key, e);
    if (res.ok) { addForm.draft = null; closeModal(); save(); paint(); toast('Added — the schedule rebuilt around it.'); }
    else addForm(key, null, res.problems);
  };
}
/* the feasibility gate: add it, look at the next ~45 live days, roll back if it never fits */
export function tryAdd(key, e) {
  const built = draftToItems(Object.assign(newDraft(), { [key]: [e] }));
  const ids = [...built.rules, ...built.goals].map(x => x.id);
  state.S.rules.push(...built.rules); state.S.goals.push(...built.goals); bump();
  const problems = []; let seen = 0;
  for (let i = 0; i < 420 && seen < 45 && problems.length < 3; i++) {
    const ds = iso(addDays(new Date(), i));
    const day = buildDay(ds);
    const mine = day.events.some(x => ids.includes(x.parent || x.src));
    const bad = day.conflicts.filter(c => ids.includes(c.item.src) && c.kind === 'clash');
    if (mine || bad.length) seen++;
    if (bad.length) problems.push({ date: ds, why: bad[0].why });
  }
  if (!seen) problems.push({ date: 'Never', why: 'This event never lands on a day inside the next year.' });
  if (problems.length) {
    state.S.rules = state.S.rules.filter(r => !ids.includes(r.id));
    state.S.goals = state.S.goals.filter(g => !ids.includes(g.id));
    bump();
  }
  return { ok: !problems.length, problems };
}

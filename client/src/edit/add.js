import { state } from '../state.js';
import { iso, addDays, esc, uid } from '../utils.js';
import { getCat, catColor, priLocked } from '../categories.js';
import { getSchema } from '../schema.js';
import { F, ROW } from '../ui/fields.js';
import { buildDay, bump } from '../engine.js';
import { save } from '../state.js';
import { draftToItems, newDraft } from '../onboarding/steps.js';
import { modal, closeModal, toast, layer } from '../ui/modal.js';
import { paint } from '../views/paint.js';

/* ---------- add ---------- */
const ADDABLE_FIXED = ['work', 'class', 'health', 'assessment', 'tournament', 'special', 'habit', 'hobby'];
const addableKeys = () => [...ADDABLE_FIXED, ...(state.S.customCats || []).map(c => c.id)];
export function openAdd(preset) {
  modal({
    title: 'What kind of event?', body: `<div class="catgrid">${addableKeys().map(k =>
      `<button data-cat="${k}" style="--c:${catColor(k)}"><span>${getCat(k).icon}</span><b>${getCat(k).label}</b></button>`).join('')
      }<button data-new-cat style="--c:var(--graphite-dim)"><span>➕</span><b>New category</b></button></div>`,
  });
  layer().querySelectorAll('[data-cat]').forEach(b => b.onclick = () => addForm(b.dataset.cat, preset));
  const newCatBtn = layer().querySelector('[data-new-cat]');
  if (newCatBtn) newCatBtn.onclick = () => openNewCategory(preset);
  if (preset && preset.cat) addForm(preset.cat, preset);
}

/* create a user-defined category, then continue straight into its add-entry form —
   same behavior class as Hobbies (movable, splittable), see categories.js:getCat */
function openNewCategory(preset) {
  const draft = { label: '', icon: '🏷️', color: '#7C9CF5', pri: 4 };
  modal({
    title: 'New category',
    body: F(draft, { k: 'label', t: 'text', label: 'Name', ph: 'Volunteering, side project...' })
      + ROW(F(draft, { k: 'icon', t: 'text', label: 'Icon', ph: '🎗️' }), F(draft, { k: 'color', t: 'color', label: 'Color' }))
      + F(draft, { k: 'pri', t: 'pri', label: 'Priority' }),
    foot: `<div class="spacer"></div><button class="btn" data-back>Back</button><button class="btn primary" data-save>Create</button>`,
  });
  layer().querySelector('[data-back]').onclick = () => openAdd(preset);
  layer().querySelector('[data-save]').onclick = () => {
    if (!String(draft.label || '').trim()) return toast('Give the category a name first.');
    const cat = { id: uid(), label: draft.label.trim(), icon: draft.icon || '🏷️', color: draft.color, pri: Number(draft.pri) || 4 };
    state.S.customCats = state.S.customCats || [];
    state.S.customCats.push(cat); save();
    addForm(cat.id, preset);
  };
}

function addForm(key, preset, problems) {
  const sc = getSchema(key);
  const e = addForm.draft && addForm.key === key ? addForm.draft : Object.assign(sc.blank(), (preset && preset.fields) || {});
  addForm.draft = e; addForm.key = key;
  modal({
    title: sc.add,
    body: (problems ? `<div class="err"><b>Cannot fit this in</b>${problems.map(p =>
      `${p.date}: ${esc(p.why)}`).join('<br>')}<br><br>Lower another item's priority, shorten this one, or pick a different time.</div>` : '')
      + sc.form(e),
    foot: `<div class="spacer"></div><button class="btn" data-back>Back</button><button class="btn primary" data-save>Check and add</button>`,
  });
  layer().querySelector('[data-back]').onclick = () => { addForm.draft = null; openAdd(); };
  layer().querySelector('[data-save]').onclick = () => {
    if (!String(e.title || '').trim()) return toast('Give it a name first.');
    if (sc.cat !== 'assessment' && sc.cat !== 'special' && 'days' in e && !(e.days || []).length)
      return toast('Pick at least one day.');
    const res = tryAdd(key, e);
    if (res.ok) { addForm.draft = null; closeModal(); save(); paint(); toast('Added — the schedule rebuilt around it.'); }
    else addForm(key, null, res.problems);
  };
}
/* the feasibility gate: add it, look at the next ~45 live days, roll back if it never fits */
export function tryAdd(key, e) {
  if (priLocked(getSchema(key).cat)) e.pri = 1;
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

import { state, blank } from './state.js';
import { store, KEY } from './api/store.js';
import { enabled as authEnabled, logout } from './api/auth.js';
import { esc } from './utils.js';
import { catColor } from './categories.js';
import { F, ROW } from './ui/fields.js';
import { modal, closeModal, commit, layer } from './ui/modal.js';
import { newDraft } from './onboarding/steps.js';
import { renderOnboard } from './onboarding/onboard.js';

/* ---------- settings ---------- */
export function openSettings() {
  const P = state.S.profile, tmp = Object.assign({}, P);
  const cats = state.S.customCats || [];
  modal({
    title: 'Your day', body:
      ROW(F(tmp, { k: 'wake', t: 'time', label: 'Wake up' }), F(tmp, { k: 'sleep', t: 'time', label: 'Sleep' }))
      + F(tmp, { k: 'name', t: 'text', label: 'Name' })
      + F(tmp, { k: 'mealAtWork', t: 'check', label: 'A meal can sit inside work hours' })
      + `<div class="hint">Meals, work, classes and everything else are edited straight from the day view — click the ✎ on any block.</div>`
      + F(tmp, { k: 'adaptive', t: 'check', label: 'Adaptive scheduling',
          hint: 'Off: your schedule stays exactly as set, every time. On: Gaja watches for exams falling behind pace and suggests trading time from lower-priority activities — always as a suggestion in 🔔, never automatically.' })
      + `<div class="flabel" style="margin-top:22px">Your categories</div>`
      + (cats.length
        ? cats.map(c => `<div class="entry-head" style="padding:9px 4px">
            <span class="ico" style="color:${catColor(c.id)}">${c.icon}</span>
            <div style="flex:1;min-width:0"><b>${esc(c.label)}</b></div>
            <button class="iconbtn" data-del-cat="${c.id}" title="Delete" aria-label="Delete ${esc(c.label)}">✕</button>
          </div>`).join('')
        : `<div class="hint">None yet — create one from "+ Add event" when you're adding something that doesn't fit.</div>`),
    foot: `<button class="btn danger" data-reset>Start over</button><div class="spacer"></div>
          ${authEnabled ? '<button class="btn" data-signout>Sign out</button>' : ''}
          <button class="btn primary" data-save>Save</button>`,
  });
  layer().querySelector('[data-save]').onclick = () => { Object.assign(P, tmp); closeModal(); commit(); };
  layer().querySelector('[data-reset]').onclick = async () => {
    await store.del(KEY); state.S = blank(); state.D = newDraft(); state.step = 0; closeModal(); renderOnboard();
  };
  layer().querySelectorAll('[data-del-cat]').forEach(b => b.onclick = () => {
    // any rules already using this category id just fall back to a generic look
    // (categories.js:getCat) — no cascade delete needed
    state.S.customCats = (state.S.customCats || []).filter(c => c.id !== b.dataset.delCat);
    commit(); openSettings();
  });
  const signOut = layer().querySelector('[data-signout]');
  if (signOut) signOut.onclick = async () => { await logout(); location.reload(); };
}

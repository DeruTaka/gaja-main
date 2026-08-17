import { state, blank } from './state.js';
import { store, KEY } from './store.js';
import { F, ROW } from './ui/fields.js';
import { modal, closeModal, commit, layer } from './ui/modal.js';
import { newDraft } from './onboarding/steps.js';
import { renderOnboard } from './onboarding/onboard.js';

/* ---------- settings ---------- */
export function openSettings() {
  const P = state.S.profile, tmp = Object.assign({}, P);
  modal({
    title: 'Your day', body:
      ROW(F(tmp, { k: 'wake', t: 'time', label: 'Wake up' }), F(tmp, { k: 'sleep', t: 'time', label: 'Sleep' }))
      + F(tmp, { k: 'name', t: 'text', label: 'Name' })
      + F(tmp, { k: 'mealAtWork', t: 'check', label: 'A meal can sit inside work hours' })
      + `<div class="hint">Meals, work, classes and everything else are edited straight from the day view — click the ✎ on any block.</div>`,
    foot: `<button class="btn danger" data-reset>Start over</button><div class="spacer"></div>
          <button class="btn primary" data-save>Save</button>`,
  });
  layer().querySelector('[data-save]').onclick = () => { Object.assign(P, tmp); closeModal(); commit(); };
  layer().querySelector('[data-reset]').onclick = async () => {
    await store.del(KEY); state.S = blank(); state.D = newDraft(); state.step = 0; closeModal(); renderOnboard();
  };
}

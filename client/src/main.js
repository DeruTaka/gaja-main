import { state, blank } from './state.js';
import { store, KEY } from './store.js';
import { bump } from './engine.js';
import { mount } from './views/paint.js';
import { renderOnboard } from './onboarding/onboard.js';
import { newDraft } from './onboarding/steps.js';

/* ---------- boot ----------
   Phase 0: same boot sequence gaja.html shipped with, just split into modules —
   the auth gate (Phase 1) slots in front of this once the backend exists. */
(async function boot() {
  const saved = await store.get(KEY);
  if (saved && saved.profile) { state.S = saved; bump(); mount(); }
  else { state.S = blank(); state.D = newDraft(); renderOnboard(); }
})();

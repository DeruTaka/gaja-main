import { state, blank } from './state.js';
import { store, KEY } from './api/store.js';
import { ensureAuthed } from './auth/screen.js';
import { bump } from './engine.js';
import { mount } from './views/paint.js';
import { renderOnboard } from './onboarding/onboard.js';
import { newDraft } from './onboarding/steps.js';

/* ---------- boot ----------
   ensureAuthed() is a no-op unless VITE_API_URL is configured — local dev
   skips straight to loading the (local) plan, same as before. */
(async function boot() {
  await ensureAuthed();
  const saved = await store.get(KEY);
  if (saved && saved.profile) { state.S = saved; bump(); mount(); }
  else { state.S = blank(); state.D = newDraft(); renderOnboard(); }
})();

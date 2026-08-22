import { state, blank } from './state.js';
import { store, KEY } from './api/store.js';
import { ensureAuthed } from './auth/screen.js';
import { esc } from './utils.js';
import { bump } from './engine.js';
import { mount } from './views/paint.js';
import { renderOnboard } from './onboarding/onboard.js';
import { newDraft } from './onboarding/steps.js';
import { toast } from './ui/modal.js';

/* a failed save fires this from state.js (see the note there) — surfaced here,
   not there, to keep state.js free of a dependency on the modal/toast UI */
document.addEventListener('gaja:save-error', e => toast(e.detail?.message || "Couldn't save — check your connection."));

function loadFailed(err) {
  document.getElementById('root').innerHTML = `
  <div class="wrap" style="max-width:480px;padding-top:22vh;text-align:center">
    <div class="step-no">Gaja · life scheduler</div>
    <h1 style="font-family:var(--display);font-size:28px;font-weight:500;margin:10px 0 12px">Couldn't load your plan</h1>
    <p style="color:var(--graphite)">${esc(err.message || 'Something went wrong reaching the server.')} Nothing has been reset — your plan is still saved, this device just couldn't reach it.</p>
    <button class="btn primary" id="retryBoot" style="margin-top:18px">Try again</button>
  </div>`;
  document.getElementById('retryBoot').onclick = () => location.reload();
}

/* ---------- boot ----------
   ensureAuthed() is a no-op unless VITE_API_URL is configured — local dev
   skips straight to loading the (local) plan, same as before. */
(async function boot() {
  await ensureAuthed();
  let saved;
  try { saved = await store.get(KEY); }
  catch (err) { loadFailed(err); return; }
  if (saved && saved.profile) { state.S = saved; bump(); mount(); }
  else { state.S = blank(); state.D = newDraft(); renderOnboard(); }
})();

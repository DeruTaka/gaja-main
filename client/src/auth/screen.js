import { enabled, me, login, signup } from '../api/auth.js';
import { esc } from '../utils.js';

/* ---------- auth gate ----------
   Resolves immediately when no backend is configured (enabled === false) —
   local/dev mode never sees a sign-in screen. Otherwise checks the existing
   session first, and only renders the form if there isn't one. */
export async function ensureAuthed() {
  if (!enabled) return;
  try { await me(); return; } catch { /* not signed in — fall through to the form */ }
  await new Promise(resolve => renderAuthScreen(resolve));
}

function renderAuthScreen(resolve) {
  let mode = 'login', err = '', busy = false;
  const draft = { email: '' };

  const paint = () => {
    document.body.classList.remove('has-rail');
    document.getElementById('root').innerHTML = `
    <div class="ob">
      <div class="ob-head"><div class="wrap">
        <div class="brand"><i></i>Gaja<small>sign in</small></div>
      </div></div>
      <div class="ob-body"><div class="wrap" style="max-width:420px">
        <div class="hero" style="padding-top:4vh">
          <div class="step-no">Gaja · life scheduler</div>
          <h1 style="font-size:clamp(32px,6vw,48px)">${mode === 'login' ? 'Welcome back.' : 'Create your account.'}</h1>
        </div>
        ${err ? `<div class="err">${esc(err)}</div>` : ''}
        <div class="field"><label class="flabel">Email</label>
          <input id="authEmail" type="email" autocomplete="email" value="${esc(draft.email)}"></div>
        <div class="field"><label class="flabel">Password</label>
          <input id="authPass" type="password" autocomplete="${mode === 'login' ? 'current-password' : 'new-password'}">
          ${mode === 'signup' ? '<div class="hint">At least 8 characters.</div>' : ''}</div>
        <button class="btn primary" id="authGo" style="width:100%" ${busy ? 'disabled' : ''}>${
          busy ? 'One moment…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        <button class="btn ghost" id="authSwitch" style="width:100%;margin-top:10px">${
          mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}</button>
      </div></div>
    </div>`;

    document.getElementById('authSwitch').onclick = () => { mode = mode === 'login' ? 'signup' : 'login'; err = ''; paint(); };
    const go = async () => {
      draft.email = document.getElementById('authEmail').value.trim();
      const password = document.getElementById('authPass').value;
      busy = true; err = ''; paint();
      try {
        await (mode === 'login' ? login : signup)(draft.email, password);
        resolve();
      } catch (e) {
        busy = false; err = e.message; paint();
      }
    };
    document.getElementById('authGo').onclick = go;
    document.getElementById('authPass').onkeydown = ev => { if (ev.key === 'Enter') go(); };
  };

  paint();
}

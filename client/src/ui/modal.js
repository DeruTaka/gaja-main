import { esc } from '../utils.js';
import { bump } from '../engine.js';
import { save } from '../state.js';
import { paint } from '../views/paint.js';

/* ============================================================
   INTERACTION
   ============================================================ */
export const layer = () => document.getElementById('layer');
let bodyFn = null; // re-renders just the open modal's body — see refreshModalBody()
export function closeModal() { layer().innerHTML = ''; bodyFn = null; }
export function modal({ title, body, foot }) {
  // `body` can be a plain string (static content) or a function returning HTML —
  // pass a function whenever the body contains a days/choice/priority field, so a
  // click inside it can be reflected without needing a full app repaint
  bodyFn = typeof body === 'function' ? body : null;
  layer().innerHTML = `<div class="scrim"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-h"><h3>${esc(title)}</h3><button class="iconbtn" data-close aria-label="Close">✕</button></div>
    <div class="modal-b">${typeof body === 'function' ? body() : body}</div>${foot ? `<div class="modal-f">${foot}</div>` : ''}</div></div>`;
  layer().querySelector('.scrim').addEventListener('mousedown', e => { if (e.target.classList.contains('scrim')) closeModal(); });
  layer().querySelector('[data-close]').onclick = closeModal;
  const f = layer().querySelector('input,select,button'); if (f) f.focus();
}
/* called by the shared rerender dispatcher (ui/rerender.js) before it falls back
   to a full app repaint — refreshing only .modal-b leaves the footer's Save/Back
   button handlers (attached outside it) untouched */
export function refreshModalBody() {
  if (!bodyFn) return false;
  const el = layer().querySelector('.modal-b');
  if (!el) return false;
  el.innerHTML = bodyFn();
  return true;
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
export function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}
export const commit = () => { bump(); save(); paint(); };

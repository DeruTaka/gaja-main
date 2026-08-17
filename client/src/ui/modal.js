import { esc } from '../utils.js';
import { bump } from '../engine.js';
import { save } from '../state.js';
import { paint } from '../views/paint.js';

/* ============================================================
   INTERACTION
   ============================================================ */
export const layer = () => document.getElementById('layer');
export function closeModal() { layer().innerHTML = ''; }
export function modal({ title, body, foot }) {
  layer().innerHTML = `<div class="scrim"><div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-h"><h3>${esc(title)}</h3><button class="iconbtn" data-close aria-label="Close">✕</button></div>
    <div class="modal-b">${body}</div>${foot ? `<div class="modal-f">${foot}</div>` : ''}</div></div>`;
  layer().querySelector('.scrim').addEventListener('mousedown', e => { if (e.target.classList.contains('scrim')) closeModal(); });
  layer().querySelector('[data-close]').onclick = closeModal;
  const f = layer().querySelector('input,select,button'); if (f) f.focus();
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
export function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}
export const commit = () => { bump(); save(); paint(); };

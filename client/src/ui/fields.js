import { esc } from '../utils.js';
import { DOW, DOW1 } from '../categories.js';
import { rerender } from './rerender.js';

/* ============================================================
   FORM PRIMITIVES
   ============================================================ */
const REG = new Map();
const reg = o => { if (!o._id) { o._id = Math.random().toString(36).slice(2, 9); } REG.set(o._id, o); return o._id; };

export function F(o, d) { // d: {k,t,label,hint,ph,opts,min,max,step}
  const id = reg(o), v = o[d.k];
  const base = `data-e="${id}" data-k="${d.k}"${d.re ? ' data-re="1"' : ''}`;
  const lbl = d.label ? `<label class="flabel" for="i${id}${d.k}">${d.label}</label>` : '';
  let inner = '';
  switch (d.t) {
    case 'text': case 'date': case 'time': case 'num':
      inner = `<input id="i${id}${d.k}" type="${d.t === 'num' ? 'number' : d.t}" ${base}
        value="${esc(v ?? '')}" placeholder="${esc(d.ph || '')}"
        ${d.min != null ? `min="${d.min}"` : ''} ${d.max != null ? `max="${d.max}"` : ''} ${d.step ? `step="${d.step}"` : ''}>`;
      break;
    case 'color':
      inner = `<input id="i${id}${d.k}" type="color" ${base} value="${esc(v || '#7C9CF5')}" style="height:40px;padding:4px;cursor:pointer">`;
      break;
    case 'days':
      inner = `<div class="days" ${base} data-t="days">${DOW1.map((n, i) =>
        `<button type="button" data-day="${i}" aria-pressed="${(v || []).includes(i)}" title="${DOW[i]}">${n}</button>`).join('')}</div>`;
      break;
    case 'choice':
      inner = `<div class="chips" ${base} data-t="choice">${d.opts.map(op =>
        `<button type="button" class="chip" data-val="${esc(op)}" aria-pressed="${v === op}">${esc(op)}</button>`).join('')}</div>`;
      break;
    case 'pri':
      inner = `<div class="pri" ${base} data-t="pri">${[1, 2, 3, 4].map(n =>
        `<button type="button" data-val="${n}" aria-pressed="${Number(v) === n}"><b>${n}</b><small>${
          ['highest', 'high', 'normal', 'low'][n - 1]}</small></button>`).join('')}</div>`;
      break;
    case 'check':
      return `<label class="check"><input type="checkbox" ${base} ${v ? 'checked' : ''}><span>${d.label}${
        d.hint ? `<span class="hint" style="margin:0">${d.hint}</span>` : ''}</span></label>`;
  }
  return `<div class="field">${lbl}${inner}${d.hint && d.t !== 'check' ? `<div class="hint">${d.hint}</div>` : ''}</div>`;
}
export const ROW = (...s) => `<div class="row">${s.join('')}</div>`;

/* one delegated listener for every form control in the app */
document.addEventListener('input', e => {
  const el = e.target.closest('[data-e]'); if (!el || el.dataset.t) return;
  const o = REG.get(el.dataset.e); if (!o) return;
  o[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.value;
  if (el.dataset.re) rerender();
});
document.addEventListener('click', e => {
  const box = e.target.closest('[data-t]'); if (!box) return;
  const btn = e.target.closest('button'); if (!btn) return;
  const o = REG.get(box.dataset.e); if (!o) return;
  const k = box.dataset.k;
  if (box.dataset.t === 'days') {
    const n = Number(btn.dataset.day); const arr = o[k] = (o[k] || []).slice();
    const i = arr.indexOf(n); i < 0 ? arr.push(n) : arr.splice(i, 1);
  } else if (box.dataset.t === 'choice') { o[k] = btn.dataset.val; }
  else if (box.dataset.t === 'pri') { o[k] = Number(btn.dataset.val); }
  rerender();
});

import { esc } from '../utils.js';
import { CAT, catColor, DOW } from '../categories.js';
import { state } from '../state.js';
import { F, ROW } from './fields.js';
import { SCHEMA } from '../schema.js';

/* travel block — location questions bend to what the profile knows */
export function travelFields(o) {
  if (o.mode === 'Virtual')
    return F(o, { k: 'vmin', t: 'num', label: 'Set-up or walk time (optional)', ph: '0', min: 0, max: 120, hint: 'Minutes to get to your desk and log in.' });
  const known = state.S.profile.hasPlace;
  return known
    ? ROW(F(o, { k: 'place', t: 'text', label: 'Where', ph: 'e.g. Rosslyn office' }),
          F(o, { k: 'miles', t: 'num', label: 'Miles from home', ph: '8', min: 0, step: '0.5' }))
    : F(o, { k: 'miles', t: 'num', label: 'Miles from home', ph: '8', min: 0, step: '0.5', hint: 'Gaja pads the drive and adds rush-hour time automatically.' });
}
export const modeField = o => F(o, { k: 'mode', t: 'choice', label: 'In person or virtual', opts: ['In person', 'Virtual'], re: true });

export function daysLabel(ds) {
  if (!ds || !ds.length) return 'no days';
  const s = [...ds].sort((a, b) => a - b);
  if (s.length === 7) return 'Every day';
  if (s.join() === '1,2,3,4,5') return 'Mon–Fri';
  if (s.join() === '0,6') return 'Weekends';
  return s.map(i => DOW[i]).join(' ');
}

/* collection editor used by both onboarding and the settings sheet */
export function collection(key, list, opts = {}) {
  const sc = SCHEMA[key], c = CAT[sc.cat];
  const rows = list.map((e, i) => {
    const open = e._open;
    return `<div class="entry">
      <div class="entry-head" data-toggle="${key}:${i}">
        <span class="ico" style="color:${catColor(sc.cat)}">${c.icon}</span>
        <div style="flex:1;min-width:0">
          <b>${esc(e.title || sc.add.replace('Add a ', ''))}</b>
          <div class="meta">${esc(sc.sum(e))}</div>
        </div>
        <button class="iconbtn" data-del="${key}:${i}" title="Remove" aria-label="Remove">✕</button>
        <span style="color:var(--graphite-dim);font-family:var(--mono);font-size:12px">${open ? '▲' : '▼'}</span>
      </div>
      <div class="entry-body ${open ? '' : 'collapsed'}">${open ? sc.form(e) : ''}</div>
    </div>`;
  }).join('');
  return (list.length ? `<div class="entries">${rows}</div>`
    : `<div class="empty">${opts.empty || 'Nothing here yet — and that is a fine answer.'}</div>`)
    + `<button class="addbtn" data-add="${key}">+ ${sc.add}</button>`;
}

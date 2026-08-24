import { state } from '../state.js';
import { esc, uid, clock, t2m, parseISO } from '../utils.js';
import { getCat, catColor, priLocked, railCats, DOW } from '../categories.js';
import { F } from '../ui/fields.js';
import { bump } from '../engine.js';
import { save } from '../state.js';
import { modal, closeModal, toast, layer } from '../ui/modal.js';
import { paint } from '../views/paint.js';
import { parseICS } from '../ics.js';

const categoryOptions = () => railCats().map(c => ({ value: c, label: `${getCat(c).icon} ${getCat(c).label}` }));

const REPEAT_LABEL = { once: null, daily: 'Every day', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' };
function summaryText(ev) {
  const when = ev.repeat === 'once'
    ? ev.date
    : `${REPEAT_LABEL[ev.repeat]}${ev.days.length ? ' ' + ev.days.map(d => DOW[d]).join(' ') : ''}${ev.until ? ` · until ${ev.until}` : ''}`;
  return `${when} · ${clock(t2m(ev.start))}–${clock(t2m(ev.end))}${ev.allDay ? ' · was all-day, check the time' : ''}`;
}

export function openIcsImport(preset) {
  modal({
    title: 'Import .ics',
    body: `<div class="field"><label class="flabel">Calendar file</label>
        <input type="file" id="icsFile" accept=".ics,text/calendar"></div>
      <div class="hint">Recurring events get simplified to Gaja's own repeat model (daily/weekly/monthly/yearly) —
      unusual patterns (every-2-weeks, a fixed number of occurrences, one-off exceptions) won't carry over exactly.
      You'll get a chance to review and re-categorize everything before anything's added.</div>`,
    foot: `<div class="spacer"></div><button class="btn" data-back>Back</button>`,
  });
  layer().querySelector('[data-back]').onclick = async () => { (await import('./add.js')).openAdd(preset); };
  layer().querySelector('#icsFile').onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    let parsed;
    try { parsed = parseICS(await file.text()); } catch { toast('Could not read that file.'); return; }
    if (!parsed.length) { toast('No events found in that file.'); return; }
    openReview(parsed.map(ev => Object.assign(ev, { cat: 'special' })));
  };
}

/* one delegated listener bound to the stable #layer node, not to any button
   inside it — repaint() below fully replaces the modal's contents on every
   change (bulk-apply, remove), which would silently orphan any handler
   attached directly to those buttons instead */
function openReview(draft) {
  const bulk = { cat: 'special' };

  const render = () => `
    <div class="row" style="align-items:flex-end;margin-bottom:14px">
      ${F(bulk, { k: 'cat', t: 'select', label: `Set all ${draft.length} to`, opts: categoryOptions() })}
      <button class="btn" id="applyBulk" type="button" style="flex:none">Apply</button>
    </div>
    ${draft.map((ev, i) => `<div class="entry-head" style="cursor:default;padding:10px 4px;gap:10px">
        <span class="ico" style="color:${catColor(ev.cat)};flex:none">${getCat(ev.cat).icon}</span>
        <div style="flex:2;min-width:0">
          ${F(ev, { k: 'title', t: 'text' })}
          <div class="meta" style="margin-top:4px">${esc(summaryText(ev))}${ev.location ? ` · ${esc(ev.location)}` : ''}</div>
        </div>
        <div style="flex:1;min-width:140px">${F(ev, { k: 'cat', t: 'select', opts: categoryOptions() })}</div>
        <button class="iconbtn" data-remove-ics="${i}" title="Don't import this one" aria-label="Remove">✕</button>
      </div>`).join('')}
    ${!draft.length ? '<div class="empty">Nothing left to import.</div>' : ''}`;

  const repaint = () => modal({
    title: 'Review before adding',
    body: render,
    foot: `<div class="spacer"></div><button class="btn" data-cancel>Cancel</button>
          <button class="btn primary" data-import ${draft.length ? '' : 'disabled'}>Add ${draft.length} to calendar</button>`,
  });
  repaint();

  const onClick = e => {
    if (e.target.closest('#applyBulk')) { draft.forEach(ev => ev.cat = bulk.cat); repaint(); return; }
    const rm = e.target.closest('[data-remove-ics]');
    if (rm) { draft.splice(Number(rm.dataset.removeIcs), 1); repaint(); return; }
    if (e.target.closest('[data-cancel]')) { layer().removeEventListener('click', onClick); closeModal(); return; }
    if (e.target.closest('[data-import]')) { layer().removeEventListener('click', onClick); commitImport(draft); }
  };
  layer().addEventListener('click', onClick);
}

function commitImport(draft) {
  const rules = draft.map(ev => {
    const pri = priLocked(ev.cat) ? 1 : (Number(getCat(ev.cat).pri) || 3);
    const base = { id: uid(), cat: ev.cat, title: ev.title || 'Imported event', pri, start: ev.start, end: ev.end, from: ev.date, place: ev.location };
    if (ev.repeat === 'once') return Object.assign(base, { repeat: 'once', date: ev.date });
    if (ev.repeat === 'weekly') return Object.assign(base, { repeat: 'weekly', days: ev.days.length ? ev.days : [parseISO(ev.date).getDay()], until: ev.until || undefined });
    if (ev.repeat === 'monthly' || ev.repeat === 'yearly') return Object.assign(base, { repeat: ev.repeat, date: ev.date, until: ev.until || undefined });
    return Object.assign(base, { repeat: 'daily', until: ev.until || undefined });
  });
  state.S.rules.push(...rules);
  bump(); save(); closeModal(); paint();
  toast(`Imported ${rules.length} event${rules.length === 1 ? '' : 's'}.`);
}

import { state } from './state.js';
import { parseISO, iso, addDays, t2m, m2t, TODAY } from './utils.js';
import { getMark, markKey, bump, studyMap } from './engine.js';
import { save } from './state.js';
import { commit, toast } from './ui/modal.js';
import { openAdd } from './edit/add.js';
import { openSettings } from './settings.js';
import { openEdit } from './edit/source.js';
import { wireDrag } from './edit/drag.js';
import { paint } from './views/paint.js';

/* ---------- wiring ---------- */
export function wire() {
  document.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { state.view = b.dataset.view; paint(); });
  document.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => {
    const v = b.dataset.nav;
    if (v === 'today') state.cursor = TODAY;
    else {
      const n = Number(v), d = parseISO(state.cursor);
      if (state.view === 'day') state.cursor = iso(addDays(d, n));
      if (state.view === 'month') state.cursor = iso(new Date(d.getFullYear(), d.getMonth() + n, 1));
      if (state.view === 'year') state.cursor = iso(new Date(d.getFullYear() + n, d.getMonth(), 1));
    }
    paint();
    // month/year views can be taller than the viewport — jumping to today changes
    // the underlying data, but without this the page can stay scrolled to wherever
    // it was, making the click look like it did nothing. Day view already scrolls
    // to "now" on every paint, so it doesn't need this.
    if (v === 'today' && state.view !== 'day') {
      requestAnimationFrame(() => document.querySelector('.mcell.today, .yc.today')?.scrollIntoView({ block: 'center', behavior: 'instant' }));
    }
  });
  document.querySelectorAll('[data-cat-toggle]').forEach(b => b.onclick = () => {
    const c = b.dataset.catToggle;
    const P = state.S.profile;
    P.hiddenCats = P.hiddenCats || [];
    const i = P.hiddenCats.indexOf(c);
    i < 0 ? P.hiddenCats.push(c) : P.hiddenCats.splice(i, 1);
    save(); paint(); // display-only filter — no bump(), the schedule itself never changes
  });

  const add = () => openAdd();
  const ab = document.getElementById('addBtn'); if (ab) ab.onclick = add;
  const fb = document.getElementById('fab'); if (fb) fb.onclick = add;
  const sb = document.getElementById('setBtn'); if (sb) sb.onclick = openSettings;
  document.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { state.cursor = b.dataset.day; state.view = 'day'; paint(); });
  document.querySelectorAll('[data-month]').forEach(b => b.onclick = () => { state.cursor = b.dataset.month; state.view = 'month'; paint(); });

  document.querySelectorAll('.ev').forEach(el => {
    const toggle = () => {
      if (el.dataset.justDragged) { delete el.dataset.justDragged; return; } // the trailing click after a real drag isn't a toggle
      const src = el.dataset.src, mk = getMark(state.cursor, src) || {};
      const on = !mk.done;
      state.S.marks[markKey(state.cursor, src)] = Object.assign(mk, {
        done: on,
        mins: t2m(el.dataset.end) - t2m(el.dataset.start),
      });
      el.classList.toggle('done', on);
      el.setAttribute('aria-pressed', String(on));
      if (on) { el.classList.add('swipe'); setTimeout(() => el.classList.remove('swipe'), 520); }
      bump(); save();
    };
    el.onclick = ev => { if (ev.target.closest('[data-edit]')) return; toggle(); };
    el.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); toggle(); } };
  });
  document.querySelectorAll('[data-edit]').forEach(b => b.onclick = ev => {
    ev.stopPropagation(); openEdit(b.dataset.edit, state.cursor);
  });

  document.querySelectorAll('[data-sugg]').forEach(b => b.onclick = () => {
    const [what, a, c] = b.dataset.sugg.split(':');
    if (what === 'dismiss') { state.S.dismissed[state.cursor + '|' + a] = 1; save(); paint(); return; }
    if (what === 'study') {
      const g = state.S.goals.find(x => x.id === a), mins = studyMap(g)[state.cursor] || 60;
      state.S.marks[markKey(state.cursor, g.id)] = Object.assign(getMark(state.cursor, g.id) || {}, { start: m2t(Number(c)), end: m2t(Number(c) + mins) });
      commit(); toast('Study moved into the open block.'); return;
    }
    if (what === 'hobby') {
      openAdd({ cat: 'hobby', fields: { days: [parseISO(state.cursor).getDay()], start: m2t(Number(a)), end: m2t(Number(c)) } });
    }
  });

  wireDrag();
}

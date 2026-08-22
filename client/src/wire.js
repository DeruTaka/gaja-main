import { state } from './state.js';
import { parseISO, iso, addDays, t2m, m2t, TODAY } from './utils.js';
import { getMark, markKey, bump, studyMap, taskCompletion } from './engine.js';
import { isTask } from './categories.js';
import { save } from './state.js';
import { commit, toast } from './ui/modal.js';
import { openAdd } from './edit/add.js';
import { openSettings } from './settings.js';
import { openEdit } from './edit/source.js';
import { wireDrag } from './edit/drag.js';
import { openNotifications } from './ui/notifications.js';
import { paint } from './views/paint.js';

/* ---------- wiring ----------
   Everything here belongs to the app shell (#root) — never query bare
   `document`. A modal (#layer) wires its own handlers directly wherever it's
   opened (edit/add.js, edit/source.js, ...), and #root gets fully re-rendered
   on every paint() while a modal can still be open over it — a global
   querySelectorAll would also match same-named attributes rendered inside that
   modal's form fields (e.g. the day-of-week picker's data-day="0".."6" in
   ui/fields.js collided with month view's data-day="<iso-date>" here, so a
   click on "Tue" while a form was open silently set state.cursor to "2" and
   every date computation in the app went NaN from then on). */
export function wire() {
  const root = document.getElementById('root');
  root.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { state.view = b.dataset.view; paint(); });
  root.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => {
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
      requestAnimationFrame(() => root.querySelector('.mcell.today, .yc.today')?.scrollIntoView({ block: 'center', behavior: 'instant' }));
    }
  });
  root.querySelectorAll('[data-cat-toggle]').forEach(b => b.onclick = () => {
    const c = b.dataset.catToggle;
    const P = state.S.profile;
    P.hiddenCats = P.hiddenCats || [];
    const i = P.hiddenCats.indexOf(c);
    i < 0 ? P.hiddenCats.push(c) : P.hiddenCats.splice(i, 1);
    save(); paint(); // display-only filter — no bump(), the schedule itself never changes
  });

  const add = () => openAdd();
  const ab = root.querySelector('#addBtn'); if (ab) ab.onclick = add;
  const fb = root.querySelector('#fab'); if (fb) fb.onclick = add;
  const sb = root.querySelector('#setBtn'); if (sb) sb.onclick = openSettings;
  const nb = root.querySelector('#notifBtn'); if (nb) nb.onclick = openNotifications;
  root.querySelectorAll('[data-goto-day]').forEach(b => b.onclick = () => { state.cursor = b.dataset.gotoDay; state.view = 'day'; paint(); });
  root.querySelectorAll('[data-month]').forEach(b => b.onclick = () => { state.cursor = b.dataset.month; state.view = 'month'; paint(); });

  root.querySelectorAll('.ev').forEach(el => {
    const toggleDone = () => {
      const src = el.dataset.src, mk = getMark(state.cursor, src) || {};
      const on = !mk.done;
      state.S.marks[markKey(state.cursor, src)] = Object.assign(mk, {
        done: on,
        mins: t2m(el.dataset.end) - t2m(el.dataset.start),
      });
      el.classList.toggle('done', on);
      const chk = el.querySelector('[data-done]');
      if (chk) { chk.setAttribute('aria-pressed', String(on)); chk.textContent = on ? '✓' : chk.dataset.icon; }
      if (on) { el.classList.add('swipe'); setTimeout(() => el.classList.remove('swipe'), 520); }
      bump(); save();
      // the completion card is part of the same paint() output as this block, but a
      // full repaint here would cut the swipe animation short — patch it in place
      // instead, same numbers taskCompletion() would give a fresh render (engine.js)
      if (isTask(el.dataset.cat)) {
        const tc = taskCompletion(state.cursor);
        const countEl = root.querySelector('#taskCount'), barEl = root.querySelector('#taskBar'), hintEl = root.querySelector('#taskHint');
        if (countEl) countEl.textContent = `${tc.done}/${tc.total}`;
        if (barEl) barEl.style.width = `${tc.pct}%`;
        if (hintEl) hintEl.textContent = `${tc.pct}% done${tc.pct === 100 ? ' — nice.' : ''}`;
      }
    };
    el.onclick = ev => {
      if (el.dataset.justDragged) { delete el.dataset.justDragged; return; } // the trailing click after a real drag isn't an open
      if (ev.target.closest('[data-edit]')) return;
      if (ev.target.closest('[data-done]')) { toggleDone(); return; }
      openEdit(el.dataset.src, state.cursor);
    };
    el.onkeydown = ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); openEdit(el.dataset.src, state.cursor); } };
  });
  root.querySelectorAll('[data-edit]').forEach(b => b.onclick = ev => {
    ev.stopPropagation(); openEdit(b.dataset.edit, state.cursor);
  });

  root.querySelectorAll('[data-sugg]').forEach(b => b.onclick = () => {
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

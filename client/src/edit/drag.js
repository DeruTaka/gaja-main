import { state } from '../state.js';
import { m2t, clamp, clock } from '../utils.js';
import { entryTravel } from '../travel.js';
import { PPM, paint } from '../views/paint.js';
import { buildDay, getMark, markKey } from '../engine.js';
import { source } from './source.js';
import { modal, closeModal, layer, commit } from '../ui/modal.js';

/* ============================================================
   DRAG TO RESCHEDULE
   Only "authored" blocks (a rule or a meal) are draggable — the algorithm-placed
   ones (study sessions, exam/tournament days) come from goal math, not a fixed
   time, so "dragging" them wouldn't mean the same thing; they still get moved via
   the pencil → edit flow. Travel padding rides with its parent, not draggable itself.
   ============================================================ */
const SNAP = 5; // minutes
const THRESHOLD = 6; // px of movement before a press becomes a drag, not a click

function applyInstanceTime(src, date, start, end) {
  const mk = getMark(date, src) || {};
  state.S.marks[markKey(date, src)] = Object.assign({}, mk, { start: m2t(start), end: m2t(end), skipped: false });
  commit();
}

function applySeriesTime(src, start, end) {
  const s = source(src);
  if (!s) return;
  if (s.kind === 'meal') {
    Object.assign(s.o, { time: m2t(start), len: end - start });
    state.S.profile.autoMeals = false;
    commit();
    return;
  }
  if (s.kind === 'rule') {
    const r = s.o, patch = { start: m2t(start), end: m2t(end) };
    if (r.mode) { const trav = entryTravel(r, start); patch.travelBefore = trav; patch.travelAfter = trav; }
    Object.assign(r, patch);
    commit();
  }
}

function commitDrag(src, date, start, end) {
  const s = source(src);
  if (!s) return;
  const repeating = (s.kind === 'rule' && s.o.repeat !== 'once') || s.kind === 'meal';
  if (!repeating) { applySeriesTime(src, start, end); return; }
  modal({
    title: 'Move which?', body: `
    <button class="pick" data-scope="one"><b>This day only</b><small>${date} keeps its new time. Every other occurrence stays as it is.</small></button>
    <button class="pick" data-scope="all"><b>Every one of these</b><small>Changes the whole series from here on.</small></button>`,
  });
  const cancel = () => { closeModal(); paint(); }; // the block was moved optimistically — put it back if nothing was chosen
  layer().querySelector('[data-close]').onclick = cancel;
  layer().querySelector('.scrim').addEventListener('mousedown', e => { if (e.target.classList.contains('scrim')) cancel(); });
  layer().querySelectorAll('[data-scope]').forEach(b => b.onclick = () => {
    closeModal();
    b.dataset.scope === 'one' ? applyInstanceTime(src, date, start, end) : applySeriesTime(src, start, end);
  });
}

export function wireDrag() {
  document.querySelectorAll('.ev').forEach(el => {
    if (el.dataset.cat === 'travel') return;
    const s = source(el.dataset.src);
    if (!s || (s.kind !== 'rule' && s.kind !== 'meal')) return;

    el.addEventListener('pointerdown', downEv => {
      if (downEv.target.closest('[data-edit]') || downEv.button !== 0) return;
      const day = buildDay(state.cursor), win = day.win, ppm = PPM();
      const startTop = parseFloat(el.style.top), height = parseFloat(el.style.height);
      const origStart = Math.round(startTop / ppm) + win.start;
      const dur = Math.round(height / ppm);
      const startClientY = downEv.clientY;
      let dragging = false;

      const timeEl = el.querySelector('.etime');
      const origTimeText = timeEl ? timeEl.textContent : '';

      const move = moveEv => {
        const deltaY = moveEv.clientY - startClientY;
        if (!dragging) {
          if (Math.abs(deltaY) < THRESHOLD) return;
          dragging = true;
          el.classList.add('dragging');
          try { el.setPointerCapture(downEv.pointerId); } catch (err) { /* best-effort — a fast pointer can still drag without capture */ }
        }
        const rawStart = origStart + deltaY / ppm;
        const snapped = clamp(Math.round(rawStart / SNAP) * SNAP, win.start, win.end - dur);
        el.style.top = `${(snapped - win.start) * ppm}px`;
        if (timeEl) timeEl.textContent = `${clock(snapped)}–${clock(snapped + dur)}`;
      };

      const up = () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        if (!dragging) return;
        el.classList.remove('dragging');
        el.dataset.justDragged = '1';
        const finalTop = parseFloat(el.style.top);
        const newStart = Math.round(finalTop / ppm) + win.start;
        if (newStart === origStart) { if (timeEl) timeEl.textContent = origTimeText; return; }
        commitDrag(el.dataset.src, state.cursor, newStart, newStart + dur);
      };

      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
  });
}

import { state } from '../state.js';
import { m2t, t2m, clamp, clock } from '../utils.js';
import { entryTravel } from '../travel.js';
import { PPM, paint } from '../views/paint.js';
import { buildDay, getMark, markKey } from '../engine.js';
import { source } from './source.js';
import { modal, closeModal, layer, commit, toast } from '../ui/modal.js';

/* ============================================================
   DRAG TO RESCHEDULE — with push
   Only "authored" blocks (a rule or a meal, and only if the day didn't have to
   split it into pieces) can be picked up — the algorithm-placed ones (study
   sessions, exam/tournament days) come from goal math, not a fixed time, so
   "dragging" them wouldn't mean the same thing; they still get moved via the
   pencil → edit flow. Everything else on the day — including those
   algorithm-placed blocks — can be PUSHED out of the way as the dragged block
   passes over it, the way reordering a stack of cards works.
   ============================================================ */
const SNAP = 5; // minutes
const THRESHOLD = 6; // px of movement before a press becomes a drag, not a click

/* ---------- group same-src pieces (a rigid block carved around a meal renders
   as 2-3 .ev elements sharing one src) into one logical block per src ---------- */
function collectGroups(els) {
  const groups = new Map();
  for (const el of els) {
    const src = el.dataset.src;
    const pStart = t2m(el.dataset.start), pEnd = t2m(el.dataset.end);
    const piece = { el, start: pStart, end: pEnd, origTop: parseFloat(el.style.top) };
    const g = groups.get(src);
    if (!g) groups.set(src, { src, start: pStart, end: pEnd, pieces: [piece] });
    else { g.start = Math.min(g.start, pStart); g.end = Math.max(g.end, pEnd); g.pieces.push(piece); }
  }
  return groups;
}

/* recomputed fresh from ORIGINAL positions every frame — never compounds, and
   naturally "un-pushes" a block once the dragged item moves back past it */
function computePush(before, after, dStart, dEnd) {
  const pushed = new Map();
  let boundary = dStart;
  for (let i = before.length - 1; i >= 0; i--) {
    const g = before[i];
    if (g.end > boundary) {
      const len = g.end - g.start, newEnd = boundary, newStart = newEnd - len;
      pushed.set(g.src, { start: newStart, end: newEnd });
      boundary = newStart;
    } else break; // sorted — nothing earlier overlaps either
  }
  let boundary2 = dEnd;
  for (let i = 0; i < after.length; i++) {
    const g = after[i];
    if (g.start < boundary2) {
      const len = g.end - g.start, newStart = boundary2, newEnd = newStart + len;
      pushed.set(g.src, { start: newStart, end: newEnd });
      boundary2 = newEnd;
    } else break;
  }
  return pushed;
}

function applyGroupVisual(g, result) {
  const delta = result.start - g.start;
  for (const p of g.pieces) {
    p.el.style.top = `${p.origTop + delta * PPM()}px`;
    const timeEl = p.el.querySelector('.etime');
    if (timeEl) timeEl.textContent = `${clock(p.start + delta)}–${clock(p.end + delta)}`;
  }
}

function writeInstanceMark(src, date, start, end) {
  const mk = getMark(date, src) || {};
  state.S.marks[markKey(date, src)] = Object.assign({}, mk, { start: m2t(start), end: m2t(end), skipped: false });
}
function writeSeriesTime(src, start, end) {
  const s = source(src);
  if (!s) return;
  if (s.kind === 'meal') {
    Object.assign(s.o, { time: m2t(start), len: end - start });
    state.S.profile.autoMeals = false;
    return;
  }
  if (s.kind === 'rule') {
    const r = s.o, patch = { start: m2t(start), end: m2t(end) };
    if (r.mode) { const trav = entryTravel(r, start); patch.travelBefore = trav; patch.travelAfter = trav; }
    Object.assign(r, patch);
  }
}

function finalizeDrag(draggedSrc, date, dStart, dEnd, pushed) {
  const s = source(draggedSrc);
  if (!s) return;
  const repeating = (s.kind === 'rule' && s.o.repeat !== 'once') || s.kind === 'meal';

  const applyAll = scope => {
    if (scope === 'one') writeInstanceMark(draggedSrc, date, dStart, dEnd);
    else writeSeriesTime(draggedSrc, dStart, dEnd);
    for (const [src, pos] of pushed) writeInstanceMark(src, date, pos.start, pos.end);
    commit();
    toast(pushed.size
      ? `Moved — ${pushed.size} other event${pushed.size > 1 ? 's' : ''} shifted to make room.`
      : (scope === 'one' ? 'This day updated.' : 'Series updated.'));
  };

  if (!repeating) { applyAll('all'); return; }

  modal({
    title: 'Move which?', body: `
    <button class="pick" data-scope="one"><b>This day only</b><small>${date} keeps its new time. Every other occurrence stays as it is.</small></button>
    <button class="pick" data-scope="all"><b>Every one of these</b><small>Changes the whole series from here on.</small></button>`,
  });
  const cancel = () => { closeModal(); paint(); }; // moved optimistically — put it back if nothing was chosen
  layer().querySelector('[data-close]').onclick = cancel;
  layer().querySelector('.scrim').addEventListener('mousedown', e => { if (e.target.classList.contains('scrim')) cancel(); });
  layer().querySelectorAll('[data-scope]').forEach(b => b.onclick = () => { closeModal(); applyAll(b.dataset.scope); });
}

export function wireDrag() {
  const evEls = [...document.querySelectorAll('.ev')].filter(el => el.dataset.cat !== 'travel');
  if (!evEls.length) return;
  const groups = collectGroups(evEls);

  for (const el of evEls) {
    const src = el.dataset.src;
    const group = groups.get(src);
    const s = source(src);
    if (!s || (s.kind !== 'rule' && s.kind !== 'meal') || group.pieces.length !== 1) continue;

    el.addEventListener('pointerdown', downEv => {
      if (downEv.target.closest('[data-edit]') || downEv.button !== 0) return;
      const day = buildDay(state.cursor), win = day.win, ppm = PPM();
      const draggedOriginalStart = group.start, draggedDuration = group.end - group.start;
      // a carved/split block (e.g. a work shift with a meal cut out of the middle) has no single
      // "length" a push can preserve — its bounding box would swallow whatever sits in its own gap.
      // Leave those in place; the engine's normal conflict resolution sorts out any overlap on drop.
      const others = [...groups.values()].filter(g => g.src !== src && g.pieces.length === 1).sort((a, b) => a.start - b.start);
      const before = others.filter(g => g.start < draggedOriginalStart);
      const after = others.filter(g => g.start >= draggedOriginalStart);
      const startClientY = downEv.clientY;
      let dragging = false, lastDStart = draggedOriginalStart, lastPushed = new Map();

      const move = moveEv => {
        const deltaY = moveEv.clientY - startClientY;
        if (!dragging) {
          if (Math.abs(deltaY) < THRESHOLD) return;
          dragging = true;
          el.classList.add('dragging');
          try { el.setPointerCapture(downEv.pointerId); } catch (err) { /* best-effort — a fast pointer can still drag without capture */ }
        }
        const rawStart = draggedOriginalStart + deltaY / ppm;
        const dStart = clamp(Math.round(rawStart / SNAP) * SNAP, win.start, win.end - draggedDuration);
        const dEnd = dStart + draggedDuration;
        el.style.top = `${(dStart - win.start) * ppm}px`;
        const timeEl = el.querySelector('.etime');
        if (timeEl) timeEl.textContent = `${clock(dStart)}–${clock(dEnd)}`;

        const pushed = computePush(before, after, dStart, dEnd);
        for (const g of others) applyGroupVisual(g, pushed.get(g.src) || { start: g.start, end: g.end });

        lastDStart = dStart; lastPushed = pushed;
      };

      const up = () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
        if (!dragging) return;
        el.classList.remove('dragging');
        el.dataset.justDragged = '1';
        if (lastDStart === draggedOriginalStart && lastPushed.size === 0) return; // no-op, visuals already match data
        finalizeDrag(src, state.cursor, lastDStart, lastDStart + draggedDuration, lastPushed);
      };

      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    });
  }
}

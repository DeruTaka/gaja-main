import { state } from '../state.js';
import { m2t, t2m, clamp, clock } from '../utils.js';
import { entryTravel } from '../travel.js';
import { getCat } from '../categories.js';
import { PPM, paint } from '../views/paint.js';
import { buildDay, getMark, markKey } from '../engine.js';
import { source } from './source.js';
import { modal, closeModal, layer, commit, toast } from '../ui/modal.js';

/* ============================================================
   DRAG TO RESCHEDULE — with priority-aware push
   Only "authored" blocks (a rule or a meal, not rigid, and only if the day
   didn't have to split it into pieces) can be picked up — the algorithm-placed
   ones (study sessions, exam/tournament days) come from goal math, not a fixed
   time, and rigid categories (work, class, tournament, travel) hold their slot
   no matter what, so both still get moved via the pencil → edit flow instead.

   Everything else on the day can be PUSHED out of the way as the dragged block
   passes over it, like reordering a stack of cards — but a rigid block, or a
   block with a strictly higher priority (a lower pri number) than the one
   being dragged, is a wall: the drag stops there rather than shoving it, and
   the whole push chain is bounded so it can never spill past the day's own
   wake/sleep window either.
   ============================================================ */
const SNAP = 5; // minutes
const THRESHOLD = 6; // px of movement before a press becomes a drag, not a click

/* an item is a wall for a drag of priority `draggedPri` if it can never move in
   real life, if it's a block the day had to split into pieces (a rigid shift
   carved around a meal, say) — its bounding box isn't one movable slot — if
   it's itself carved into another block's timeframe (see `carved` below), or
   if it outranks the thing trying to push it */
const isWall = (g, draggedPri) => g.rigid || g.carved || g.pieces.length !== 1 || g.pri < draggedPri;

/* ---------- group same-src pieces (a rigid block carved around a meal renders
   as 2-3 .ev elements sharing one src) into one logical block per src ---------- */
function collectGroups(els) {
  const groups = new Map();
  for (const el of els) {
    const src = el.dataset.src;
    const pStart = t2m(el.dataset.start), pEnd = t2m(el.dataset.end);
    const pri = Number(el.dataset.pri) || 4;
    const rigid = !!getCat(el.dataset.cat).rigid;
    const carved = el.dataset.carved === '1'; // e.g. a lunch break carved into a workday — its slot
    // is a placement artifact of the rigid block around it, not a timeframe of its own
    const piece = { el, start: pStart, end: pEnd, origTop: parseFloat(el.style.top) };
    const g = groups.get(src);
    if (!g) groups.set(src, { src, start: pStart, end: pEnd, pri, rigid, carved, pieces: [piece] });
    else { g.start = Math.min(g.start, pStart); g.end = Math.max(g.end, pEnd); g.pieces.push(piece); }
  }
  return groups;
}

/* how far the dragged block can travel in each direction before either the day's
   own window edge or a wall (rigid / higher-priority block) stops it — computed
   once from ORIGINAL positions so it doesn't drift as the drag proceeds */
function computeBounds(before, after, draggedPri, win, draggedDuration) {
  let minStart = win.start, backSum = 0, wallB = false;
  for (let i = before.length - 1; i >= 0; i--) {
    const g = before[i];
    if (isWall(g, draggedPri)) { minStart = g.end + backSum; wallB = true; break; }
    backSum += g.end - g.start;
  }
  if (!wallB) minStart += backSum;

  let maxStart = win.end - draggedDuration, fwdSum = 0, wallF = false;
  for (let i = 0; i < after.length; i++) {
    const g = after[i];
    if (isWall(g, draggedPri)) { maxStart = g.start - draggedDuration - fwdSum; wallF = true; break; }
    fwdSum += g.end - g.start;
  }
  if (!wallF) maxStart -= fwdSum;

  if (minStart > maxStart) maxStart = minStart; // squeezed between two walls — pin it, don't invert the range
  return { minStart, maxStart };
}

/* recomputed fresh from ORIGINAL positions every frame — never compounds, and
   naturally "un-pushes" a block once the dragged item moves back past it.
   Stops at the first wall in either direction; computeBounds already keeps
   dStart/dEnd from ever needing to cross one. */
function computePush(before, after, dStart, dEnd, draggedPri) {
  const pushed = new Map();
  let boundary = dStart;
  for (let i = before.length - 1; i >= 0; i--) {
    const g = before[i];
    if (isWall(g, draggedPri)) break;
    if (g.end > boundary) {
      const len = g.end - g.start, newEnd = boundary, newStart = newEnd - len;
      pushed.set(g.src, { start: newStart, end: newEnd });
      boundary = newStart;
    } else break; // sorted — nothing earlier overlaps either
  }
  let boundary2 = dEnd;
  for (let i = 0; i < after.length; i++) {
    const g = after[i];
    if (isWall(g, draggedPri)) break;
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
    if (!s || (s.kind !== 'rule' && s.kind !== 'meal') || group.pieces.length !== 1 || group.rigid || group.carved) continue;

    el.addEventListener('pointerdown', downEv => {
      if (downEv.target.closest('[data-edit]') || downEv.target.closest('[data-done]') || downEv.button !== 0) return;
      const day = buildDay(state.cursor), win = day.win, ppm = PPM();
      const draggedOriginalStart = group.start, draggedDuration = group.end - group.start, draggedPri = group.pri;
      // every other block on the day is a candidate obstacle — multi-piece (split/carved) and
      // carved-in blocks are never actually pushed (isWall always claims them), but they still
      // need to show up here so the drag treats them as real obstacles instead of walking through them
      const others = [...groups.values()].filter(g => g.src !== src).sort((a, b) => a.start - b.start);
      const before = others.filter(g => g.start < draggedOriginalStart);
      const after = others.filter(g => g.start >= draggedOriginalStart);
      const { minStart, maxStart } = computeBounds(before, after, draggedPri, win, draggedDuration);
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
        const dStart = clamp(Math.round(rawStart / SNAP) * SNAP, minStart, maxStart);
        const dEnd = dStart + draggedDuration;
        el.style.top = `${(dStart - win.start) * ppm}px`;
        const timeEl = el.querySelector('.etime');
        if (timeEl) timeEl.textContent = `${clock(dStart)}–${clock(dEnd)}`;

        const pushed = computePush(before, after, dStart, dEnd, draggedPri);
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

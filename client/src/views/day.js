import { state } from '../state.js';
import { CAT, catColor, DOW, MON, filterHidden } from '../categories.js';
import { clock, dur, t2m, m2t, esc, TODAY, daysBetween } from '../utils.js';
import { buildDay, getMark, studyMap, studyProgress } from '../engine.js';
import { navbar, PPM } from './paint.js';

/* ---------------- DAY ---------------- */
export function dayView(d) {
  const day = buildDay(state.cursor), win = day.win, ppm = PPM();
  const H = (win.end - win.start) * ppm;
  const h0 = Math.floor(win.start / 60), h1 = Math.ceil(win.end / 60);
  let ticks = '', lines = '';
  for (let h = h0; h <= h1; h++) {
    const y = (h * 60 - win.start) * ppm;
    if (y < -2 || y > H + 2) continue;
    ticks += `<div class="tick" style="top:${y}px">${clock(h * 60).toUpperCase()}</div>`;
    lines += `<div class="hline" style="top:${y}px"></div><div class="hline half" style="top:${y + 30 * ppm}px"></div>`;
  }
  const visible = filterHidden(day.events, state.S.profile.hiddenCats);
  const evs = visible.map(e => {
    const top = (e.start - win.start) * ppm, hgt = Math.max(24, (e.end - e.start) * ppm);
    const mk = getMark(state.cursor, e.src);
    const done = mk && mk.done;
    const short = hgt < 46;
    return `<div class="ev ${done ? 'done' : ''} ${short ? 'short' : ''}" style="--c:${catColor(e.cat)};top:${top}px;height:${hgt}px"
      data-src="${e.src}" data-start="${m2t(e.start)}" data-end="${m2t(e.end)}" data-cat="${e.cat}" data-pri="${e.pri}"
      data-title="${esc(e.title)}" tabindex="0" role="button" aria-label="Edit ${esc(e.title)}">
      <button class="eico" data-done="${e.src}" data-icon="${CAT[e.cat].icon}" aria-pressed="${!!done}" aria-label="${done ? 'Mark not done' : 'Mark done'}">${done ? '✓' : CAT[e.cat].icon}</button>
      <div class="ebody">
        <div class="etitle">${esc(e.title)}${e.part ? ` <span class="mono" style="color:var(--graphite-dim);font-size:11px">${e.part}</span>` : ''}</div>
        <div class="etime">${clock(e.start)}–${clock(e.end)}${e.moved ? ' · moved' : ''}${
          e.place ? ` · ${esc(e.place)}` : ''}${e.note ? ` · ${esc(e.note)}` : ''}</div>
      </div>
      <button class="edit" data-edit="${e.src}" aria-label="Edit ${esc(e.title)}">✎</button>
    </div>`;
  }).join('');
  let now = '';
  if (state.cursor === TODAY) {
    const n = new Date().getHours() * 60 + new Date().getMinutes();
    const nn = n < win.start ? n + 1440 : n;
    if (nn >= win.start && nn <= win.end) now = `<div class="nowline" id="nowline" style="top:${(nn - win.start) * ppm}px"><b>NOW</b></div>`;
  }
  return navbar(`${DOW[d.getDay()]}, ${MON[d.getMonth()]} ${d.getDate()}`,
    `${dur(day.busy)} committed · ${dur(Math.max(0, day.free))} open`)
  + `<div class="dayGrid">
      <div class="ruler" style="height:${H}px"><div class="gutter">${ticks}</div>
        <div class="track">${lines}${evs}${now}</div></div>
      <div class="side">${sidePanel(day, visible)}</div>
    </div>`;
}
export function scrollToNow() {
  const n = document.getElementById('nowline');
  if (n) n.scrollIntoView({ block: 'center', behavior: 'instant' });
}

export function sidePanel(day, visible = day.events) {
  const byCat = {};
  visible.forEach(e => { byCat[e.cat] = (byCat[e.cat] || 0) + (e.end - e.start); });
  const span = day.win.end - day.win.start;
  const load = Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([c, m]) =>
    `<div class="stat"><span>${CAT[c].icon} ${CAT[c].label}</span><b>${dur(m)}</b></div>
     <div class="bar" style="--c:${catColor(c)}"><i style="width:${(m / span * 100).toFixed(1)}%"></i></div>`).join('');

  const over = day.overload;
  const banner = over ? `<div class="card" style="border-color:rgba(240,100,95,.45)">
      <h3 style="color:var(--red)">This day does not fit</h3>
      <p style="font-size:13.5px;color:var(--graphite);margin-bottom:10px">${
        over.over > 0
          ? `You have asked for ${dur(over.asked)} inside a ${dur(over.room)} day — ${dur(over.over)} more than exists.
           Gaja moved and shortened everything it could, then left ${over.lost} item${over.lost > 1 ? 's' : ''} out rather than double-book you.`
          : `Two commitments that cannot move want the same hours. Nothing was double-booked, so ${over.lost}
           item${over.lost > 1 ? 's were' : ' was'} left off. Change one of them, or drop its priority.`}</p>
      <div class="hint">Fixes: move the times, cut a session shorter, or lower a priority so it can slide.</div>
    </div>` : '';
  const notes = day.conflicts.length ? `<div class="card"><h3>Adjustments <em>${day.conflicts.length}</em></h3>
    ${day.conflicts.map(c => `<div class="note ${c.kind === 'drop' || c.kind === 'clash' ? 'warn' : ''}"><b>${
      CAT[c.item.cat].icon} ${esc(c.item.title)}</b>${esc(c.why)}</div>`).join('')}
    </div>` : '';
  const conf = banner + notes;

  const sugg = day.gaps.filter(g => !state.S.dismissed[state.cursor + '|' + g.s]).map(g => {
    const goal = state.S.goals.find(x => x.kind === 'assessment' && state.cursor < x.deadline && studyProgress(x).pct < 1);
    return `<div class="note"><b>${dur(g.e - g.s)} open · ${clock(g.s)}–${clock(g.e)}</b>
      ${goal ? `You are ${Math.round((1 - studyProgress(goal).pct) * 100)}% out from ${esc(goal.title)}. Pulling study into this block finishes it sooner.`
        : 'A block this size is where a hobby actually survives.'}
      <div class="act">
        ${goal ? `<button data-sugg="study:${goal.id}:${g.s}">Study here</button>` : ''}
        <button data-sugg="hobby:${g.s}:${g.e}">Add a hobby</button>
        <button data-sugg="dismiss:${g.s}">Not today</button>
      </div></div>`;
  }).join('');

  const goals = state.S.goals.filter(g => g.kind === 'assessment' && state.cursor <= g.deadline).map(g => {
    const p = studyProgress(g), left = daysBetween(state.cursor, g.deadline);
    return `<div class="stat"><span>${esc(g.title)}</span><b>${left}d</b></div>
      <div class="bar" style="--c:var(--assessment)"><i style="width:${(p.pct * 100).toFixed(0)}%"></i></div>
      <div class="hint">${dur(p.done)} logged of ${dur(p.total)} · today's target ${dur(studyMap(g)[state.cursor] || 0)}</div>`;
  }).join('');

  return conf
    + (sugg ? `<div class="card"><h3>Open ground</h3>${sugg}</div>` : '')
    + (goals ? `<div class="card"><h3>Countdown</h3>${goals}</div>` : '')
    + `<div class="card"><h3>Where the day goes</h3>${load || '<div class="hint">Nothing scheduled.</div>'}</div>`;
}

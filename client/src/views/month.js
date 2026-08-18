import { state } from '../state.js';
import { catColor, DOW, MON } from '../categories.js';
import { iso, addDays, esc, TODAY } from '../utils.js';
import { buildDay, fires } from '../engine.js';
import { navbar } from './paint.js';

/* ---------------- MONTH ---------------- */
export function monthView(d) {
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const start = addDays(first, -first.getDay());
  const hidden = state.S.profile.hiddenCats || [];
  let cells = '';
  for (let i = 0; i < 42; i++) {
    const cd = addDays(start, i), ds = iso(cd), out = cd.getMonth() !== d.getMonth();
    const day = out ? null : buildDay(ds);
    const evs = day ? day.events.filter(e => e.cat !== 'travel' && !hidden.includes(e.cat)) : [];
    cells += `<button class="mcell ${out ? 'out' : ''} ${ds === TODAY ? 'today' : ''} ${ds === state.cursor ? 'sel' : ''}" data-day="${ds}">
      <span class="dn">${cd.getDate()}</span>
      ${evs.slice(0, 3).map(e => `<span class="mchip" style="--c:${catColor(e.cat)}"><i></i>${esc(e.title)}</span>`).join('')}
      ${evs.length > 3 ? `<div class="mmore">+${evs.length - 3} more</div>` : ''}
    </button>`;
  }
  return navbar(`${MON[d.getMonth()]} ${d.getFullYear()}`, 'Tap a day to open it')
    + `<div class="mgrid"><div class="mhead">${DOW.map(n => `<div>${n}</div>`).join('')}</div>
       <div class="mrow">${cells}</div></div>`;
}

/* ---------------- shared with year view ---------------- */
export function milestones() {
  const m = {};
  const put = (ds, cat, label) => { (m[ds] = m[ds] || []).push({ cat, label }); };
  state.S.goals.forEach(g => put(g.deadline, g.cat, g.title));
  state.S.rules.filter(r => r.cat === 'special').forEach(r => {
    for (let i = 0; i < 400; i++) {
      const cd = addDays(new Date(), i), ds = iso(cd);
      if (fires(r, ds, cd)) put(ds, 'special', r.title);
    }
  });
  return m;
}

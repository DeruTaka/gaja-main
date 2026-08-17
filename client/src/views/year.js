import { catColor, MON } from '../categories.js';
import { iso, addDays, esc, TODAY, pad } from '../utils.js';
import { milestones } from './month.js';
import { navbar } from './paint.js';

/* ---------------- YEAR ---------------- */
export function yearView(d) {
  const Y = d.getFullYear(), M = milestones();
  const months = MON.map((name, mi) => {
    const first = new Date(Y, mi, 1), start = addDays(first, -first.getDay());
    let n = 0, cells = '';
    for (let i = 0; i < 42; i++) {
      const cd = addDays(start, i), ds = iso(cd);
      if (cd.getMonth() !== mi) { cells += `<div class="yc out"></div>`; continue; }
      const hit = M[ds];
      if (hit) n++;
      cells += `<div class="yc ${hit ? 'mark' : ''} ${ds === TODAY ? 'today' : ''}"
        ${hit ? `style="--c:${catColor(hit[0].cat)}" title="${esc(hit.map(x => x.label).join(', '))}"` : ''}>${cd.getDate()}</div>`;
    }
    return `<button class="ym" data-month="${Y}-${pad(mi + 1)}-01">
      <h4>${name}<span>${n ? n + ' marked' : ''}</span></h4><div class="ycells">${cells}</div></button>`;
  }).join('');
  return navbar(String(Y), 'Deadlines, tournaments and annual reminders')
    + `<div class="ygrid">${months}</div>`;
}

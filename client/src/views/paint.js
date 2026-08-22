import { state } from '../state.js';
import { parseISO, TODAY } from '../utils.js';
import { dayView, scrollToNow } from './day.js';
import { monthView } from './month.js';
import { yearView } from './year.js';
import { wire } from '../wire.js';
import { categoryRail } from '../ui/categoryRail.js';
import { pendingCount } from '../ui/notifications.js';

export const PPM = () => innerWidth < 640 ? .85 : 1.05;

export function paint() {
  const d = parseISO(state.cursor);
  const head = `
  <header class="top"><div class="wrap"><div class="topbar">
    <div class="brand"><i></i>Gaja<small>${state.S.profile.name || 'your year'}</small></div>
    <div class="spacer"></div>
    <div class="seg">${['day', 'month', 'year'].map(v =>
      `<button data-view="${v}" aria-pressed="${state.view === v}">${v}</button>`).join('')}</div>
    <button class="btn" id="addBtn">+ Add event</button>
    <button class="iconbtn bell" id="notifBtn" title="Suggestions" aria-label="Suggestions">🔔${
      pendingCount() ? `<i class="badge">${pendingCount()}</i>` : ''}</button>
    <button class="iconbtn" id="setBtn" title="Settings" aria-label="Settings">⚙</button>
  </div></div></header>`;
  const body = state.view === 'day' ? dayView(d) : state.view === 'month' ? monthView(d) : yearView(d);
  document.body.classList.add('has-rail');
  document.getElementById('root').innerHTML = head + categoryRail() + `<div class="wrap">${body}</div>
    <button class="fab" id="fab" aria-label="Add event">+</button>`;
  wire();
  if (state.view === 'day') requestAnimationFrame(scrollToNow);
}
window.paint = paint;

export function navbar(label, sub) {
  return `<div class="datebar">
    <button class="iconbtn" data-nav="-1" aria-label="Previous">‹</button>
    <button class="iconbtn" data-nav="1" aria-label="Next">›</button>
    <div><h2>${label}</h2><div class="sub">${sub}</div></div>
    <div class="spacer"></div>
    <button class="btn ghost" data-nav="today">Today</button>
  </div>`;
}

export function mount() {
  state.view = 'day';
  state.cursor = TODAY;
  paint();
}

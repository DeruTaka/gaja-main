import { esc } from '../utils.js';
import { getCat } from '../categories.js';
import { modal, closeModal, commit, layer } from './modal.js';
import { pendingSuggestions, acceptSuggestion, denySuggestion } from '../adaptive.js';
import { pendingCatchups, addCatchupToToday, dismissCatchup } from '../catchup.js';

export const pendingCount = () => pendingSuggestions().length + pendingCatchups().length;

export function openNotifications() {
  const suggestions = pendingSuggestions();
  const catchups = pendingCatchups();

  const suggestionRows = suggestions.map(s => `<div class="note"><b>${getCat(s.targetCat).icon} ${esc(getCat(s.targetCat).label)}</b>${esc(s.reason)}
      <div class="act">
        <button data-accept="${s.id}">Accept</button>
        <button data-ignore="${s.id}">Ignore</button>
        <button data-deny="${s.id}">Deny</button>
      </div></div>`).join('');
  const catchupRows = catchups.map(c => `<div class="note"><b>${getCat(c.cat).icon} ${esc(c.title)}</b>Didn't get marked done yesterday. Add it to today's calendar, or let it go?
      <div class="act">
        <button data-add-today="${c.id}">Add to today</button>
        <button data-skip-catchup="${c.id}">Let it go</button>
      </div></div>`).join('');

  modal({
    title: 'Suggestions',
    body: (suggestionRows || catchupRows)
      ? (catchupRows ? `<h3 style="margin-bottom:10px">Yesterday</h3>${catchupRows}` : '')
        + (suggestionRows ? `<h3 style="margin:${catchupRows ? '18px' : '0'} 0 10px">Pace</h3>${suggestionRows}` : '')
      : `<div class="hint">Nothing pending — Gaja will flag it here if an exam starts falling behind pace, or if something from yesterday never got marked done.</div>`,
    foot: `<div class="spacer"></div><button class="btn" data-close2>Close</button>`,
  });
  layer().querySelector('[data-close2]').onclick = closeModal;

  // Ignore writes nothing — the same suggestion just resurfaces next time this
  // panel opens, which is exactly the "still on the backlog" behavior wanted.
  layer().querySelectorAll('[data-ignore]').forEach(b => b.onclick = closeModal);
  layer().querySelectorAll('[data-accept]').forEach(b => b.onclick = () => {
    const s = suggestions.find(x => x.id === b.dataset.accept);
    if (s) acceptSuggestion(s);
    commit(); openNotifications();
  });
  layer().querySelectorAll('[data-deny]').forEach(b => b.onclick = () => {
    const s = suggestions.find(x => x.id === b.dataset.deny);
    if (s) denySuggestion(s);
    commit(); openNotifications();
  });

  layer().querySelectorAll('[data-add-today]').forEach(b => b.onclick = () => {
    const c = catchups.find(x => x.id === b.dataset.addToday);
    if (c) addCatchupToToday(c);
    commit(); openNotifications();
  });
  layer().querySelectorAll('[data-skip-catchup]').forEach(b => b.onclick = () => {
    const c = catchups.find(x => x.id === b.dataset.skipCatchup);
    if (c) dismissCatchup(c);
    commit(); openNotifications();
  });
}

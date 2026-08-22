import { esc } from '../utils.js';
import { getCat } from '../categories.js';
import { modal, closeModal, commit, layer } from './modal.js';
import { pendingSuggestions, acceptSuggestion, denySuggestion } from '../adaptive.js';

export const pendingCount = () => pendingSuggestions().length;

export function openNotifications() {
  const pending = pendingSuggestions();
  modal({
    title: 'Suggestions',
    body: pending.length
      ? pending.map(s => `<div class="note"><b>${getCat(s.targetCat).icon} ${esc(getCat(s.targetCat).label)}</b>${esc(s.reason)}
          <div class="act">
            <button data-accept="${s.id}">Accept</button>
            <button data-ignore="${s.id}">Ignore</button>
            <button data-deny="${s.id}">Deny</button>
          </div></div>`).join('')
      : `<div class="hint">Nothing pending — Gaja will flag it here if an exam starts falling behind pace.</div>`,
    foot: `<div class="spacer"></div><button class="btn" data-close2>Close</button>`,
  });
  layer().querySelector('[data-close2]').onclick = closeModal;
  // Ignore writes nothing — the same suggestion just resurfaces next time this
  // panel opens, which is exactly the "still on the backlog" behavior wanted.
  layer().querySelectorAll('[data-ignore]').forEach(b => b.onclick = closeModal);
  layer().querySelectorAll('[data-accept]').forEach(b => b.onclick = () => {
    const s = pending.find(x => x.id === b.dataset.accept);
    if (s) acceptSuggestion(s);
    commit(); openNotifications();
  });
  layer().querySelectorAll('[data-deny]').forEach(b => b.onclick = () => {
    const s = pending.find(x => x.id === b.dataset.deny);
    if (s) denySuggestion(s);
    commit(); openNotifications();
  });
}

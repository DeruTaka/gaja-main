import { state } from '../state.js';
import { getCat, catColor, railCats } from '../categories.js';

/* persistent left-side filter: a filled dot means the category is showing, an
   empty dot means it's hidden. Purely a display toggle — never touches S.rules
   or S.goals, so re-showing a category never changes where anything landed. */
export function categoryRail() {
  const hidden = state.S.profile.hiddenCats || [];
  return `<nav class="catrail" aria-label="Category filters">${railCats().map(c => {
    const on = !hidden.includes(c);
    return `<button class="railcat" data-cat-toggle="${c}" aria-pressed="${on}">
      <i class="dot" style="--c:${catColor(c)}"></i>
      <span>${getCat(c).label}</span>
    </button>`;
  }).join('')}</nav>`;
}

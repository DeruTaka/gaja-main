import { state } from '../state.js';
import { STEPS, finish } from './steps.js';
import { SCHEMA } from '../schema.js';
import { rerenderHook } from '../ui/rerender.js';
import { mount } from '../views/paint.js';

export function renderOnboard() {
  document.body.classList.remove('has-rail');
  const st = STEPS[state.step];
  document.getElementById('root').innerHTML = `
  <div class="ob">
    <div class="ob-head"><div class="wrap">
      <div class="brand"><i></i>Gaja<small>setup</small></div>
      <div class="spacer"></div>
      <div class="rail">${STEPS.map((_, i) => `<i class="${i === state.step ? 'on' : i < state.step ? 'past' : ''}"></i>`).join('')}</div>
    </div></div>
    <div class="ob-body"><div class="wrap">
      ${st.title ? `<div class="step-no">${st.no}</div><h1>${st.title}</h1>` : ''}
      ${st.lede ? `<p class="lede">${st.lede}</p>` : ''}
      <div id="stepBody">${st.render()}</div>
    </div></div>
    <div class="ob-foot"><div class="wrap">
      <button class="btn ghost" id="back" ${state.step === 0 ? 'disabled' : ''}>← Back</button>
      <div class="spacer"></div>
      <span class="hint" style="margin:0">${state.step + 1} of ${STEPS.length}</span>
      <button class="btn primary" id="next">${state.step === STEPS.length - 1 ? 'Build my year' : state.step === 0 ? 'Get started' : 'Continue'}</button>
    </div></div>
  </div>`;
  document.getElementById('back').onclick = () => { state.step = Math.max(0, state.step - 1); renderOnboard(); };
  document.getElementById('next').onclick = () => {
    if (state.step === STEPS.length - 1) { finish(); mount(); return; }
    state.step++; renderOnboard();
  };
}

rerenderHook.fn = () => {
  const b = document.getElementById('stepBody');
  if (b) b.innerHTML = STEPS[state.step].render();
  else if (window.paint) window.paint();
};

/* add / remove / expand entries */
let pendingList = () => [];
document.addEventListener('click', e => {
  const add = e.target.closest('[data-add]');
  if (add) {
    const k = add.dataset.add; const o = SCHEMA[k].blank(); o._open = true;
    (state.D ? state.D[k] : pendingList(k)).forEach(x => x._open = false);
    (state.D ? state.D[k] : pendingList(k)).push(o); rerenderHook.fn(); return;
  }
  const del = e.target.closest('[data-del]');
  if (del) { e.stopPropagation(); const [k, i] = del.dataset.del.split(':'); (state.D ? state.D[k] : pendingList(k)).splice(Number(i), 1); rerenderHook.fn(); return; }
  const tg = e.target.closest('[data-toggle]');
  if (tg) {
    const [k, i] = tg.dataset.toggle.split(':'); const l = (state.D ? state.D[k] : pendingList(k));
    const was = l[Number(i)]._open; l.forEach(x => x._open = false); l[Number(i)]._open = !was; rerenderHook.fn();
  }
});

/* ---------- time + date utils ---------- */
export const pad = n => String(n).padStart(2, '0');
export const t2m = t => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + (m || 0); };
export const m2t = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };
export function clock(m) {
  m = ((Math.round(m) % 1440) + 1440) % 1440;
  let h = Math.floor(m / 60), mm = m % 60;
  const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 === 0 ? 12 : h % 12;
  return mm ? `${h}:${pad(mm)}${ap}` : `${h}${ap}`;
}
export function dur(m) {
  const h = Math.floor(m / 60), mm = Math.round(m % 60);
  return h && mm ? `${h}h ${mm}m` : h ? `${h}h` : `${mm}m`;
}
export const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseISO = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
export const TODAY = iso(new Date());
export const uid = () => Math.random().toString(36).slice(2, 9);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

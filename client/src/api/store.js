import { store as localStore, KEY } from '../store.js';

/* ---------- backend-backed store ----------
   Same {get,set,del} shape as ../store.js (see the note there) — this is the
   Phase 1 swap it describes. Falls back to the local shim untouched when
   VITE_USE_API isn't set, so local dev needs no server running. Requests are
   relative (/api/...) — see api/auth.js for why that's always same-origin. */
const API_ENABLED = import.meta.env.VITE_USE_API === 'true';

const remote = {
  // a failed request (expired/missing session, a 500, a network blip) throws
  // instead of quietly returning null — treating "couldn't reach the server"
  // the same as "you have no saved plan" is exactly what made a broken session
  // look like lost data and send someone back through onboarding
  async get(k) {
    const res = await fetch(`/api/store/${encodeURIComponent(k)}`, { credentials: 'include' });
    if (!res.ok) throw new Error(`Couldn't load your saved plan (${res.status}).`);
    const { value } = await res.json();
    return value;
  },
  async set(k, v) {
    const res = await fetch(`/api/store/${encodeURIComponent(k)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: v }),
    });
    if (!res.ok) throw new Error(`Couldn't save (${res.status}).`);
  },
  async del(k) {
    const res = await fetch(`/api/store/${encodeURIComponent(k)}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) throw new Error(`Couldn't reset (${res.status}).`);
  },
};

export const store = API_ENABLED ? remote : localStore;
export { KEY };

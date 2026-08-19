import { store as localStore, KEY } from '../store.js';

/* ---------- backend-backed store ----------
   Same {get,set,del} shape as ../store.js (see the note there) — this is the
   Phase 1 swap it describes. Falls back to the local shim untouched when
   VITE_API_URL isn't set, so local dev needs no server running. */
const API = import.meta.env.VITE_API_URL;

const remote = {
  async get(k) {
    const res = await fetch(`${API}/api/store/${encodeURIComponent(k)}`, { credentials: 'include' });
    if (!res.ok) return null;
    const { value } = await res.json();
    return value;
  },
  async set(k, v) {
    await fetch(`${API}/api/store/${encodeURIComponent(k)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: v }),
    });
  },
  async del(k) {
    await fetch(`${API}/api/store/${encodeURIComponent(k)}`, { method: 'DELETE', credentials: 'include' });
  },
};

export const store = API ? remote : localStore;
export { KEY };

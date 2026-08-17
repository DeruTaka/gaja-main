/* ---------- storage (works in the artifact sandbox, degrades to memory) ----------
   Phase 0: this is the same local/in-memory shim gaja.html shipped with. It gets
   replaced by client/src/api/store.js (backend-backed) in Phase 1 — every call site
   uses this same {get,set,del} shape so that swap doesn't touch callers. */
const mem = {};
export const store = {
  async get(k) { try { if (window.storage) { const r = await window.storage.get(k, false); return r ? JSON.parse(r.value) : null; } } catch (e) {} return mem[k] ?? null; },
  async set(k, v) { try { if (window.storage) { await window.storage.set(k, JSON.stringify(v), false); return; } } catch (e) {} mem[k] = v; },
  async del(k) { try { if (window.storage) { await window.storage.delete(k, false); return; } } catch (e) {} delete mem[k]; },
};
export const KEY = 'gaja:plan:v1';

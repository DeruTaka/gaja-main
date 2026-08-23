/* ---------- auth client ----------
   Only talks to a backend when VITE_USE_API is set — otherwise `enabled` is
   false and the app never gates on sign-in at all (see auth/screen.js).
   Requests are always relative (/api/...): in production this client is
   served by the same Node process as the API (server/src/index.js), and in
   local dev Vite's own proxy (vite.config.js) forwards /api/* to a locally
   running server — either way it's same-origin, never a cross-site fetch. */
export const enabled = import.meta.env.VITE_USE_API === 'true';

async function req(path, opts = {}) {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || 'Something went wrong.');
  return body;
}

export const me = () => req('/api/auth/me');
export const login = (email, password) => req('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
export const signup = (email, password) => req('/api/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) });
export const logout = () => req('/api/auth/logout', { method: 'POST' });

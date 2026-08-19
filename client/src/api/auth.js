/* ---------- auth client ----------
   Only talks to a backend when VITE_API_URL is configured — otherwise `enabled`
   is false and the app never gates on sign-in at all (see auth/screen.js). */
const API = import.meta.env.VITE_API_URL;
export const enabled = !!API;

async function req(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
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

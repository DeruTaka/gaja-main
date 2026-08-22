import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error('JWT_SECRET is not set (see .env.example).');

export const COOKIE_NAME = 'gaja_session';

export const signToken = userId => jwt.sign({ sub: userId }, SECRET, { expiresIn: '30d' });

export const cookieOpts = () => {
  const prod = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    // In production the client and server are two separate Render services on
    // different subdomains (onrender.com is on the public suffix list, so
    // gaja-client.onrender.com and gaja-server.onrender.com are different
    // *sites*, not just different origins) — every /api/* fetch from the
    // client is genuinely cross-site. A SameSite=Lax cookie is silently
    // dropped by the browser on cross-site fetch/XHR (it only rides along on
    // top-level navigations), so the session looked like it never existed
    // past login: store.get()/me() would 401, and the client would treat that
    // as "no saved plan" and re-run onboarding. SameSite=None (which requires
    // Secure) is what actually lets the cookie travel with those requests.
    // Local dev keeps 'lax' — client and server are same-site there (just
    // different localhost ports), and 'lax' works fine without HTTPS.
    secure: prod,
    sameSite: prod ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
};

export function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: 'Not signed in.' });
  try {
    req.userId = jwt.verify(token, SECRET).sub;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired — sign in again.' });
  }
}

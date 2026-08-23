import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET;
if (!SECRET) throw new Error('JWT_SECRET is not set (see .env.example).');

export const COOKIE_NAME = 'gaja_session';

export const signToken = userId => jwt.sign({ sub: userId }, SECRET, { expiresIn: '30d' });

export const cookieOpts = () => ({
  httpOnly: true,
  // client and server are served by the same Node process now (server/src/index.js
  // serves the built client) — every request is genuinely same-origin, so 'lax' is
  // both correct and sufficient everywhere. (An earlier two-service split had the
  // client and API on different Render subdomains — different *sites*, not just
  // different origins — which made every /api/* fetch cross-site; Safari's ITP in
  // particular would drop the session cookie on those regardless of SameSite value,
  // which is what merging the services into one actually fixes, not a cookie flag.)
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000,
});

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

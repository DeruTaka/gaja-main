import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db.js';
import { signToken, cookieOpts, requireAuth, COOKIE_NAME } from '../auth.js';

export const authRouter = Router();

authRouter.post('/signup', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || password.length < 8)
      return res.status(400).json({ error: 'Email and an 8+ character password are required.' });

    const existing = await pool.query('select id from users where email = $1', [email]);
    if (existing.rows.length) return res.status(409).json({ error: 'An account with that email already exists.' });

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query(
      'insert into users (email, password_hash) values ($1, $2) returning id, email',
      [email, hash],
    );
    res.cookie(COOKIE_NAME, signToken(rows[0].id), cookieOpts());
    res.json({ email: rows[0].email });
  } catch (err) { next(err); }
});

authRouter.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const { rows } = await pool.query('select id, email, password_hash from users where email = $1', [email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash)))
      return res.status(401).json({ error: 'Incorrect email or password.' });

    res.cookie(COOKIE_NAME, signToken(user.id), cookieOpts());
    res.json({ email: user.email });
  } catch (err) { next(err); }
});

authRouter.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME, cookieOpts());
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query('select email from users where id = $1', [req.userId]);
    if (!rows[0]) return res.status(401).json({ error: 'Not signed in.' });
    res.json({ email: rows[0].email });
  } catch (err) { next(err); }
});

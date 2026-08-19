import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../auth.js';

export const storeRouter = Router();
storeRouter.use(requireAuth);

storeRouter.get('/:key', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'select value from store where user_id = $1 and key = $2',
      [req.userId, req.params.key],
    );
    res.json({ value: rows[0]?.value ?? null });
  } catch (err) { next(err); }
});

storeRouter.put('/:key', async (req, res, next) => {
  try {
    const value = req.body?.value ?? null;
    await pool.query(
      `insert into store (user_id, key, value, updated_at) values ($1, $2, $3, now())
       on conflict (user_id, key) do update set value = excluded.value, updated_at = now()`,
      [req.userId, req.params.key, value],
    );
    res.json({ ok: true });
  } catch (err) { next(err); }
});

storeRouter.delete('/:key', async (req, res, next) => {
  try {
    await pool.query('delete from store where user_id = $1 and key = $2', [req.userId, req.params.key]);
    res.json({ ok: true });
  } catch (err) { next(err); }
});

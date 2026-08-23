import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { authRouter } from './routes/auth.js';
import { storeRouter } from './routes/store.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', authRouter);
app.use('/api/store', storeRouter);

/* the built client lives right alongside this service now (one Render web
   service builds both — see render.yaml) — client and API are genuinely the
   same origin, which is what actually fixes Safari's ITP dropping the session
   cookie on cross-site requests (no CORS middleware needed either, since a
   same-origin request never triggers a CORS check in the first place).
   Mounted after the /api routes so the SPA fallback never shadows them. */
const clientDist = path.resolve(__dirname, '../../client/dist');
app.use(express.static(clientDist));
app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));

// last-resort error handler — keeps a bad query from taking the process down
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our end.' });
});

const port = process.env.PORT || 8787;
app.listen(port, () => console.log(`gaja listening on :${port}`));

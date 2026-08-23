# gaja-server

The backend for Gaja: auth (email + password) and a small key/value store that
mirrors the client's `{get, set, del}` shape, backed by Postgres. It also
serves the built client (`client/dist`) — see the note in `src/index.js` for
why client and API are deliberately one service, not two: a prior two-service
split put them on different Render subdomains, which made every `/api/*`
request genuinely cross-site and Safari's Intelligent Tracking Prevention
would silently drop the session cookie on those, breaking sign-in on iOS.

## Local dev

```bash
cp .env.example .env      # fill in DATABASE_URL and JWT_SECRET
npm install
npm run migrate           # creates the users/store tables
npm run dev                # http://localhost:8787
```

The client only talks to this server when `VITE_USE_API=true` is set (see
`client/.env.example`) — without it, the client keeps using its local/in-memory
store exactly as before, so day-to-day frontend dev doesn't need this running.
With it set, run `npm run dev -w client` in another terminal — Vite's dev
proxy (`client/vite.config.js`) forwards `/api/*` to this server so it behaves
exactly like production's single-origin setup.

## Deploying (Neon + Render)

The `render.yaml` at the repo root defines **one** service — it builds the
client, then serves both the client and the API from this one Node process.

1. **Neon** — create a project at neon.tech, then a database (e.g. `gaja`).
   Copy the **pooled** connection string from the dashboard (the one with
   `-pooler` in the hostname) — that's your `DATABASE_URL`. It already
   includes `?sslmode=require`.

2. **Render Blueprint** — New → Blueprint → point it at this repo. It reads
   `render.yaml` and provisions the service. You'll be prompted for
   `DATABASE_URL` (the Neon connection string from step 1) — `JWT_SECRET` is
   auto-generated, and `VITE_USE_API`/`NODE_ENV` are already set in the
   blueprint, nothing else to fill in.

3. That's it — the start command runs the (idempotent) migration before every
   boot, so schema changes just ship on the next deploy with no manual step.

## API

All `/api/store/*` routes require an authenticated session (cookie, set by
login/signup) and are scoped to that user.

| Route                    | Method | Body                    |
|---------------------------|--------|--------------------------|
| `/api/auth/signup`        | POST   | `{ email, password }`   |
| `/api/auth/login`         | POST   | `{ email, password }`   |
| `/api/auth/logout`        | POST   | —                        |
| `/api/auth/me`            | GET    | —                        |
| `/api/store/:key`         | GET    | —                        |
| `/api/store/:key`         | PUT    | `{ value }`              |
| `/api/store/:key`         | DELETE | —                        |

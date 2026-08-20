# gaja-server

The backend for Gaja: auth (email + password) and a small key/value store that
mirrors the client's `{get, set, del}` shape, backed by Postgres.

## Local dev

```bash
cp .env.example .env      # fill in DATABASE_URL and JWT_SECRET
npm install
npm run migrate           # creates the users/store tables
npm run dev                # http://localhost:8787
```

The client only talks to this server when `VITE_API_URL` is set (see
`client/.env.example`) — without it, the client keeps using its local/in-memory
store exactly as before, so day-to-day frontend dev doesn't need this running.

## Deploying (Neon + Render)

The `render.yaml` at the repo root defines **both** services — the API
(`gaja-server`, a free Node web service) and the frontend (`gaja-client`, a
free static site) — so this is one Blueprint deploy, not two separate setups.

1. **Neon** — create a project at neon.tech, then a database (e.g. `gaja`).
   Copy the **pooled** connection string from the dashboard (the one with
   `-pooler` in the hostname) — that's your `DATABASE_URL`. It already
   includes `?sslmode=require`.

2. **Render Blueprint** — New → Blueprint → point it at this repo. It reads
   `render.yaml` and provisions both services in one go. You'll be prompted
   for:
   - `DATABASE_URL` (on `gaja-server`) — the Neon connection string from step 1
   - `CLIENT_ORIGIN` (on `gaja-server`) and `VITE_API_URL` (on `gaja-client`)
     — leave these blank for now; see step 4, you can't know them until both
     services exist
   - `JWT_SECRET` is auto-generated, nothing to fill in

3. **Run the migration once** against the deployed database — either run
   `npm run migrate` locally with `DATABASE_URL` pointed at Neon, or open a
   one-off shell on the `gaja-server` Render service and run it there.

4. **Cross-wire the two services' URLs** — once the blueprint finishes, both
   services have real `*.onrender.com` URLs visible in the dashboard. Now:
   - On `gaja-server`: set `CLIENT_ORIGIN` to `gaja-client`'s URL (e.g.
     `https://gaja-client.onrender.com`). Render restarts the service
     automatically when an env var changes — no rebuild needed.
   - On `gaja-client`: set `VITE_API_URL` to `gaja-server`'s URL (e.g.
     `https://gaja-server.onrender.com`), then trigger a **manual redeploy**
     of `gaja-client` — Vite bakes this in at build time, so just saving the
     env var alone doesn't take effect.

   After that, both are live and pointing at each other.

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

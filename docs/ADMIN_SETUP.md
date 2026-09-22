# Admin + external DB setup (5 minutes, no connection strings)

The admin panel (`/admin`) stores its **hashed password in an external managed
database** — Cloudflare D1 (SQLite). Workers talk to it over the `DB` binding,
so there is no `DATABASE_URL`, no driver, no connection pool to manage.

## 1. Create the database (once)

```bash
npx wrangler d1 create portfolio-db
```

Copy the `database_id` it prints into `wrangler.jsonc`:

```jsonc
"d1_databases": [{ "binding": "DB", "database_name": "portfolio-db",
  "database_id": "PASTE_REAL_ID_HERE", "migrations_dir": "migrations" }]
```

## 2. Create tables (local + production)

```bash
npm run db:migrate:local    # local dev
npm run db:migrate:remote   # production
```

This applies `migrations/0001_init.sql`:
`admin_users`, `admin_sessions`, `content_items`.

## 3. Create your admin user (hashed, never plaintext)

```bash
npm run admin:create -- --username divyansh --apply-remote
# local dev:  npm run admin:create -- --username divyansh --apply-local
```

The script prompts for a password (12+ chars, hidden), hashes it with
PBKDF2-SHA256 (100k iterations — the Cloudflare Workers maximum, random 16-byte salt — same code as
`src/lib/admin-auth.ts`), and upserts it into D1. Without `--apply-*` it
prints the SQL + `.dev.vars` fallback values instead.

## 4. Sign in

Open `/admin` → sign in. You get full control:

- **Tabs:** Certifications / Research / Blogs
- **Add / Edit / Delete**, **Show / Hide**, **↑ ↓ reorder** (auto-saves `sort_order`)
- **Change password** (other sessions are signed out)

## How the public site behaves

| Section                            | Visibility                                                                                                                                                                                                                                                              |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Certifications (`#certifications`) | Always visible. Seeded with your 2 real certs (TryHackMe SEC1 + LF LFS16) until D1 rows exist. After setup use **Import seed certifications** in `/admin` for editable ownership — hiding every D1 row hides the section (seeds never resurrect once you take control). |
| Research (`#research`)             | **Hidden** until you publish ≥1 visible item from `/admin`.                                                                                                                                                                                                             |
| Blogs (`#blogs`)                   | **Hidden** until you publish ≥1 visible item from `/admin`.                                                                                                                                                                                                             |

Nav links for Research/Blogs appear automatically once published.

## Security model (strict by default)

- PBKDF2-SHA256, 100k iterations — the Cloudflare Workers maximum, per-user salt; constant-time compare.
- Sessions: 32-byte opaque token, only `SHA-256(token)` stored; cookie is
  `httpOnly`, `Secure` (https), `SameSite=Lax`, 12h expiry.
- Login rate limit: 5 attempts / 10 min per IP; generic error messages plus
  dummy-PBKDF2 timing equalization (no user enumeration by message or timing);
  CSRF origin check on login and all cookie-authed writes.
- No public signup — admins are created only via the CLI script.
- `/admin` is `noindex`, and `robots.txt` disallows `/admin` + `/api/admin/`.

## Local dev without D1

If `DB` isn't bound yet, the server falls back to:

- Content: seed certs + in-memory items (non-persistent, for UI testing).
- Auth: single admin from environment (`ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` /
  `ADMIN_PASSWORD_SALT` from `npm run admin:create`). Provide them by exporting
  in your shell (always works, since the server falls back to `process.env`):

```bash
ADMIN_USERNAME=divyansh ADMIN_PASSWORD_HASH=<hex> ADMIN_PASSWORD_SALT=<hex> npm run dev
```

(Adding them to `.dev.vars` also works if your Cloudflare plugin setup forwards
custom vars to the worker runtime; exported env vars are the sure path.)

Set up D1 before deploying — the fallback is local-only.

## API reference

- `GET /api/content?kind=certification|research|blog` — public, visible items only.
- `GET /api/admin/status` — `{ db, hasAdmin }` (setup probe).
- `POST /api/admin/login|logout`, `GET /api/admin/me`
- `GET|POST /api/admin/items?kind=all|…`, `PUT|DELETE /api/admin/items/:id`
- `POST /api/admin/reorder` `{ kind, ids }`, `PUT /api/admin/password`
- `POST /api/admin/seed-import` `{ kind: "certification" }` — one-time import of
  seed certs into D1 (409 once rows exist)

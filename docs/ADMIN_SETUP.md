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

> ⚠️ Keep `"binding"` as `"DB"` — the server reads `env.DB`. Newer wrangler
> versions auto-insert `"binding": "portfolio_db"` (derived from the database
> name) when creating the DB; rename it back to `"DB"`, commit, and push,
> otherwise production reports "D1 is not bound".

## 2. Create tables (local + production)

```bash
npm run db:migrate:local    # local dev
npm run db:migrate:remote   # production
```

This applies `migrations/0001_init.sql` (`admin_users`, `admin_sessions`,
`content_items`) and `migrations/0002_meta_settings.sql` (`meta` column +
`site_settings` table). Re-run both commands after pulling updates that add
new migration files.

## 3. Create your admin user (hashed, never plaintext)

```bash
npm run admin:create -- --username divyansh --apply-remote
# local dev:  npm run admin:create -- --username divyansh --apply-local
# machine-generated password (no typing): add --generate
# bypass the hidden prompt:  ADMIN_PASSWORD='...' npm run admin:create -- --username divyansh --apply-remote
```

The script hashes the password with PBKDF2-SHA256 (100k iterations — the
Cloudflare Workers maximum, random 16-byte salt — same code as
`src/lib/admin-auth.ts`), and upserts it into D1. Without `--apply-*` it
prints the SQL + `.dev.vars` fallback values instead. Wait for the
`Done. Sign in at /admin.` line — anything else means it did not write.

## 4. Sign in

Open `/admin` → sign in. You get full control of the portfolio:

- **Tabs for every section:** Certifications, Projects, Experience, Achievements,
  Skills, About cards, Status cards, Research, Blogs — plus **Site settings**.
- **Add / Edit / Delete**, **Show / Hide**, **↑ ↓ reorder** (auto-saves
  `sort_order`, the public site follows it).
- **Import seeds** (one-click editable ownership), **Export/Import JSON**
  (backup & restore per section).
- **Site settings:** hero roles/tagline/location, about intro, contact email +
  socials + status line, footer repo link, and per-section **on/off toggles**.
- **Change password** (other sessions are signed out).

## How the public site behaves

| Section                                                                                     | Visibility                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| About / Skills / Projects / Experience / Certifications / Achievements / Building / Contact | Visible while the section holds ≥1 visible item **and** its toggle is on (`Site settings`). Seeded with the current site content until D1 rows exist; hiding everything (or toggling off) hides the section. |
| Research (`#research`), Blogs (`#blogs`)                                                    | **Hidden** until you publish ≥1 visible item from `/admin` (toggle must also be on).                                                                                                                         |

Nav links follow automatically: Research/Blogs appear once published; links for
toggled-off sections disappear.

## Field map (what each field does per kind)

- **Common:** title\*, subtitle, description, URL, image, tags (comma-separated),
  sort order, visible flag.
- **project:** subtitle = tag chip, URL = repo, tags = stack,
  meta `{"long": "dialog text", "demo": "live URL (optional)"}`.
- **experience:** subtitle = venue, description = body,
  meta `{"when": "May 2026 – July 2026", "tag": "Open Source"}`.
- **achievement:** subtitle = sub-line, meta `{"icon": "trophy|award|badge|star"}`.
- **skill:** title = group name, tags = skills. No meta.
- **about:** title + description = card, meta `{"icon": "shield|cloud|code|terminal"}`.
- **building:** meta.card `build|learn|now`. `learn` uses meta `{"lines": [...]}`;
  `now` uses meta `{"stats": [{"l": "…", "v": "…"}]}`.
- **certification/research/blog:** URL = verify/paper/article link. No meta.

Meta is a JSON object (max 4000 chars); the editor validates it before saving.

## Security model (strict by default)

- PBKDF2-SHA256, 100k iterations — the Cloudflare Workers maximum, per-user salt; constant-time compare.
- Sessions: 32-byte opaque token, only `SHA-256(token)` stored; cookie is
  `httpOnly`, `Secure` (https), `SameSite=Lax`, 12h expiry.
- Login rate limit: 5 attempts / 10 min per IP (per edge isolate); generic
  error messages plus dummy-PBKDF2 timing equalization (no user enumeration
  by message or timing); CSRF origin check on login and all cookie-authed writes.
- Transport hardening on every response: `frame-ancestors 'self'` (+ legacy
  `X-Frame-Options`, clickjacking defence for `/admin`), `nosniff`,
  `same-origin` referrer policy. No CORS headers are ever set (same-origin only).
- DoS guards: all JSON bodies capped at 64 KB (stream-capped read, rejected
  before parse); reorder/import capped at 200 rows; sort/tag/meta lengths
  bounded; over-long fields are rejected with 400s, never silently truncated.
- All D1 access is parameterized; crypto failures are logged server-side,
  never fail open, and never leak material to clients.
- No public signup — admins are created only via the CLI script.
- `/admin` is `noindex`, and `robots.txt` disallows `/admin` + `/api/admin/`.

## Local dev without D1

If `DB` isn't bound yet, the server falls back to:

- Content: all seeds + in-memory CRUD (non-persistent, for UI testing).
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

- `GET /api/content?kind=…` — public, visible items only. Kinds: `certification`,
  `research`, `blog`, `project`, `experience`, `achievement`, `skill`, `about`,
  `building`.
- `GET /api/settings` — public merged site settings (cached).
- `GET /api/admin/status` — `{ db, hasAdmin, metaReady }` (setup + schema probe;
  if `metaReady` is false, apply migration 0002).
- `POST /api/admin/login|logout`, `GET /api/admin/me`
- `GET|POST /api/admin/items?kind=all|…`, `PUT|DELETE /api/admin/items/:id`
- `POST /api/admin/reorder` `{ kind, ids }`, `PUT /api/admin/password`
- `POST /api/admin/seed-import` `{ kind }` — one-time import of that kind's
  seeds into D1 (409 once rows exist; 400 for seedless kinds like research/blog)
- `GET|PUT /api/admin/settings`, `DELETE /api/admin/settings/:key` (reset to default)

## Troubleshooting

| Symptom                                                | Cause → fix                                                                                                                                                                            |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Banner: "D1 is not bound"                              | `binding` isn't `"DB"` in the deployed `wrangler.jsonc`, or CI hasn't deployed the fix yet → check Deployments, fix name, push.                                                        |
| Banner: "No admin user exists yet" (D1 bound)          | Remote DB empty → `npm run db:migrate:remote`, then `admin:create --apply-remote`.                                                                                                     |
| "Invalid username or password" with the right password | (1) Throttled — wait 10 min. (2) Tested seconds after a reset — D1 reads can lag; wait 3–5 min. (3) Row never updated — compare `SELECT SUBSTR(password_hash,1,8)` before/after reset. |
| "Too many attempts"                                    | Per-IP login throttle — wait 10 minutes, then try once.                                                                                                                                |
| Amber "schema is outdated" in `/admin`                 | Migration 0002 missing → `npm run db:migrate:remote` (+ `:local`).                                                                                                                     |
| `wrangler d1 list` shows `num_tables: 0`               | Migrations never applied to remote → step 2 with `--remote`.                                                                                                                           |
| Edits don't show publicly                              | CDN caches content ~5 min (`s-maxage=300`) → wait or purge cache in the Cloudflare dashboard.                                                                                          |
| Contact form 500 in production                         | `RESEND_API_KEY` (and sender) missing on the worker → `npx wrangler secret put …` or dashboard Variables.                                                                              |

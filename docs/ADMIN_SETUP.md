# Admin setup

The admin panel (`/admin`) stores its hashed password in Cloudflare D1 (SQLite).
Workers reach it over the `DB` binding, so there is no connection string, driver
or pool to manage.

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
> versions auto-insert a different binding name when creating the DB; rename it
> back to `"DB"` and redeploy, otherwise production reports "D1 is not bound".

## 2. Create tables (local + production)

```bash
npm run db:migrate:local    # local dev
npm run db:migrate:remote   # production
```

This applies everything under `migrations/`. Re-run both commands after pulling
updates that add new migration files.

## 3. Create your admin user (hashed, never plaintext)

```bash
npm run admin:create -- --username <name> --apply-remote
# local dev:  npm run admin:create -- --username <name> --apply-local
# machine-generated password (no typing): add --generate
```

The script hashes the password before it ever touches the database and upserts
it into D1. Without `--apply-*` it prints the SQL + `.dev.vars` fallback values
instead. Wait for the `Done. Sign in at /admin.` line — anything else means it
did not write.

## 4. Sign in

Open `/admin` → sign in. From there you control every section (Certifications,
Projects, Experience, Achievements, Skills, About, Status, Research, Blogs),
add/edit/delete items, toggle visibility, reorder, import seeds, and
export/import JSON, plus manage **Site settings** and **Change password**.

## Two-step verification

Every state-changing action (saves, reorder, import, settings, password change)
requires a one-time code emailed to you on top of your session. Reading and
listing never needs it. Configure delivery with:

```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put ADMIN_EMAIL
npm run db:migrate:remote
```

Codes are short-lived and single-use; grants are bound to your session and end
with logout or a password change. Local `.dev.vars` fallback mode has no email
channel and only runs when `LOCAL_DEV_FALLBACK=1` is set; production with D1
always enforces step-up.

## How the public site behaves

| Section                                                                                     | Visibility                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| About / Skills / Projects / Experience / Certifications / Achievements / Building / Contact | Visible while the section holds ≥1 visible item **and** its toggle is on. Seeded with the current site content until D1 rows exist; hiding everything (or toggling off) hides the section. |
| Research (`#research`), Blogs (`#blogs`), Kind words (`#testimonials`)                      | **Hidden** until you publish ≥1 visible item from `/admin` (toggle must also be on).                                                                                                       |

Nav links, the footer sitemap and the `⌘K` palette follow the same rules — you
can never link to a section that renders null. `meta.publish_at` schedules an
item to publish later; drafts stay hidden via the eye toggle.

## Field map (what each field does per kind)

- **Common:** title\*, subtitle, description, URL, image, tags (comma-separated),
  sort order, visible flag.
- **project:** subtitle = tag chip, URL = repo (Source button), **Live demo URL
  field** = hosted app, tags = stack, image = screenshot,
  meta `{"long": "dialog text", "highlights": ["win", …]}`.
- **experience:** subtitle = venue, description = body,
  meta `{"when": "May 2026 – July 2026", "tag": "Open Source", "bullets": [...]}`.
- **achievement:** subtitle = sub-line, meta `{"icon": "trophy|award|badge|star"}`.
- **skill:** title = group name, tags = skills.
- **about:** title + description = card, meta `{"icon": "shield|cloud|code|terminal"}`.
- **building:** meta.card `build|learn|now`. `learn` uses meta `{"lines": [...]}`;
  `now` uses meta `{"stats": [{"l": "…", "v": "…"}]}`.
- **testimonial:** title = person, subtitle = role/org, description = quote, URL = profile.
- **certification/research/blog:** URL = verify/paper/article link.

Meta is a JSON object (max 4000 chars); the editor validates it before saving.

## Local dev without D1

If `DB` isn't bound yet **and `LOCAL_DEV_FALLBACK=1` is set**, the server falls
back to seeds + in-memory CRUD and a single admin from environment variables:

```bash
LOCAL_DEV_FALLBACK=1 \
ADMIN_USERNAME=<name> ADMIN_PASSWORD_HASH=<hex> ADMIN_PASSWORD_SALT=<hex> npm run dev
```

The fallback is **opt-in** and fails closed: without `LOCAL_DEV_FALLBACK=1`, a
missing `DB` binding denies login and blocks all mutations. An accidentally
unbound production Worker can never bypass auth, so set up D1 before deploying.

## Troubleshooting

| Symptom                                                | Cause → fix                                                                                   |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Banner: "D1 is not bound"                              | `binding` isn't `"DB"` in the deployed `wrangler.jsonc`, or CI hasn't deployed the fix yet.   |
| Banner: "No admin user exists yet" (D1 bound)          | Remote DB empty → `npm run db:migrate:remote`, then `admin:create --apply-remote`.            |
| "Invalid username or password" with the right password | Throttled — wait, then try once. If you just reset it, D1 reads can lag briefly.              |
| Save rejected: "Step-up verification required"         | Verify the emailed code first. If no email arrives, check the Resend secrets and spam folder. |
| Amber "schema is outdated" in `/admin`                 | A migration is missing → re-run the migrate commands with `--remote` (+ `:local`).            |
| `wrangler d1 list` shows `num_tables: 0`               | Migrations never applied to remote → step 2 with `--remote`.                                  |
| Edits don't show publicly                              | CDN caches content briefly → wait or purge cache in the Cloudflare dashboard.                 |
| Contact form 500 in production                         | `RESEND_API_KEY` (and sender) missing on the worker → set it via `wrangler secret put`.       |

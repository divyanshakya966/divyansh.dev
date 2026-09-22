-- Portfolio full-control schema additions.
-- Apply with: npm run db:migrate:local / npm run db:migrate:remote

-- Kind-specific extras (project demo URL + long text, experience dates,
-- achievement/about icons, building card lines/stats) as a JSON object.
ALTER TABLE content_items ADD COLUMN meta TEXT NOT NULL DEFAULT '{}';

-- Singleton site settings: hero text, contact details, footer link,
-- per-section visibility flags. Keyed strings; defaults live in code
-- (src/lib/settings.ts) so the site works before any row exists.
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL
);

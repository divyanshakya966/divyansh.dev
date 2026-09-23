-- Step-up verification for admin mutations (one-time email codes).
-- Apply with: npm run db:migrate:local / npm run db:migrate:remote

-- One-time codes: only SHA-256(code) is stored. Short-lived, attempt-capped.
CREATE TABLE IF NOT EXISTS admin_otps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  used INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_otps_user ON admin_otps(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_otps_expires ON admin_otps(expires_at);

-- Verified grants: issued after a correct code, required (with the session)
-- for every mutating admin call. Short-lived; only the token hash is stored.
CREATE TABLE IF NOT EXISTS admin_grants (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_grants_user ON admin_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_grants_expires ON admin_grants(expires_at);

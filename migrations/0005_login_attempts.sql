-- Persistent login throttling: an in-memory limiter resets whenever a Worker
-- isolate is recycled and is not shared across the edge, so brute-force
-- resistance must live in D1. One row per attempt, keyed by IP and username;
-- expired rows are pruned opportunistically. Apply with:
-- npm run db:migrate:local / npm run db:migrate:remote

CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bucket TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_attempts_bucket
  ON login_attempts(bucket, created_at);

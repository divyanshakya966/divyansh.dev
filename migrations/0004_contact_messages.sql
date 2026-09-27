-- Contact inbox: every valid /api/contact submission is persisted here
-- before email dispatch, so no lead is ever lost to a mail outage.
-- Apply with: npm run db:migrate:local / npm run db:migrate:remote

CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  ip TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contact_messages_created
  ON contact_messages(created_at);

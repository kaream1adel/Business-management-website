-- Personal accounts. Every business and task belongs to one user; the API
-- only ever reads and writes the signed-in user's rows.

CREATE TABLE users (
  id             TEXT PRIMARY KEY,
  -- NULL only for the unclaimed first account (see below)
  username       TEXT COLLATE NOCASE UNIQUE
                 CHECK (username IS NULL OR length(username) BETWEEN 3 AND 32),
  pass_hash      TEXT,                       -- pbkdf2$<iterations>$<salt>$<hash>
  created_at     TEXT NOT NULL,
  last_login_at  TEXT
);

-- Data that existed before accounts belongs to the first account. It is
-- claimed the first time someone signs in with the original login
-- (DASHBOARD_USER / DASHBOARD_PASS), which then becomes a normal account.
INSERT INTO users (id, username, pass_hash, created_at) VALUES ('owner', NULL, NULL, '2026-11-13T00:00:00.000Z');

ALTER TABLE businesses ADD COLUMN user_id TEXT REFERENCES users(id);
ALTER TABLE tasks      ADD COLUMN user_id TEXT REFERENCES users(id);
UPDATE businesses SET user_id = 'owner';
UPDATE tasks      SET user_id = 'owner';

CREATE INDEX idx_businesses_user ON businesses (user_id, sort_order);
CREATE INDEX idx_tasks_user      ON tasks (user_id, deleted_at);

-- Every business has an owner, and a task always has the same owner as its
-- business, whatever the client sends.
CREATE TRIGGER businesses_owner_insert BEFORE INSERT ON businesses
WHEN NEW.user_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'constraint failed: business needs an owner');
END;

CREATE TRIGGER businesses_owner_update BEFORE UPDATE OF user_id ON businesses
WHEN NEW.user_id IS NULL OR NEW.user_id != OLD.user_id
BEGIN
  SELECT RAISE(ABORT, 'constraint failed: business owner cannot change');
END;

CREATE TRIGGER tasks_owner_insert BEFORE INSERT ON tasks
WHEN NEW.user_id IS NULL OR NEW.user_id IS NOT (SELECT user_id FROM businesses WHERE id = NEW.biz_id)
BEGIN
  SELECT RAISE(ABORT, 'constraint failed: task owner must match its business');
END;

CREATE TRIGGER tasks_owner_update BEFORE UPDATE OF user_id, biz_id ON tasks
WHEN NEW.user_id IS NULL OR NEW.user_id IS NOT (SELECT user_id FROM businesses WHERE id = NEW.biz_id)
BEGIN
  SELECT RAISE(ABORT, 'constraint failed: task owner must match its business');
END;

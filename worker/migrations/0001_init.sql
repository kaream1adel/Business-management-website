-- BizDash schema. The database itself enforces valid values, so bad data
-- is rejected no matter which device or client sends it.

CREATE TABLE businesses (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

INSERT INTO businesses (id, name, color, sort_order) VALUES
  ('can_filling', 'Can Filling Line',    '#3b82f6', 1),
  ('sheet_metal', 'Sheet Metal Factory', '#8b5cf6', 2),
  ('trading',     'Trading Office',      '#10b981', 3);

CREATE TABLE tasks (
  id              TEXT PRIMARY KEY,
  biz_id          TEXT NOT NULL REFERENCES businesses(id),
  task_name       TEXT NOT NULL CHECK (length(trim(task_name)) BETWEEN 1 AND 300),
  status          TEXT NOT NULL DEFAULT 'Not Started'
                  CHECK (status IN ('Not Started', 'In Progress', 'Blocked', 'Done')),
  priority        TEXT CHECK (priority IN ('High', 'Medium', 'Low')),          -- NULL = none
  responsible     TEXT NOT NULL DEFAULT '' CHECK (length(responsible) <= 200),
  system          TEXT NOT NULL DEFAULT '' CHECK (length(system) <= 200),
  -- YYYY-MM-DD only; date(x) IS x rejects impossible dates like 2026-02-31
  planned_date    TEXT CHECK (planned_date IS NULL OR date(planned_date) IS planned_date),
  deadline        TEXT CHECK (deadline     IS NULL OR date(deadline)     IS deadline),
  notes           TEXT NOT NULL DEFAULT '' CHECK (length(notes) <= 10000),
  blocking_issue  TEXT NOT NULL DEFAULT '' CHECK (length(blocking_issue) <= 10000),
  extra           TEXT CHECK (extra IS NULL OR json_valid(extra)),            -- read-only data kept from Notion
  version         INTEGER NOT NULL DEFAULT 1 CHECK (version >= 1),            -- bumps on every change; guards against overwrites
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  completed_at    TEXT,
  deleted_at      TEXT                                                        -- soft delete: rows are never removed
);

CREATE INDEX idx_tasks_live ON tasks (deleted_at, biz_id);

CREATE TABLE activity_log (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id  TEXT NOT NULL REFERENCES tasks(id),
  action   TEXT NOT NULL CHECK (action IN ('import', 'create', 'update', 'delete', 'restore')),
  version  INTEGER NOT NULL,
  changes  TEXT CHECK (changes IS NULL OR json_valid(changes)),
  at       TEXT NOT NULL
);

CREATE INDEX idx_log_task ON activity_log (task_id, id);

CREATE TABLE login_attempts (
  ip  TEXT NOT NULL,
  at  INTEGER NOT NULL
);

CREATE INDEX idx_login_ip ON login_attempts (ip, at);

-- Businesses become editable: add/rename/recolor/reorder/archive.
-- Adds columns only; no existing data is removed.

ALTER TABLE businesses ADD COLUMN version     INTEGER NOT NULL DEFAULT 1;
ALTER TABLE businesses ADD COLUMN archived_at TEXT;
ALTER TABLE businesses ADD COLUMN created_at  TEXT;

UPDATE businesses SET created_at = '2026-11-13T00:00:00.000Z' WHERE created_at IS NULL;

-- Quieter default colours for the redesigned UI (only if still the original seed colours)
UPDATE businesses SET color = '#2f5d8a' WHERE id = 'can_filling' AND color = '#3b82f6';
UPDATE businesses SET color = '#8a5a3c' WHERE id = 'sheet_metal' AND color = '#8b5cf6';
UPDATE businesses SET color = '#5a7d3a' WHERE id = 'trading'     AND color = '#10b981';

-- SQLite can't add CHECK constraints to an existing table, so the same rules
-- are enforced with triggers: the database rejects bad data from any client.
CREATE TRIGGER businesses_check_insert BEFORE INSERT ON businesses
WHEN length(trim(NEW.name)) NOT BETWEEN 1 AND 80
  OR NEW.color NOT GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'
  OR NEW.version < 1
BEGIN
  SELECT RAISE(ABORT, 'constraint failed: business name must be 1-80 chars and color #rrggbb');
END;

CREATE TRIGGER businesses_check_update BEFORE UPDATE ON businesses
WHEN length(trim(NEW.name)) NOT BETWEEN 1 AND 80
  OR NEW.color NOT GLOB '#[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]'
  OR NEW.version < 1
BEGIN
  SELECT RAISE(ABORT, 'constraint failed: business name must be 1-80 chars and color #rrggbb');
END;

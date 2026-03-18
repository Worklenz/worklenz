-- Ensure import_hierarchy_mappings has position column
BEGIN;

ALTER TABLE IF EXISTS import_hierarchy_mappings
  ADD COLUMN IF NOT EXISTS position INT NOT NULL DEFAULT 0;

COMMIT;

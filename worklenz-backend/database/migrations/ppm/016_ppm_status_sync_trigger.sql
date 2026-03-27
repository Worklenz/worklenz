-- PPM Migration 016: Status sync trigger
--
-- When a Worklenz task's status_id changes, update the linked
-- ppm_deliverables.status using the ID-based ppm_status_mapping table.
-- Scoped to PPM tasks only (EXISTS check on ppm_deliverables).
-- Falls back to 'queued' if mapping is missing (with WARNING log).

BEGIN;

CREATE OR REPLACE FUNCTION ppm_sync_deliverable_status() RETURNS trigger AS $$
BEGIN
    -- Only run for PPM tasks (tasks with a linked ppm_deliverable)
    IF NOT EXISTS (SELECT 1 FROM ppm_deliverables WHERE worklenz_task_id = NEW.id) THEN
        RETURN NEW;
    END IF;

    -- Only update if a mapping exists — never silently reset to a default status
    IF EXISTS (
        SELECT 1 FROM ppm_status_mapping
        WHERE project_id = NEW.project_id AND task_status_id = NEW.status_id
    ) THEN
        UPDATE ppm_deliverables SET status = (
            SELECT sm.ppm_status FROM ppm_status_mapping sm
            WHERE sm.project_id = NEW.project_id AND sm.task_status_id = NEW.status_id
        ) WHERE worklenz_task_id = NEW.id;
    ELSE
        -- No mapping found — preserve current status and log warning
        RAISE WARNING 'ppm_sync: no mapping for project=% status=%, deliverable status preserved', NEW.project_id, NEW.status_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if any (idempotent)
DROP TRIGGER IF EXISTS ppm_sync_status_on_task_change ON tasks;

CREATE TRIGGER ppm_sync_status_on_task_change
    AFTER UPDATE OF status_id ON tasks
    FOR EACH ROW
    WHEN (OLD.status_id IS DISTINCT FROM NEW.status_id)
    EXECUTE FUNCTION ppm_sync_deliverable_status();

COMMENT ON FUNCTION ppm_sync_deliverable_status IS 'Syncs ppm_deliverables.status when Worklenz task status_id changes. Uses ID-based ppm_status_mapping for robust lookup.';

COMMIT;

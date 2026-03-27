-- PPM Migration 017: NOTIFY trigger for portal task creation
--
-- Fires ppm_task_created channel when a new ppm_deliverables row is INSERTed
-- with a worklenz_task_id (meaning the Worklenz task was successfully created).
-- The Phase 1 LISTEN/NOTIFY listener picks this up and broadcasts to Socket.IO.

BEGIN;

CREATE OR REPLACE FUNCTION ppm_notify_task_created() RETURNS trigger AS $$
BEGIN
    -- Only fire when worklenz_task_id is set (task creation succeeded)
    IF NEW.worklenz_task_id IS NOT NULL THEN
        PERFORM pg_notify('ppm_task_created', json_build_object(
            'deliverable_id', NEW.id,
            'task_id', NEW.worklenz_task_id,
            'project_id', (SELECT project_id FROM ppm_client_projects
                           WHERE client_id = NEW.client_id AND is_primary = true
                           LIMIT 1),
            'client_id', NEW.client_id,
            'title', NEW.title,
            'status', NEW.status,
            'created_at', NEW.created_at
        )::text);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Fire on INSERT (new task) and UPDATE of worklenz_task_id (task link established)
DROP TRIGGER IF EXISTS ppm_task_created_trigger ON ppm_deliverables;

CREATE TRIGGER ppm_task_created_trigger
    AFTER INSERT OR UPDATE OF worklenz_task_id ON ppm_deliverables
    FOR EACH ROW
    WHEN (NEW.worklenz_task_id IS NOT NULL)
    EXECUTE FUNCTION ppm_notify_task_created();

COMMENT ON FUNCTION ppm_notify_task_created IS 'Fires PG NOTIFY on ppm_task_created channel when a portal task is created and linked to a Worklenz task.';

COMMIT;

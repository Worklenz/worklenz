-- PPM Phase 1: LISTEN/NOTIFY trigger for task status changes
-- Fires when a task's status_id changes, notifying the ppm_status_change channel

CREATE OR REPLACE FUNCTION ppm_notify_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status_id IS DISTINCT FROM NEW.status_id THEN
    PERFORM pg_notify(
      'ppm_status_change',
      json_build_object(
        'task_id', NEW.id,
        'project_id', NEW.project_id,
        'old_status_id', OLD.status_id,
        'new_status_id', NEW.status_id,
        'updated_at', NOW()
      )::text
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ppm_task_status_change_trigger ON tasks;

CREATE TRIGGER ppm_task_status_change_trigger
  AFTER UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION ppm_notify_status_change();

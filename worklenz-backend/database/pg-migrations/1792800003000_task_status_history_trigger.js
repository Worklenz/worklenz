"use strict";

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/**
 * Ensure every tasks.status_id change records history, and at most one open row per task.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 */
exports.up = async (pgm) => {
  pgm.sql(`
-- Close duplicate open history rows before enforcing uniqueness (keep latest per task).
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY task_id
           ORDER BY entered_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
         ) AS rn
  FROM task_status_history
  WHERE exited_at IS NULL
)
UPDATE task_status_history tsh
SET exited_at = CURRENT_TIMESTAMP
FROM ranked r
WHERE tsh.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_task_status_history_one_open
  ON task_status_history(task_id)
  WHERE exited_at IS NULL;

CREATE OR REPLACE FUNCTION trg_tasks_record_status_history()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status_id IS NOT NULL AND NEW.project_id IS NOT NULL THEN
      INSERT INTO task_status_history (
        task_id, project_id, status_id, previous_status_id, entered_at, changed_by
      ) VALUES (
        NEW.id, NEW.project_id, NEW.status_id, NULL, CURRENT_TIMESTAMP, NULL
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.status_id IS DISTINCT FROM OLD.status_id AND NEW.status_id IS NOT NULL THEN
      UPDATE task_status_history
      SET exited_at = CURRENT_TIMESTAMP
      WHERE task_id = NEW.id
        AND exited_at IS NULL;

      INSERT INTO task_status_history (
        task_id, project_id, status_id, previous_status_id, entered_at, changed_by
      ) VALUES (
        NEW.id,
        NEW.project_id,
        NEW.status_id,
        OLD.status_id,
        CURRENT_TIMESTAMP,
        NULL
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_record_status_history ON tasks;
CREATE TRIGGER tasks_record_status_history
  AFTER INSERT OR UPDATE OF status_id ON tasks
  FOR EACH ROW
  EXECUTE PROCEDURE trg_tasks_record_status_history();
`);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
DROP TRIGGER IF EXISTS tasks_record_status_history ON tasks;
DROP FUNCTION IF EXISTS trg_tasks_record_status_history();
DROP INDEX IF EXISTS idx_task_status_history_one_open;
`);
};

'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    -- Forward-only migration for already-deployed databases.
    -- This re-applies the runtime function and trigger changes without touching the
    -- historical bootstrap migration files that are only used for fresh installs.

    -- Fix get_task_complete_ratio() first: the previously deployed version divides by
    -- zero for leaf tasks (_total_tasks = _sub_tasks_count with no zero-check when a task
    -- has no sub-tasks), which would abort this migration's recalculate_all_task_progress()
    -- call below on any database that has at least one leaf task. The corrected version
    -- also makes leaf-task ratio reflect the task's own done status instead of the old
    -- always-zero behavior.
    CREATE OR REPLACE FUNCTION get_task_complete_ratio(_task_id uuid) RETURNS json
        LANGUAGE plpgsql
    AS
    $$
    DECLARE
        _parent_task_done FLOAT = 0;
        _sub_tasks_done   FLOAT = 0;
        _sub_tasks_count  FLOAT = 0;
        _total_completed  FLOAT = 0;
        _total_tasks      FLOAT = 0;
        _ratio            FLOAT = 0;
    BEGIN
        -- Count total sub-tasks
        SELECT COUNT(*) FROM tasks WHERE parent_task_id = _task_id AND archived IS FALSE INTO _sub_tasks_count;

        -- If no sub-tasks, this task's ratio is based on its own done status (leaf task)
        IF _sub_tasks_count = 0 THEN
            SELECT (CASE
                        WHEN EXISTS(SELECT 1
                                    FROM tasks_with_status_view
                                    WHERE tasks_with_status_view.task_id = _task_id
                                      AND is_done IS TRUE) THEN 100
                        ELSE 0 END)
            INTO _ratio;

            RETURN JSON_BUILD_OBJECT(
                'ratio', _ratio,
                'total_completed', 0,
                'total_tasks', 0
            );
        END IF;

        -- Check if parent task is marked as done
        SELECT (CASE
                    WHEN EXISTS(SELECT 1
                                FROM tasks_with_status_view
                                WHERE tasks_with_status_view.task_id = _task_id
                                  AND is_done IS TRUE) THEN 1
                    ELSE 0 END)
        INTO _parent_task_done;

        -- Count sub-tasks marked as done
        SELECT COUNT(*)
        FROM tasks_with_status_view
        WHERE parent_task_id = _task_id
          AND is_done IS TRUE
        INTO _sub_tasks_done;

        -- Calculate totals. Include the parent in the denominator so the backend ratio matches
        -- the task's actual completion set when the parent itself is considered complete.
        _total_completed = _parent_task_done + _sub_tasks_done;
        _total_tasks = _sub_tasks_count + 1; -- +1 for the parent task

        -- Calculate ratio with safety check
        IF _total_tasks > 0 THEN
            _ratio = (_total_completed / _total_tasks) * 100;
        ELSE
            _ratio = 0;
        END IF;

        RETURN JSON_BUILD_OBJECT(
            'ratio', _ratio,
            'total_completed', _total_completed,
            'total_tasks', _total_tasks
            );
    END
    $$;

    CREATE OR REPLACE FUNCTION update_parent_task_progress() RETURNS TRIGGER AS
    $$
    DECLARE
        _parent_task_id UUID;
        _project_id UUID;
        _ratio FLOAT;
    BEGIN
        IF NEW.parent_task_id IS NOT NULL THEN
            _parent_task_id := NEW.parent_task_id;

            UPDATE tasks
            SET manual_progress = FALSE
            WHERE id = _parent_task_id
              AND manual_progress IS TRUE;

            SELECT (get_task_complete_ratio(_parent_task_id)->>'ratio')::FLOAT INTO _ratio;

            UPDATE tasks
            SET progress_value = _ratio
            WHERE id = _parent_task_id
              AND progress_value IS DISTINCT FROM _ratio;

            WITH RECURSIVE task_hierarchy AS (
                SELECT id, parent_task_id
                FROM tasks
                WHERE id = _parent_task_id

                UNION ALL

                SELECT t.id, t.parent_task_id
                FROM tasks t
                JOIN task_hierarchy th ON t.id = th.parent_task_id
                WHERE t.id IS NOT NULL
            )
            UPDATE tasks
            SET
                manual_progress = FALSE,
                progress_value = (
                    SELECT (get_task_complete_ratio(task_hierarchy.id)->>'ratio')::FLOAT
                )
            FROM task_hierarchy
            WHERE tasks.id = task_hierarchy.id
              AND task_hierarchy.parent_task_id IS NOT NULL
              AND (
                  tasks.manual_progress = TRUE
                  OR tasks.progress_value IS DISTINCT FROM (
                      SELECT (get_task_complete_ratio(task_hierarchy.id)->>'ratio')::FLOAT
                  )
              );
        END IF;

        IF NEW.progress_value = 100 OR NEW.weight = 100 OR NEW.total_minutes > 0 THEN
            SELECT project_id FROM tasks WHERE id = NEW.id INTO _project_id;

            SELECT (get_task_complete_ratio(NEW.id)->>'ratio')::FLOAT INTO _ratio;

            IF _ratio >= 100 THEN
                RAISE NOTICE 'Task % progress is at 100%%, may need status update', NEW.id;
            END IF;
        END IF;

        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS update_parent_task_progress_trigger ON tasks;
    CREATE TRIGGER update_parent_task_progress_trigger
    AFTER UPDATE OF status_id, weight, total_minutes, parent_task_id ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_parent_task_progress();

    DROP TRIGGER IF EXISTS update_parent_task_progress_on_insert_trigger ON tasks;
    CREATE TRIGGER update_parent_task_progress_on_insert_trigger
    AFTER INSERT ON tasks
    FOR EACH ROW
    WHEN (NEW.parent_task_id IS NOT NULL)
    EXECUTE FUNCTION update_parent_task_progress();

    CREATE OR REPLACE FUNCTION recalculate_all_task_progress() RETURNS void AS
    $$
    BEGIN
        UPDATE tasks AS t
        SET manual_progress = FALSE
        WHERE EXISTS (
            SELECT 1
            FROM tasks
            WHERE parent_task_id = t.id
              AND archived IS FALSE
        );

        WITH RECURSIVE task_hierarchy AS (
            SELECT
                id,
                parent_task_id,
                0 AS level
            FROM tasks
            WHERE NOT EXISTS (
                SELECT 1
                FROM tasks AS sub
                WHERE sub.parent_task_id = tasks.id
                  AND sub.archived IS FALSE
            )
            AND archived IS FALSE

            UNION ALL

            SELECT
                t.id,
                t.parent_task_id,
                th.level + 1
            FROM tasks t
            JOIN task_hierarchy th ON t.id = th.parent_task_id
            WHERE t.archived IS FALSE
        )
        UPDATE tasks
        SET progress_value = (SELECT (get_task_complete_ratio(tasks.id)->>'ratio')::FLOAT)
        FROM (
            SELECT id, level
            FROM task_hierarchy
            ORDER BY level
        ) AS ordered_tasks
        WHERE tasks.id = ordered_tasks.id
          AND (manual_progress IS FALSE OR manual_progress IS NULL);
    END;
    $$ LANGUAGE plpgsql;

    -- Ensure task progress matches the backend denominator semantics for parent-inclusive totals.
    SELECT recalculate_all_task_progress();
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (_pgm) => {
  // This migration re-applies the function/trigger behavior for existing databases.
  // It intentionally does not try to reverse the runtime state of deployed systems.
};

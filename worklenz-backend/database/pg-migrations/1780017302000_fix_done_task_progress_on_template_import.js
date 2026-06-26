'use strict';

/** @type {import('node-pg-migrate').ColumnDefinitions | undefined} */
exports.shorthands = undefined;

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.up = async (pgm) => {
  pgm.sql(`
    -- Fix: When a child task's progress changes, the parent task's progress should only
    -- be recalculated if the parent is NOT in a "done" status category.
    -- A parent in "done" status should always show 100% regardless of subtask states.
    -- This prevents the bulk-update race condition during template import where a done
    -- parent's progress_value = 100 gets overridden by a trigger fired from a child update.
    CREATE OR REPLACE FUNCTION update_parent_task_progress() RETURNS TRIGGER AS
    $$
    DECLARE
        _parent_task_id UUID;
        _ratio FLOAT;
        _parent_is_done BOOLEAN;
    BEGIN
        IF NEW.parent_task_id IS NOT NULL THEN
            _parent_task_id := NEW.parent_task_id;

            -- Check whether the parent task is itself in a "done" status category
            SELECT COALESCE(stsc.is_done, FALSE)
            INTO _parent_is_done
            FROM tasks t
            LEFT JOIN task_statuses ts ON ts.id = t.status_id
            LEFT JOIN sys_task_status_categories stsc ON stsc.id = ts.category_id
            WHERE t.id = _parent_task_id;

            IF _parent_is_done IS TRUE THEN
                -- Parent is in done status — keep it at 100% no matter what
                UPDATE tasks
                SET progress_value = 100, manual_progress = TRUE
                WHERE id = _parent_task_id;
            ELSE
                -- Parent is not done — recalculate from children
                UPDATE tasks
                SET manual_progress = FALSE
                WHERE id = _parent_task_id;

                SELECT (get_task_complete_ratio(_parent_task_id)->>'ratio')::FLOAT INTO _ratio;

                UPDATE tasks
                SET progress_value = _ratio
                WHERE id = _parent_task_id;
            END IF;

            -- Propagate the same logic up to all ancestors via recursive CTE
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
                manual_progress = CASE
                    WHEN EXISTS (
                        SELECT 1
                        FROM tasks t2
                        LEFT JOIN task_statuses ts ON ts.id = t2.status_id
                        LEFT JOIN sys_task_status_categories stsc ON stsc.id = ts.category_id
                        WHERE t2.id = task_hierarchy.id AND COALESCE(stsc.is_done, FALSE) IS TRUE
                    ) THEN TRUE
                    ELSE FALSE
                END,
                progress_value = CASE
                    WHEN EXISTS (
                        SELECT 1
                        FROM tasks t2
                        LEFT JOIN task_statuses ts ON ts.id = t2.status_id
                        LEFT JOIN sys_task_status_categories stsc ON stsc.id = ts.category_id
                        WHERE t2.id = task_hierarchy.id AND COALESCE(stsc.is_done, FALSE) IS TRUE
                    ) THEN 100
                    ELSE (SELECT (get_task_complete_ratio(task_hierarchy.id)->>'ratio')::FLOAT)
                END
            FROM task_hierarchy
            WHERE tasks.id = task_hierarchy.id
              AND task_hierarchy.parent_task_id IS NOT NULL;
        END IF;

        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Re-attach the trigger (function body updated above; trigger already exists)
    DROP TRIGGER IF EXISTS update_parent_task_progress_trigger ON tasks;
    CREATE TRIGGER update_parent_task_progress_trigger
    AFTER UPDATE OF progress_value, weight, total_minutes, parent_task_id, manual_progress ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_parent_task_progress();

    DROP TRIGGER IF EXISTS update_parent_task_progress_on_insert_trigger ON tasks;
    CREATE TRIGGER update_parent_task_progress_on_insert_trigger
    AFTER INSERT ON tasks
    FOR EACH ROW
    WHEN (NEW.parent_task_id IS NOT NULL)
    EXECUTE FUNCTION update_parent_task_progress();
  `);
};

/** @param {import('node-pg-migrate').MigrationBuilder} pgm */
exports.down = async (pgm) => {
  pgm.sql(`
    -- Revert to the previous trigger behaviour (recalculate parent regardless of done status)
    CREATE OR REPLACE FUNCTION update_parent_task_progress() RETURNS TRIGGER AS
    $$
    DECLARE
        _parent_task_id UUID;
        _ratio FLOAT;
    BEGIN
        IF NEW.parent_task_id IS NOT NULL THEN
            _parent_task_id := NEW.parent_task_id;

            UPDATE tasks SET manual_progress = FALSE WHERE id = _parent_task_id;

            SELECT (get_task_complete_ratio(_parent_task_id)->>'ratio')::FLOAT INTO _ratio;

            UPDATE tasks SET progress_value = _ratio WHERE id = _parent_task_id;

            WITH RECURSIVE task_hierarchy AS (
                SELECT id, parent_task_id FROM tasks WHERE id = _parent_task_id
                UNION ALL
                SELECT t.id, t.parent_task_id FROM tasks t
                JOIN task_hierarchy th ON t.id = th.parent_task_id
                WHERE t.id IS NOT NULL
            )
            UPDATE tasks
            SET
                manual_progress = FALSE,
                progress_value = (SELECT (get_task_complete_ratio(task_hierarchy.id)->>'ratio')::FLOAT)
            FROM task_hierarchy
            WHERE tasks.id = task_hierarchy.id
              AND task_hierarchy.parent_task_id IS NOT NULL;
        END IF;

        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS update_parent_task_progress_trigger ON tasks;
    CREATE TRIGGER update_parent_task_progress_trigger
    AFTER UPDATE OF progress_value, weight, total_minutes, parent_task_id, manual_progress ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_parent_task_progress();

    DROP TRIGGER IF EXISTS update_parent_task_progress_on_insert_trigger ON tasks;
    CREATE TRIGGER update_parent_task_progress_on_insert_trigger
    AFTER INSERT ON tasks
    FOR EACH ROW
    WHEN (NEW.parent_task_id IS NOT NULL)
    EXECUTE FUNCTION update_parent_task_progress();
  `);
};

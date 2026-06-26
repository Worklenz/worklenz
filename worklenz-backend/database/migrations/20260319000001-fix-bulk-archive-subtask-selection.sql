-- Migration: Fix bulk_archive_tasks to support direct subtask selection
-- Date: 2026-03-19
-- Description:
--  - Archives/unarchives selected task IDs directly (including subtasks)
--  - Preserves cascade to descendants when a selected ID is a parent task
--  - Uses set-based updates to avoid duplicate row updates

CREATE OR REPLACE FUNCTION bulk_archive_tasks(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _archive_value BOOLEAN = ((_body ->> 'type')::TEXT = 'archive');
    _output        JSON;
BEGIN
    WITH selected_ids AS (SELECT DISTINCT (elem.value ->> 'id')::UUID AS id
                          FROM JSON_ARRAY_ELEMENTS((_body ->> 'tasks')::JSON) AS elem(value)),
         parent_ids AS (SELECT id FROM tasks WHERE id IN (SELECT id FROM selected_ids) AND parent_task_id IS NULL),
         selected_and_descendants AS (SELECT id
                                      FROM selected_ids
                                      UNION
                                      SELECT t.id
                                      FROM tasks t
                                      WHERE t.parent_task_id IN (SELECT id FROM parent_ids))
    UPDATE tasks
    SET archived = _archive_value
    WHERE id IN (SELECT id FROM selected_and_descendants);

    RETURN _output;
END;
$$;

-- Migration: Make bulk_archive_tasks recursive for nested subtasks
-- Date: 2026-03-20
-- Description:
--  - Archives/unarchives selected IDs directly (including subtasks)
--  - Cascades archive/unarchive to all descendants at any nesting depth

CREATE OR REPLACE FUNCTION bulk_archive_tasks(_body json) RETURNS json
    LANGUAGE plpgsql
AS
$$
DECLARE
    _archive_value BOOLEAN = ((_body ->> 'type')::TEXT = 'archive');
    _output        JSON;
BEGIN
    WITH RECURSIVE selected_ids AS (
        SELECT DISTINCT (elem.value ->> 'id')::UUID AS id
        FROM JSON_ARRAY_ELEMENTS((_body ->> 'tasks')::JSON) AS elem(value)
    ),
    selected_and_descendants AS (
        -- Base set: explicitly selected tasks (supports direct subtask selection)
        SELECT id
        FROM selected_ids
        UNION
        -- Recursive set: include all descendants at any nesting level
        SELECT t.id
        FROM tasks t
                 INNER JOIN selected_and_descendants sd ON t.parent_task_id = sd.id
    )
    UPDATE tasks
    SET archived = _archive_value
    WHERE id IN (SELECT id FROM selected_and_descendants);

    RETURN _output;
END;
$$;

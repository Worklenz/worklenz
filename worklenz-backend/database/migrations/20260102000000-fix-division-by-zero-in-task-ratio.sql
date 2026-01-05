-- Fix division by zero error in get_task_complete_ratio function
-- This occurs when a task has no subtasks (_total_tasks = 0)

BEGIN;

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
    SELECT (CASE
                WHEN EXISTS(SELECT 1
                            FROM tasks_with_status_view
                            WHERE tasks_with_status_view.task_id = _task_id
                              AND is_done IS TRUE) THEN 1
                ELSE 0 END)
    INTO _parent_task_done;
    SELECT COUNT(*) FROM tasks WHERE parent_task_id = _task_id AND archived IS FALSE INTO _sub_tasks_count;

    SELECT COUNT(*)
    FROM tasks_with_status_view
    WHERE parent_task_id = _task_id
      AND is_done IS TRUE
    INTO _sub_tasks_done;

    _total_completed = _parent_task_done + _sub_tasks_done;
    _total_tasks = _sub_tasks_count;
    
    -- Fix: Handle division by zero when there are no subtasks
    IF _total_tasks > 0 THEN
        _ratio = (_total_completed / _total_tasks) * 100;
    ELSE
        -- If no subtasks, use parent task completion status
        _ratio = _parent_task_done * 100;
    END IF;

    RETURN JSON_BUILD_OBJECT(
        'ratio', _ratio,
        'total_completed', _total_completed,
        'total_tasks', _total_tasks
        );
END
$$;

COMMIT;

-- Migration: Add manual task progress
-- Date: 2025-04-22
-- Version: 1.0.0

BEGIN;

-- Add manual progress fields to tasks table
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS manual_progress BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS progress_value INTEGER DEFAULT NULL;

-- Update function to consider manual progress
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
    _is_manual        BOOLEAN = FALSE;
    _manual_value     INTEGER = NULL;
BEGIN
    -- Check if manual progress is set
    SELECT manual_progress, progress_value 
    FROM tasks 
    WHERE id = _task_id
    INTO _is_manual, _manual_value;
    
    -- If manual progress is enabled and has a value, use it directly
    IF _is_manual IS TRUE AND _manual_value IS NOT NULL THEN
        RETURN JSON_BUILD_OBJECT(
            'ratio', _manual_value,
            'total_completed', 0,
            'total_tasks', 0,
            'is_manual', TRUE
        );
    END IF;
    
    -- Otherwise calculate automatically as before
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
    _total_tasks = _sub_tasks_count; -- +1 for the parent task
    
    IF _total_tasks > 0 THEN
        _ratio = (_total_completed / _total_tasks) * 100;
    ELSE
        _ratio = _parent_task_done * 100;
    END IF;

    RETURN JSON_BUILD_OBJECT(
        'ratio', _ratio,
        'total_completed', _total_completed,
        'total_tasks', _total_tasks,
        'is_manual', FALSE
    );
END
$$;

COMMIT; 
-- Migration: Update time-based progress mode to work for all tasks
-- Date: 2025-04-25
-- Version: 1.0.0

BEGIN;

-- Update function to use time-based progress for all tasks
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
    _project_id       UUID;
    _use_manual_progress BOOLEAN = FALSE;
    _use_weighted_progress BOOLEAN = FALSE;
    _use_time_progress BOOLEAN = FALSE;
    _task_complete    BOOLEAN = FALSE;
BEGIN
    -- Check if manual progress is set for this task
    SELECT manual_progress, progress_value, project_id,
           EXISTS(
               SELECT 1
               FROM tasks_with_status_view
               WHERE tasks_with_status_view.task_id = tasks.id
               AND is_done IS TRUE
           ) AS is_complete
    FROM tasks 
    WHERE id = _task_id
    INTO _is_manual, _manual_value, _project_id, _task_complete;
    
    -- Check if the project uses manual progress
    IF _project_id IS NOT NULL THEN
        SELECT COALESCE(use_manual_progress, FALSE),
               COALESCE(use_weighted_progress, FALSE),
               COALESCE(use_time_progress, FALSE)
        FROM projects
        WHERE id = _project_id
        INTO _use_manual_progress, _use_weighted_progress, _use_time_progress;
    END IF;
    
    -- Get all subtasks
    SELECT COUNT(*) 
    FROM tasks 
    WHERE parent_task_id = _task_id AND archived IS FALSE 
    INTO _sub_tasks_count;
    
    -- If task is complete, always return 100%
    IF _task_complete IS TRUE THEN
        RETURN JSON_BUILD_OBJECT(
            'ratio', 100,
            'total_completed', 1,
            'total_tasks', 1,
            'is_manual', FALSE
        );
    END IF;
    
    -- Use manual progress value in two cases:
    -- 1. When task has manual_progress = TRUE and progress_value is set
    -- 2. When project has use_manual_progress = TRUE and progress_value is set
    IF (_is_manual IS TRUE AND _manual_value IS NOT NULL) OR 
       (_use_manual_progress IS TRUE AND _manual_value IS NOT NULL) THEN
        RETURN JSON_BUILD_OBJECT(
            'ratio', _manual_value,
            'total_completed', 0,
            'total_tasks', 0,
            'is_manual', TRUE
        );
    END IF;
    
    -- If there are no subtasks, just use the parent task's status (unless in time-based mode)
    IF _sub_tasks_count = 0 THEN
        -- Use time-based estimation for tasks without subtasks if enabled
        IF _use_time_progress IS TRUE THEN
            -- For time-based tasks without subtasks, we still need some progress calculation
            -- If the task is completed, return 100%
            -- Otherwise, use the progress value if set manually, or 0
            SELECT 
                CASE 
                    WHEN _task_complete IS TRUE THEN 100
                    ELSE COALESCE(_manual_value, 0)
                END
            INTO _ratio;
        ELSE
            -- Traditional calculation for non-time-based tasks
            SELECT (CASE WHEN _task_complete IS TRUE THEN 1 ELSE 0 END)
            INTO _parent_task_done;
            
            _ratio = _parent_task_done * 100;
        END IF;
    ELSE
        -- If project uses manual progress, calculate based on subtask manual progress values
        IF _use_manual_progress IS TRUE THEN
            WITH subtask_progress AS (
                SELECT 
                    t.id,
                    t.manual_progress,
                    t.progress_value,
                    EXISTS(
                        SELECT 1
                        FROM tasks_with_status_view
                        WHERE tasks_with_status_view.task_id = t.id
                        AND is_done IS TRUE
                    ) AS is_complete
                FROM tasks t
                WHERE t.parent_task_id = _task_id
                AND t.archived IS FALSE
            ),
            subtask_with_values AS (
                SELECT 
                    CASE 
                        -- For completed tasks, always use 100%
                        WHEN is_complete IS TRUE THEN 100
                        -- For tasks with progress value set, use it regardless of manual_progress flag
                        WHEN progress_value IS NOT NULL THEN progress_value
                        -- Default to 0 for incomplete tasks with no progress value
                        ELSE 0
                    END AS progress_value
                FROM subtask_progress
            )
            SELECT COALESCE(AVG(progress_value), 0)
            FROM subtask_with_values
            INTO _ratio;
        -- If project uses weighted progress, calculate based on subtask weights
        ELSIF _use_weighted_progress IS TRUE THEN
            WITH subtask_progress AS (
                SELECT 
                    t.id,
                    t.manual_progress,
                    t.progress_value,
                    EXISTS(
                        SELECT 1
                        FROM tasks_with_status_view
                        WHERE tasks_with_status_view.task_id = t.id
                        AND is_done IS TRUE
                    ) AS is_complete,
                    COALESCE(t.weight, 100) AS weight
                FROM tasks t
                WHERE t.parent_task_id = _task_id
                AND t.archived IS FALSE
            ),
            subtask_with_values AS (
                SELECT 
                    CASE 
                        -- For completed tasks, always use 100%
                        WHEN is_complete IS TRUE THEN 100
                        -- For tasks with progress value set, use it regardless of manual_progress flag
                        WHEN progress_value IS NOT NULL THEN progress_value
                        -- Default to 0 for incomplete tasks with no progress value
                        ELSE 0
                    END AS progress_value,
                    weight
                FROM subtask_progress
            )
            SELECT COALESCE(
                SUM(progress_value * weight) / NULLIF(SUM(weight), 0),
                0
            )
            FROM subtask_with_values
            INTO _ratio;
        -- If project uses time-based progress, calculate based on estimated time
        ELSIF _use_time_progress IS TRUE THEN
            WITH subtask_progress AS (
                SELECT 
                    t.id,
                    t.manual_progress,
                    t.progress_value,
                    EXISTS(
                        SELECT 1
                        FROM tasks_with_status_view
                        WHERE tasks_with_status_view.task_id = t.id
                        AND is_done IS TRUE
                    ) AS is_complete,
                    COALESCE(t.total_minutes, 0) AS estimated_minutes
                FROM tasks t
                WHERE t.parent_task_id = _task_id
                AND t.archived IS FALSE
            ),
            subtask_with_values AS (
                SELECT 
                    CASE 
                        -- For completed tasks, always use 100%
                        WHEN is_complete IS TRUE THEN 100
                        -- For tasks with progress value set, use it regardless of manual_progress flag
                        WHEN progress_value IS NOT NULL THEN progress_value
                        -- Default to 0 for incomplete tasks with no progress value
                        ELSE 0
                    END AS progress_value,
                    estimated_minutes
                FROM subtask_progress
            )
            SELECT COALESCE(
                SUM(progress_value * estimated_minutes) / NULLIF(SUM(estimated_minutes), 0),
                0
            )
            FROM subtask_with_values
            INTO _ratio;
        ELSE
            -- Traditional calculation based on completion status
            SELECT (CASE WHEN _task_complete IS TRUE THEN 1 ELSE 0 END)
            INTO _parent_task_done;
            
            SELECT COUNT(*)
            FROM tasks_with_status_view
            WHERE parent_task_id = _task_id
              AND is_done IS TRUE
            INTO _sub_tasks_done;
            
            _total_completed = _parent_task_done + _sub_tasks_done;
            _total_tasks = _sub_tasks_count + 1; -- +1 for the parent task
            
            IF _total_tasks = 0 THEN
                _ratio = 0;
            ELSE
                _ratio = (_total_completed / _total_tasks) * 100;
            END IF;
        END IF;
    END IF;
    
    -- Ensure ratio is between 0 and 100
    IF _ratio < 0 THEN
        _ratio = 0;
    ELSIF _ratio > 100 THEN
        _ratio = 100;
    END IF;

    RETURN JSON_BUILD_OBJECT(
        'ratio', _ratio,
        'total_completed', _total_completed,
        'total_tasks', _total_tasks,
        'is_manual', _is_manual
    );
END
$$;

COMMIT; 
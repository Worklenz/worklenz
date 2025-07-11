-- Migration: Improve parent task progress calculation using weights and time estimation
-- Date: 2025-04-26
-- Version: 1.0.0

BEGIN;

-- Update function to better calculate parent task progress based on subtask weights or time estimations
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
BEGIN
    -- Check if manual progress is set for this task
    SELECT manual_progress, progress_value, project_id
    FROM tasks 
    WHERE id = _task_id
    INTO _is_manual, _manual_value, _project_id;
    
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
    
    -- Only respect manual progress for tasks without subtasks
    IF _is_manual IS TRUE AND _manual_value IS NOT NULL AND _sub_tasks_count = 0 THEN
        RETURN JSON_BUILD_OBJECT(
            'ratio', _manual_value,
            'total_completed', 0,
            'total_tasks', 0,
            'is_manual', TRUE
        );
    END IF;
    
    -- If there are no subtasks, just use the parent task's status
    IF _sub_tasks_count = 0 THEN
        -- For tasks without subtasks in time-based mode
        IF _use_time_progress IS TRUE THEN
            SELECT 
                CASE 
                    WHEN EXISTS(
                        SELECT 1
                        FROM tasks_with_status_view
                        WHERE tasks_with_status_view.task_id = _task_id
                        AND is_done IS TRUE
                    ) THEN 100
                    ELSE COALESCE(_manual_value, 0)
                END
            INTO _ratio;
        ELSE
            -- Traditional calculation for non-time-based tasks
            SELECT (CASE
                        WHEN EXISTS(SELECT 1
                                    FROM tasks_with_status_view
                                    WHERE tasks_with_status_view.task_id = _task_id
                                      AND is_done IS TRUE) THEN 1
                        ELSE 0 END)
            INTO _parent_task_done;
            
            _ratio = _parent_task_done * 100;
        END IF;
    ELSE
        -- For parent tasks with subtasks, always use the appropriate calculation based on project mode
        -- If project uses manual progress, calculate based on subtask manual progress values
        IF _use_manual_progress IS TRUE THEN
            WITH subtask_progress AS (
                SELECT 
                    CASE 
                        -- If subtask has manual progress, use that value
                        WHEN manual_progress IS TRUE AND progress_value IS NOT NULL THEN 
                            progress_value
                        -- Otherwise use completion status (0 or 100)
                        ELSE
                            CASE 
                                WHEN EXISTS(
                                    SELECT 1
                                    FROM tasks_with_status_view
                                    WHERE tasks_with_status_view.task_id = t.id
                                    AND is_done IS TRUE
                                ) THEN 100
                                ELSE 0
                            END
                    END AS progress_value
                FROM tasks t
                WHERE t.parent_task_id = _task_id
                AND t.archived IS FALSE
            )
            SELECT COALESCE(AVG(progress_value), 0)
            FROM subtask_progress
            INTO _ratio;
        -- If project uses weighted progress, calculate based on subtask weights
        ELSIF _use_weighted_progress IS TRUE THEN
            WITH subtask_progress AS (
                SELECT 
                    CASE 
                        -- If subtask has manual progress, use that value
                        WHEN manual_progress IS TRUE AND progress_value IS NOT NULL THEN 
                            progress_value
                        -- Otherwise use completion status (0 or 100)
                        ELSE
                            CASE 
                                WHEN EXISTS(
                                    SELECT 1
                                    FROM tasks_with_status_view
                                    WHERE tasks_with_status_view.task_id = t.id
                                    AND is_done IS TRUE
                                ) THEN 100
                                ELSE 0
                            END
                    END AS progress_value,
                    COALESCE(weight, 100) AS weight -- Default weight is 100 if not specified
                FROM tasks t
                WHERE t.parent_task_id = _task_id
                AND t.archived IS FALSE
            )
            SELECT COALESCE(
                SUM(progress_value * weight) / NULLIF(SUM(weight), 0),
                0
            )
            FROM subtask_progress
            INTO _ratio;
        -- If project uses time-based progress, calculate based on estimated time (total_minutes)
        ELSIF _use_time_progress IS TRUE THEN
            WITH subtask_progress AS (
                SELECT 
                    CASE 
                        -- If subtask has manual progress, use that value
                        WHEN manual_progress IS TRUE AND progress_value IS NOT NULL THEN 
                            progress_value
                        -- Otherwise use completion status (0 or 100)
                        ELSE
                            CASE 
                                WHEN EXISTS(
                                    SELECT 1
                                    FROM tasks_with_status_view
                                    WHERE tasks_with_status_view.task_id = t.id
                                    AND is_done IS TRUE
                                ) THEN 100
                                ELSE 0
                            END
                    END AS progress_value,
                    COALESCE(total_minutes, 0) AS estimated_minutes -- Use time estimation for weighting
                FROM tasks t
                WHERE t.parent_task_id = _task_id
                AND t.archived IS FALSE
            )
            SELECT COALESCE(
                SUM(progress_value * estimated_minutes) / NULLIF(SUM(estimated_minutes), 0),
                0
            )
            FROM subtask_progress
            INTO _ratio;
        ELSE
            -- Traditional calculation based on completion status when no special mode is enabled
            SELECT (CASE
                        WHEN EXISTS(SELECT 1
                                    FROM tasks_with_status_view
                                    WHERE tasks_with_status_view.task_id = _task_id
                                      AND is_done IS TRUE) THEN 1
                        ELSE 0 END)
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

-- Make sure we recalculate parent task progress when subtask progress changes
CREATE OR REPLACE FUNCTION update_parent_task_progress() RETURNS TRIGGER AS
$$
DECLARE
    _parent_task_id UUID;
    _project_id UUID;
    _ratio FLOAT;
BEGIN
    -- Check if this is a subtask
    IF NEW.parent_task_id IS NOT NULL THEN
        _parent_task_id := NEW.parent_task_id;
        
        -- Force any parent task with subtasks to NOT use manual progress
        UPDATE tasks
        SET manual_progress = FALSE
        WHERE id = _parent_task_id;
    END IF;
    
    -- If this task has progress value of 100 and doesn't have subtasks, we might want to prompt the user
    -- to mark it as done. We'll annotate this in a way that the socket handler can detect.
    IF NEW.progress_value = 100 OR NEW.weight = 100 OR NEW.total_minutes > 0 THEN
        -- Check if task has status in "done" category
        SELECT project_id FROM tasks WHERE id = NEW.id INTO _project_id;
        
        -- Get the progress ratio for this task
        SELECT get_task_complete_ratio(NEW.id)->>'ratio' INTO _ratio;
        
        IF _ratio::FLOAT >= 100 THEN
            -- Log that this task is at 100% progress
            RAISE NOTICE 'Task % progress is at 100%%, may need status update', NEW.id;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updates to task progress
DROP TRIGGER IF EXISTS update_parent_task_progress_trigger ON tasks;
CREATE TRIGGER update_parent_task_progress_trigger
AFTER UPDATE OF progress_value, weight, total_minutes ON tasks
FOR EACH ROW
EXECUTE FUNCTION update_parent_task_progress();

-- Create a function to ensure parent tasks never have manual progress when they have subtasks
CREATE OR REPLACE FUNCTION ensure_parent_task_without_manual_progress() RETURNS TRIGGER AS
$$
BEGIN
    -- If this is a new subtask being created or a task is being converted to a subtask
    IF NEW.parent_task_id IS NOT NULL THEN
        -- Force the parent task to NOT use manual progress
        UPDATE tasks
        SET manual_progress = FALSE
        WHERE id = NEW.parent_task_id;
        
        -- Log that we've reset manual progress for a parent task
        RAISE NOTICE 'Reset manual progress for parent task % because it has subtasks', NEW.parent_task_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for when tasks are created or updated with a parent_task_id
DROP TRIGGER IF EXISTS ensure_parent_task_without_manual_progress_trigger ON tasks;
CREATE TRIGGER ensure_parent_task_without_manual_progress_trigger
AFTER INSERT OR UPDATE OF parent_task_id ON tasks
FOR EACH ROW
EXECUTE FUNCTION ensure_parent_task_without_manual_progress();

COMMIT; 
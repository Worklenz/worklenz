-- Migration: Fix multilevel subtask progress calculation for weighted and manual progress
-- Date: 2025-05-06
-- Version: 1.0.0

BEGIN;

-- Update the trigger function to recursively recalculate parent task progress up the entire hierarchy
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
        WHERE id = _parent_task_id
        AND manual_progress = TRUE;  -- Only update if currently TRUE to avoid unnecessary triggers
        
        -- Calculate the parent's new progress value
        SELECT (get_task_complete_ratio(_parent_task_id)->>'ratio')::FLOAT INTO _ratio;
        
        -- Update the parent's progress value (this won't trigger the trigger since we removed progress_value from trigger conditions)
        UPDATE tasks
        SET progress_value = _ratio
        WHERE id = _parent_task_id
        AND progress_value IS DISTINCT FROM _ratio;  -- Only update if value actually changed
        
        -- Recursively propagate changes up the hierarchy by using a recursive CTE
        WITH RECURSIVE task_hierarchy AS (
            -- Base case: Start with the parent task
            SELECT 
                id,
                parent_task_id
            FROM tasks
            WHERE id = _parent_task_id
            
            UNION ALL
            
            -- Recursive case: Go up to each ancestor
            SELECT 
                t.id,
                t.parent_task_id
            FROM tasks t
            JOIN task_hierarchy th ON t.id = th.parent_task_id
            WHERE t.id IS NOT NULL
        )
        -- For each ancestor, recalculate its progress
        UPDATE tasks
        SET 
            manual_progress = FALSE,
            progress_value = (SELECT (get_task_complete_ratio(task_hierarchy.id)->>'ratio')::FLOAT)
        FROM task_hierarchy
        WHERE tasks.id = task_hierarchy.id
        AND task_hierarchy.parent_task_id IS NOT NULL
        AND (
            tasks.manual_progress = TRUE 
            OR tasks.progress_value IS DISTINCT FROM (SELECT (get_task_complete_ratio(task_hierarchy.id)->>'ratio')::FLOAT)
        );
        
        -- Log the recalculation for debugging
        RAISE NOTICE 'Updated progress for task % to %', _parent_task_id, _ratio;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Update the trigger to NOT trigger on progress_value changes to avoid infinite recursion
DROP TRIGGER IF EXISTS update_parent_task_progress_trigger ON tasks;
CREATE TRIGGER update_parent_task_progress_trigger
AFTER UPDATE OF status_id, weight, total_minutes, parent_task_id ON tasks
FOR EACH ROW
EXECUTE FUNCTION update_parent_task_progress();

-- Also add a trigger for when a new task is inserted
DROP TRIGGER IF EXISTS update_parent_task_progress_on_insert_trigger ON tasks;
CREATE TRIGGER update_parent_task_progress_on_insert_trigger
AFTER INSERT ON tasks
FOR EACH ROW
WHEN (NEW.parent_task_id IS NOT NULL)
EXECUTE FUNCTION update_parent_task_progress();

-- Add a comment to explain the fix
COMMENT ON FUNCTION update_parent_task_progress() IS 
'This function recursively updates progress values for all ancestors when a task''s progress changes.
The previous version only updated the immediate parent, which led to incorrect progress values for
higher-level parent tasks when using weighted or manual progress calculations with multi-level subtasks.';

-- Add a function to immediately recalculate all task progress values in the correct order
-- This will fix existing data where parent tasks don't have proper progress values
CREATE OR REPLACE FUNCTION recalculate_all_task_progress() RETURNS void AS
$$
BEGIN
    -- First, reset manual_progress flag for all tasks that have subtasks
    UPDATE tasks AS t
    SET manual_progress = FALSE
    WHERE EXISTS (
        SELECT 1
        FROM tasks
        WHERE parent_task_id = t.id
        AND archived IS FALSE
    );
    
    -- Start recalculation from leaf tasks (no subtasks) and propagate upward
    -- This ensures calculations are done in the right order
    WITH RECURSIVE task_hierarchy AS (
        -- Base case: Start with all leaf tasks (no subtasks)
        SELECT 
            id,
            parent_task_id,
            0 AS level
        FROM tasks
        WHERE NOT EXISTS (
            SELECT 1 FROM tasks AS sub
            WHERE sub.parent_task_id = tasks.id
            AND sub.archived IS FALSE
        )
        AND archived IS FALSE
        
        UNION ALL
        
        -- Recursive case: Move up to parent tasks, but only after processing all their children
        SELECT 
            t.id,
            t.parent_task_id,
            th.level + 1
        FROM tasks t
        JOIN task_hierarchy th ON t.id = th.parent_task_id
        WHERE t.archived IS FALSE
    )
    -- Sort by level to ensure we calculate in the right order (leaves first, then parents)
    -- This ensures we're using already updated progress values
    UPDATE tasks
    SET progress_value = (SELECT (get_task_complete_ratio(tasks.id)->>'ratio')::FLOAT)
    FROM (
        SELECT id, level
        FROM task_hierarchy
        ORDER BY level
    ) AS ordered_tasks
    WHERE tasks.id = ordered_tasks.id
    AND (manual_progress IS FALSE OR manual_progress IS NULL);
    
    -- Log the completion of the recalculation
    RAISE NOTICE 'Finished recalculating all task progress values';
END;
$$ LANGUAGE plpgsql;

-- Execute the function to fix existing data
SELECT recalculate_all_task_progress();

COMMIT;
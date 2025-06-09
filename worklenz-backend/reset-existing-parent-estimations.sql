-- Reset all existing parent task estimations to 0
-- This script updates all tasks that have subtasks to have 0 estimation

UPDATE tasks 
SET total_minutes = 0
WHERE id IN (
    SELECT DISTINCT parent_task_id 
    FROM tasks 
    WHERE parent_task_id IS NOT NULL 
    AND archived = false
)
AND total_minutes > 0
AND archived = false;

-- Show the results
SELECT 
    t.id,
    t.name,
    t.total_minutes as current_estimation,
    (SELECT COUNT(*) FROM tasks WHERE parent_task_id = t.id AND archived = false) as subtask_count
FROM tasks t
WHERE id IN (
    SELECT DISTINCT parent_task_id 
    FROM tasks 
    WHERE parent_task_id IS NOT NULL 
    AND archived = false
)
AND archived = false
ORDER BY t.name; 
-- Fix task hierarchy and reset parent estimations
-- This script ensures proper parent-child relationships and resets parent estimations

-- First, let's see the current task hierarchy
SELECT 
    t.id,
    t.name,
    t.parent_task_id,
    t.total_minutes,
    (SELECT name FROM tasks WHERE id = t.parent_task_id) as parent_name,
    (SELECT COUNT(*) FROM tasks WHERE parent_task_id = t.id AND archived = false) as actual_subtask_count,
    t.archived
FROM tasks t
WHERE (t.name LIKE '%sub%' OR t.name LIKE '%test task%')
ORDER BY t.name, t.created_at;

-- Reset all parent task estimations to 0
-- This ensures parent tasks don't have their own estimation when they have subtasks
UPDATE tasks 
SET total_minutes = 0
WHERE id IN (
    SELECT DISTINCT parent_task_id 
    FROM tasks 
    WHERE parent_task_id IS NOT NULL 
    AND archived = false
)
AND archived = false;

-- Verify the results after the update
SELECT 
    t.id,
    t.name,
    t.parent_task_id,
    t.total_minutes as current_estimation,
    (SELECT name FROM tasks WHERE id = t.parent_task_id) as parent_name,
    (SELECT COUNT(*) FROM tasks WHERE parent_task_id = t.id AND archived = false) as subtask_count,
    get_task_recursive_estimation(t.id) as recursive_estimation
FROM tasks t
WHERE (t.name LIKE '%sub%' OR t.name LIKE '%test task%')
AND t.archived = false
ORDER BY t.name;

-- Show the hierarchy in tree format
WITH RECURSIVE task_hierarchy AS (
    -- Top level tasks (no parent)
    SELECT 
        id,
        name,
        parent_task_id,
        total_minutes,
        0 as level,
        name as path
    FROM tasks
    WHERE parent_task_id IS NULL
    AND (name LIKE '%sub%' OR name LIKE '%test task%')
    AND archived = false
    
    UNION ALL
    
    -- Child tasks
    SELECT 
        t.id,
        t.name,
        t.parent_task_id,
        t.total_minutes,
        th.level + 1,
        th.path || ' > ' || t.name
    FROM tasks t
    INNER JOIN task_hierarchy th ON t.parent_task_id = th.id
    WHERE t.archived = false
)
SELECT 
    REPEAT('  ', level) || name as indented_name,
    total_minutes,
    get_task_recursive_estimation(id) as recursive_estimation
FROM task_hierarchy
ORDER BY path; 
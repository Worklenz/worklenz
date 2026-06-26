-- Migration: Fix duplicate sort_order values in task_statuses
-- Date: 2026-05-12
-- Issue: Custom template imports created statuses with sort_order = 0
-- This migration fixes all affected projects

-- Step 1: Identify affected projects
DO $$
DECLARE
    affected_count INTEGER;
BEGIN
    SELECT COUNT(DISTINCT project_id)
    INTO affected_count
    FROM task_statuses
    GROUP BY project_id
    HAVING COUNT(*) > COUNT(DISTINCT sort_order)
       OR (COUNT(DISTINCT sort_order) = 1 AND MIN(sort_order) = 0 AND COUNT(*) > 1);
    
    RAISE NOTICE 'Found % projects with duplicate sort_orders', affected_count;
END $$;

-- Step 2: Fix duplicate sort_orders
-- Strategy: Order by category (TODO → DOING → DONE), then by id for deterministic results
WITH projects_to_fix AS (
    -- Find all projects where sort_orders are duplicated or all zeros
    SELECT DISTINCT project_id
    FROM task_statuses
    GROUP BY project_id
    HAVING COUNT(*) > COUNT(DISTINCT sort_order)
       OR (COUNT(DISTINCT sort_order) = 1 AND MIN(sort_order) = 0 AND COUNT(*) > 1)
),
ordered_statuses AS (
    -- Assign new sort_order values based on logical ordering
    SELECT 
        ts.id,
        ts.project_id,
        ts.name,
        ts.sort_order as old_sort_order,
        ROW_NUMBER() OVER (
            PARTITION BY ts.project_id 
            ORDER BY 
                -- Primary: Order by category (TODO first, DOING second, DONE last)
                CASE 
                    WHEN stsc.is_todo = TRUE THEN 1
                    WHEN stsc.is_doing = TRUE THEN 2
                    WHEN stsc.is_done = TRUE THEN 3
                    ELSE 4
                END,
                -- Secondary: Order by ID for deterministic results
                ts.id
        ) - 1 as new_sort_order
    FROM task_statuses ts
    JOIN sys_task_status_categories stsc ON ts.category_id = stsc.id
    WHERE ts.project_id IN (SELECT project_id FROM projects_to_fix)
)
UPDATE task_statuses ts
SET sort_order = os.new_sort_order
FROM ordered_statuses os
WHERE ts.id = os.id
  AND ts.sort_order != os.new_sort_order;  -- Only update if changed

-- Step 3: Verify the fix
DO $$
DECLARE
    remaining_issues INTEGER;
BEGIN
    SELECT COUNT(DISTINCT project_id)
    INTO remaining_issues
    FROM task_statuses
    GROUP BY project_id
    HAVING COUNT(*) > COUNT(DISTINCT sort_order);
    
    IF remaining_issues > 0 THEN
        RAISE WARNING 'Still have % projects with duplicate sort_orders - manual intervention required', remaining_issues;
    ELSE
        RAISE NOTICE 'All projects fixed successfully! No duplicate sort_orders remaining.';
    END IF;
END $$;

-- Step 4: Show sample of fixed projects
SELECT 
    p.id as project_id,
    p.name as project_name,
    COUNT(ts.id) as total_statuses,
    COUNT(DISTINCT ts.sort_order) as unique_sort_orders,
    ARRAY_AGG(ts.sort_order ORDER BY ts.sort_order) as sort_orders,
    ARRAY_AGG(ts.name ORDER BY ts.sort_order) as status_names
FROM projects p
JOIN task_statuses ts ON p.id = ts.project_id
GROUP BY p.id, p.name
ORDER BY p.name
LIMIT 10;

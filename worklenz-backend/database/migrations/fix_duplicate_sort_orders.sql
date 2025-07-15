-- Fix Duplicate Sort Orders Script
-- This script detects and fixes duplicate sort order values that break task ordering

-- 1. DETECTION QUERIES - Run these first to see the scope of the problem

-- Check for duplicates in main sort_order column
SELECT 
    project_id,
    sort_order,
    COUNT(*) as duplicate_count,
    STRING_AGG(id::text, ', ') as task_ids
FROM tasks 
WHERE project_id IS NOT NULL
GROUP BY project_id, sort_order 
HAVING COUNT(*) > 1
ORDER BY project_id, sort_order;

-- Check for duplicates in status_sort_order
SELECT 
    project_id,
    status_sort_order,
    COUNT(*) as duplicate_count,
    STRING_AGG(id::text, ', ') as task_ids
FROM tasks 
WHERE project_id IS NOT NULL
GROUP BY project_id, status_sort_order 
HAVING COUNT(*) > 1
ORDER BY project_id, status_sort_order;

-- Check for duplicates in priority_sort_order
SELECT 
    project_id,
    priority_sort_order,
    COUNT(*) as duplicate_count,
    STRING_AGG(id::text, ', ') as task_ids
FROM tasks 
WHERE project_id IS NOT NULL
GROUP BY project_id, priority_sort_order 
HAVING COUNT(*) > 1
ORDER BY project_id, priority_sort_order;

-- Check for duplicates in phase_sort_order
SELECT 
    project_id,
    phase_sort_order,
    COUNT(*) as duplicate_count,
    STRING_AGG(id::text, ', ') as task_ids
FROM tasks 
WHERE project_id IS NOT NULL
GROUP BY project_id, phase_sort_order 
HAVING COUNT(*) > 1
ORDER BY project_id, phase_sort_order;

-- Note: member_sort_order removed - no longer used

-- 2. CLEANUP FUNCTIONS

-- Fix duplicates in main sort_order column
CREATE OR REPLACE FUNCTION fix_sort_order_duplicates() RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
    _project RECORD;
    _task RECORD;
    _counter INTEGER;
BEGIN
    -- For each project, reassign sort_order values to ensure uniqueness
    FOR _project IN 
        SELECT DISTINCT project_id 
        FROM tasks 
        WHERE project_id IS NOT NULL
    LOOP
        _counter := 0;
        
        -- Reassign sort_order values sequentially for this project
        FOR _task IN 
            SELECT id 
            FROM tasks 
            WHERE project_id = _project.project_id 
            ORDER BY sort_order, created_at
        LOOP
            UPDATE tasks 
            SET sort_order = _counter 
            WHERE id = _task.id;
            
            _counter := _counter + 1;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Fixed sort_order duplicates for all projects';
END
$$;

-- Fix duplicates in status_sort_order column
CREATE OR REPLACE FUNCTION fix_status_sort_order_duplicates() RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
    _project RECORD;
    _task RECORD;
    _counter INTEGER;
BEGIN
    FOR _project IN 
        SELECT DISTINCT project_id 
        FROM tasks 
        WHERE project_id IS NOT NULL
    LOOP
        _counter := 0;
        
        FOR _task IN 
            SELECT id 
            FROM tasks 
            WHERE project_id = _project.project_id 
            ORDER BY status_sort_order, created_at
        LOOP
            UPDATE tasks 
            SET status_sort_order = _counter 
            WHERE id = _task.id;
            
            _counter := _counter + 1;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Fixed status_sort_order duplicates for all projects';
END
$$;

-- Fix duplicates in priority_sort_order column
CREATE OR REPLACE FUNCTION fix_priority_sort_order_duplicates() RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
    _project RECORD;
    _task RECORD;
    _counter INTEGER;
BEGIN
    FOR _project IN 
        SELECT DISTINCT project_id 
        FROM tasks 
        WHERE project_id IS NOT NULL
    LOOP
        _counter := 0;
        
        FOR _task IN 
            SELECT id 
            FROM tasks 
            WHERE project_id = _project.project_id 
            ORDER BY priority_sort_order, created_at
        LOOP
            UPDATE tasks 
            SET priority_sort_order = _counter 
            WHERE id = _task.id;
            
            _counter := _counter + 1;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Fixed priority_sort_order duplicates for all projects';
END
$$;

-- Fix duplicates in phase_sort_order column
CREATE OR REPLACE FUNCTION fix_phase_sort_order_duplicates() RETURNS void
    LANGUAGE plpgsql
AS
$$
DECLARE
    _project RECORD;
    _task RECORD;
    _counter INTEGER;
BEGIN
    FOR _project IN 
        SELECT DISTINCT project_id 
        FROM tasks 
        WHERE project_id IS NOT NULL
    LOOP
        _counter := 0;
        
        FOR _task IN 
            SELECT id 
            FROM tasks 
            WHERE project_id = _project.project_id 
            ORDER BY phase_sort_order, created_at
        LOOP
            UPDATE tasks 
            SET phase_sort_order = _counter 
            WHERE id = _task.id;
            
            _counter := _counter + 1;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Fixed phase_sort_order duplicates for all projects';
END
$$;

-- Note: fix_member_sort_order_duplicates() removed - no longer needed

-- Master function to fix all sort order duplicates
CREATE OR REPLACE FUNCTION fix_all_duplicate_sort_orders() RETURNS void
    LANGUAGE plpgsql
AS
$$
BEGIN
    RAISE NOTICE 'Starting sort order cleanup for all columns...';
    
    PERFORM fix_sort_order_duplicates();
    PERFORM fix_status_sort_order_duplicates();
    PERFORM fix_priority_sort_order_duplicates();
    PERFORM fix_phase_sort_order_duplicates();
    
    RAISE NOTICE 'Completed sort order cleanup for all columns';
END
$$;

-- 3. VERIFICATION FUNCTION

-- Verify that duplicates have been fixed
CREATE OR REPLACE FUNCTION verify_sort_order_integrity() RETURNS TABLE(
    column_name text,
    project_id uuid,
    duplicate_count bigint,
    status text
)
    LANGUAGE plpgsql
AS
$$
BEGIN
    -- Check sort_order duplicates
    RETURN QUERY
    SELECT 
        'sort_order'::text as column_name,
        t.project_id,
        COUNT(*) as duplicate_count,
        CASE WHEN COUNT(*) > 1 THEN 'DUPLICATES FOUND' ELSE 'OK' END as status
    FROM tasks t
    WHERE t.project_id IS NOT NULL
    GROUP BY t.project_id, t.sort_order
    HAVING COUNT(*) > 1;
    
    -- Check status_sort_order duplicates
    RETURN QUERY
    SELECT 
        'status_sort_order'::text as column_name,
        t.project_id,
        COUNT(*) as duplicate_count,
        CASE WHEN COUNT(*) > 1 THEN 'DUPLICATES FOUND' ELSE 'OK' END as status
    FROM tasks t
    WHERE t.project_id IS NOT NULL
    GROUP BY t.project_id, t.status_sort_order
    HAVING COUNT(*) > 1;
    
    -- Check priority_sort_order duplicates
    RETURN QUERY
    SELECT 
        'priority_sort_order'::text as column_name,
        t.project_id,
        COUNT(*) as duplicate_count,
        CASE WHEN COUNT(*) > 1 THEN 'DUPLICATES FOUND' ELSE 'OK' END as status
    FROM tasks t
    WHERE t.project_id IS NOT NULL
    GROUP BY t.project_id, t.priority_sort_order
    HAVING COUNT(*) > 1;
    
    -- Check phase_sort_order duplicates
    RETURN QUERY
    SELECT 
        'phase_sort_order'::text as column_name,
        t.project_id,
        COUNT(*) as duplicate_count,
        CASE WHEN COUNT(*) > 1 THEN 'DUPLICATES FOUND' ELSE 'OK' END as status
    FROM tasks t
    WHERE t.project_id IS NOT NULL
    GROUP BY t.project_id, t.phase_sort_order
    HAVING COUNT(*) > 1;
    
    -- Note: member_sort_order verification removed - column no longer used
    
END
$$;

-- 4. USAGE INSTRUCTIONS

/*
USAGE:

1. First, run the detection queries to see which projects have duplicates
2. Then run this to fix all duplicates:
   SELECT fix_all_duplicate_sort_orders();
3. Finally, verify the fix worked:
   SELECT * FROM verify_sort_order_integrity();
   
If verification returns no rows, all duplicates have been fixed successfully.

WARNING: This will reassign sort order values based on current order + creation time.
Make sure to backup your database before running these functions.
*/
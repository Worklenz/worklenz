-- Test script to verify the sort order constraint fix

-- Test the helper function
SELECT get_sort_column_name('status');    -- Should return 'status_sort_order'
SELECT get_sort_column_name('priority');  -- Should return 'priority_sort_order'
SELECT get_sort_column_name('phase');     -- Should return 'phase_sort_order'
SELECT get_sort_column_name('members');   -- Should return 'member_sort_order'
SELECT get_sort_column_name('unknown');   -- Should return 'status_sort_order' (default)

-- Test bulk update function (example - would need real project_id and task_ids)
/*
SELECT update_task_sort_orders_bulk(
    '[
        {"task_id": "example-uuid", "sort_order": 1, "status_id": "status-uuid"},
        {"task_id": "example-uuid-2", "sort_order": 2, "status_id": "status-uuid"}
    ]'::json,
    'status'
);
*/

-- Verify that sort_order constraint still exists and works
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_name = 'tasks_sort_order_unique';

-- Check that new sort order columns don't have unique constraints (which is correct)
SELECT 
    tc.constraint_name,
    tc.table_name,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE kcu.table_name = 'tasks'
  AND kcu.column_name IN ('status_sort_order', 'priority_sort_order', 'phase_sort_order', 'member_sort_order')
  AND tc.constraint_type = 'UNIQUE';
-- Test script to validate the separate sort order implementation

-- Check if new columns exist
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'tasks' 
  AND column_name IN ('status_sort_order', 'priority_sort_order', 'phase_sort_order', 'member_sort_order')
ORDER BY column_name;

-- Check if helper function exists
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_name IN ('get_sort_column_name', 'update_task_sort_orders_bulk', 'handle_task_list_sort_order_change');

-- Sample test data to verify different sort orders work
-- (This would be run after the migrations)
/*
-- Test: Tasks should have different orders for different groupings
SELECT 
  id, 
  name, 
  sort_order, 
  status_sort_order, 
  priority_sort_order, 
  phase_sort_order, 
  member_sort_order
FROM tasks 
WHERE project_id = '<test-project-id>'
ORDER BY status_sort_order;
*/
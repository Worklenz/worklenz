# Deployment Guide: Separate Sort Orders Feature

## Issue Resolution
The unique constraint error `"duplicate key value violates unique constraint tasks_sort_order_unique"` has been fixed by ensuring that:

1. The new grouping-specific sort columns don't have unique constraints
2. We only update the main `sort_order` column when explicitly needed
3. Database functions properly handle the different sort columns

## Required Migrations (Run in Order)

### 1. Schema Changes
```bash
psql -d worklenz -f database/migrations/20250715000000-add-grouping-sort-orders.sql
```

### 2. Function Updates  
```bash
psql -d worklenz -f database/migrations/20250715000001-update-sort-functions.sql
```

### 3. Constraint Fixes
```bash
psql -d worklenz -f database/migrations/20250715000002-fix-sort-constraint.sql
```

## Verification Steps

### 1. Test Database Functions
```bash
psql -d worklenz -f test_sort_fix.sql
```

### 2. Verify Schema
```sql
-- Check new columns exist
\d tasks

-- Verify helper function works
SELECT get_sort_column_name('status');
```

### 3. Test Sort Operations
```sql
-- Test bulk update (replace with real UUIDs)
SELECT update_task_sort_orders_bulk(
    '[{"task_id": "real-uuid", "sort_order": 1}]'::json,
    'status'
);
```

## Key Changes Made

### Database Layer
- **New Columns:** Added `status_sort_order`, `priority_sort_order`, `phase_sort_order`, `member_sort_order`
- **No Unique Constraints:** New columns allow duplicate values (by design)
- **Fixed Functions:** Updated to avoid touching `sort_order` column unnecessarily
- **Data Migration:** Existing tasks get their current `sort_order` copied to all new columns

### Backend Layer
- **Socket Handler:** Updated to use correct sort column based on `group_by`
- **Function Calls:** Pass grouping parameter to database functions
- **Error Handling:** Avoid constraint violations by working with right columns

### Frontend Layer
- **Type Safety:** Added new sort order fields to Task interface
- **Helper Function:** `getSortOrderField()` for consistent field selection
- **Redux Updates:** Use appropriate sort field in state management
- **Drag & Drop:** Updated to work with grouping-specific sort orders

## Behavior Changes

### Before Fix
- All groupings shared same `sort_order` column
- Constraint violations when multiple tasks had same sort value
- Lost organization when switching between grouping views

### After Fix
- Each grouping type has its own sort order column
- No constraint violations (new columns don't have unique constraints)
- Task organization preserved when switching between views
- Backward compatible with existing data

## Troubleshooting

### If Migration Fails
1. **Check Permissions:** Ensure database user has CREATE/ALTER privileges
2. **Backup First:** Always backup before running migrations
3. **Check Dependencies:** Ensure functions `is_null_or_empty` exists

### If Constraint Errors Persist
1. **Check Which Column:** Error should specify which column is causing the issue
2. **Run Data Fix:** The migration includes a data cleanup step
3. **Verify Functions:** Ensure updated functions are being used

### Rollback Plan
```sql
-- If needed, rollback to original functions
-- (Save original function definitions first)

-- Remove new columns (WARNING: This loses data)
ALTER TABLE tasks DROP COLUMN IF EXISTS status_sort_order;
ALTER TABLE tasks DROP COLUMN IF EXISTS priority_sort_order;
ALTER TABLE tasks DROP COLUMN IF EXISTS phase_sort_order;
ALTER TABLE tasks DROP COLUMN IF EXISTS member_sort_order;
```

## Performance Impact

### Positive
- ✅ Better user experience with preserved sort orders
- ✅ More efficient queries (appropriate indexes added)
- ✅ Reduced conflicts during concurrent operations

### Considerations
- 📊 Minimal storage increase (4 integers per task)
- 📊 Slightly more complex database functions
- 📊 No significant performance impact expected

## Testing Checklist

- [ ] Migrations run successfully without errors
- [ ] New columns exist and are populated
- [ ] Helper functions return correct column names
- [ ] Drag and drop works in status view
- [ ] Drag and drop works in priority view  
- [ ] Drag and drop works in phase view
- [ ] Drag and drop works in member view
- [ ] Sort orders persist when switching between views
- [ ] No constraint violation errors in logs
- [ ] Existing functionality still works
- [ ] Performance is acceptable

## Success Metrics

After deployment, verify:
1. **No Error Logs:** No constraint violation errors in application logs
2. **User Feedback:** Users can organize tasks differently in different views
3. **Data Integrity:** Task sort orders are preserved correctly
4. **Performance:** No significant slowdown in task operations
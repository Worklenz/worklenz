# Separate Sort Orders Implementation

## Overview
This implementation adds support for maintaining different task sort orders for each grouping type (status, priority, phase, members). This allows users to organize tasks differently when switching between different views while preserving their organization intent.

## Changes Made

### 1. Database Schema Changes
**File:** `/database/migrations/20250715000000-add-grouping-sort-orders.sql`

- Added 4 new columns to the `tasks` table:
  - `status_sort_order` - Sort order when grouped by status
  - `priority_sort_order` - Sort order when grouped by priority  
  - `phase_sort_order` - Sort order when grouped by phase
  - `member_sort_order` - Sort order when grouped by members/assignees

- Added constraints and indexes for performance
- Initialized new columns with current `sort_order` values for backward compatibility

### 2. Database Functions Update
**File:** `/database/migrations/20250715000001-update-sort-functions.sql`

- **`get_sort_column_name()`** - Helper function to get appropriate column name based on grouping
- **`update_task_sort_orders_bulk()`** - Updated to accept grouping parameter and update correct sort column
- **`handle_task_list_sort_order_change()`** - Updated to use dynamic SQL for different sort columns

### 3. Backend Socket Handler Updates
**File:** `/src/socket.io/commands/on-task-sort-order-change.ts`

- Updated `emitSortOrderChange()` to use appropriate sort column based on `group_by`
- Modified bulk update calls to pass `group_by` parameter
- Enhanced query to return both general and current sort orders

### 4. Frontend Type Definitions
**File:** `/src/types/task-management.types.ts`

- Added new sort order fields to `Task` interface
- Created `getSortOrderField()` helper function for type-safe field selection

### 5. Redux State Management
**File:** `/src/features/task-management/task-management.slice.ts`

- Updated `reorderTasksInGroup` reducer to use appropriate sort field based on grouping
- Integrated `getSortOrderField()` helper for consistent field selection

### 6. Drag and Drop Implementation  
**File:** `/src/components/task-list-v2/hooks/useDragAndDrop.ts`

- Updated `emitTaskSortChange()` to use grouping-specific sort order fields
- Enhanced sort order calculation to work with different sort columns

## Usage Examples

### User Experience
1. **Status View:** User arranges tasks by business priority within each status column
2. **Priority View:** User switches to priority view - tasks maintain their status-specific order within each priority group
3. **Phase View:** User switches to phase view - tasks maintain their own organization within each phase
4. **Back to Status:** Returning to status view shows the original organization

### API Usage
```javascript
// Socket emission now includes group_by parameter
socket.emit('TASK_SORT_ORDER_CHANGE', {
  project_id: 'uuid',
  group_by: 'status', // 'status', 'priority', 'phase', 'members'
  task_updates: [{
    task_id: 'uuid',
    sort_order: 1,
    status_id: 'uuid' // if moving between status groups
  }]
});
```

### Database Query Examples
```sql
-- Get tasks ordered by status grouping
SELECT * FROM tasks 
WHERE project_id = $1 
ORDER BY status_sort_order;

-- Get tasks ordered by priority grouping  
SELECT * FROM tasks 
WHERE project_id = $1 
ORDER BY priority_sort_order;
```

## Migration Steps

1. **Run Database Migrations:**
   ```bash
   # Apply schema changes
   psql -d worklenz -f database/migrations/20250715000000-add-grouping-sort-orders.sql
   
   # Apply function updates
   psql -d worklenz -f database/migrations/20250715000001-update-sort-functions.sql
   ```

2. **Test Migration:**
   ```bash
   # Verify columns and functions
   psql -d worklenz -f test_sort_orders.sql
   ```

3. **Deploy Frontend Changes:**
   - No additional steps needed - changes are backward compatible
   - Users will immediately benefit from separate sort orders

## Backward Compatibility

- ✅ Existing `sort_order` column remains unchanged
- ✅ New columns initialized with current `sort_order` values  
- ✅ Old API calls continue to work (default to status grouping)
- ✅ Frontend gracefully falls back to `order` field if new fields not available

## Performance Considerations

- Added indexes on new sort order columns for efficient ordering
- Dynamic SQL in functions is minimal and safe (controlled input)
- Memory footprint increase is minimal (4 integers per task)

## Testing

1. **Database Level:**
   - Verify migrations run successfully
   - Test function calls with different grouping parameters
   - Validate indexes are created and used

2. **API Level:**
   - Test socket emissions with different `group_by` values
   - Verify correct sort columns are updated
   - Test cross-group task moves

3. **Frontend Level:**
   - Test drag and drop in different grouping views
   - Verify sort order persistence when switching views
   - Test that original behavior is preserved

## Future Enhancements

1. **UI Indicators:** Show users which view they're currently organizing
2. **Sort Order Reset:** Allow users to reset sort orders for specific groupings
3. **Export/Import:** Include sort order data in project templates
4. **Analytics:** Track how users organize tasks in different views

## Troubleshooting

### Common Issues:
1. **Migration Fails:** Check database permissions and existing data integrity
2. **Sort Orders Not Persisting:** Verify socket handler receives `group_by` parameter
3. **Tasks Not Reordering:** Check frontend Redux state updates and sort field usage

### Debug Queries:
```sql
-- Check current sort orders for a project
SELECT id, name, status_sort_order, priority_sort_order, phase_sort_order, member_sort_order
FROM tasks 
WHERE project_id = 'your-project-id'
ORDER BY status_sort_order;

-- Verify function calls
SELECT get_sort_column_name('status'); -- Should return 'status_sort_order'
```
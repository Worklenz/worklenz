# Schedule Real-Time Updates Implementation

## Overview
Implemented real-time updates for the schedule view to automatically refresh data when task properties change in the task drawer, particularly focusing on billable status changes and other task-related updates.

## Problem Statement
When users changed task properties (like billable status, time estimation, assignees, dates, etc.) in the task drawer, the schedule view's summary data (allocated hours, logged billable/non-billable hours) and task list did not update in real-time. Users had to manually refresh or reopen the schedule drawer to see updated values.

## Solution Architecture

### 1. Backend Changes

#### File: `worklenz-backend/src/socket.io/commands/on-task-billable-change.ts`

**Changes Made:**
- Modified the billable change handler to return `project_id` from the database query
- Added broadcasting to all clients in the project room using `io.to(project_id).emit()`
- Included the `billable` value in the emitted event payload for better client-side handling

**Before:**
```typescript
const q = `UPDATE tasks SET billable = $2 WHERE id = $1`;
await db.query(q, [data?.task_id, data?.billable]);
socket.emit(SocketEvents.TASK_BILLABLE_CHANGE.toString(), {
    id: data?.task_id
});
```

**After:**
```typescript
const q = `UPDATE tasks SET billable = $2 WHERE id = $1 RETURNING project_id`;
const result = await db.query(q, [data?.task_id, data?.billable]);
const [taskData] = result.rows;

// Emit to the requesting socket
socket.emit(SocketEvents.TASK_BILLABLE_CHANGE.toString(), {
    id: data?.task_id,
    billable: data?.billable
});

// Broadcast to all clients in the project room for real-time updates
if (taskData?.project_id) {
    _io.to(taskData.project_id).emit(SocketEvents.TASK_BILLABLE_CHANGE.toString(), {
        id: data?.task_id,
        billable: data?.billable
    });
}
```

### 2. Frontend Changes

#### File: `worklenz-frontend/src/hooks/useScheduleSocketHandlers.ts` (NEW)

**Purpose:**
Custom React hook that listens to task-related socket events and invalidates RTK Query cache to trigger automatic data refetch for schedule views.

**Socket Events Handled:**
1. `TASK_BILLABLE_CHANGE` - When task billable status changes
2. `TASK_TIME_ESTIMATION_CHANGE` - When task time estimation changes
3. `TASK_ASSIGNEES_CHANGE` - When task assignees change
4. `TASK_START_DATE_CHANGE` - When task start date changes
5. `TASK_END_DATE_CHANGE` - When task end date changes
6. `TASK_STATUS_CHANGE` - When task status changes
7. `TASK_TIME_LOG_UPDATED` - When time logs are added/updated/deleted

**Cache Tags Invalidated:**
- `Members` - Triggers refetch of member summary data (allocated hours, logged hours)
- `TaskTimeline` - Triggers refetch of task timeline data and task list (includes logged time)
- `MemberProjects` - Triggers refetch of member project allocations
- `Workload` - Triggers refetch of workload data

#### File: `worklenz-frontend/src/features/task-drawer/task-drawer.slice.ts`

**Changes Made:**
- Added `setTaskBillable` reducer action to update billable status in task drawer state
- Exported the new action for use in socket handlers

**New Reducer:**
```typescript
setTaskBillable: (
  state,
  action: PayloadAction<{
    id: string;
    billable: boolean;
  }>
) => {
  if (!action.payload) return;
  const { id, billable } = action.payload;
  if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === id) {
    state.taskFormViewModel.task.billable = billable;
  }
},
```

#### File: `worklenz-frontend/src/hooks/useTaskSocketHandlers.ts`

**Changes Made:**
- Added `handleBillableChange` callback to listen for billable status changes
- Updates task drawer state when the currently open task's billable status changes
- Updates task-management slice for task list views
- Registered the handler in the socket event listeners array

**New Handler:**
```typescript
const handleBillableChange = useCallback(
  (data: { id: string; billable: boolean; error?: string }) => {
    if (!data || data.error) return;

    // Update the task drawer if this task is currently open
    const state = store.getState();
    const currentTaskId = state.taskDrawerReducer?.selectedTaskId;
    
    if (currentTaskId === data.id) {
      import('@/features/task-drawer/task-drawer.slice').then(({ setTaskBillable }) => {
        dispatch(setTaskBillable({ id: data.id, billable: data.billable }));
      });
    }

    // Update the task-management slice for task-list-v2 components
    const currentTask = state.taskManagement.entities[data.id];
    if (currentTask) {
      const updatedTask: Task = {
        ...currentTask,
        billable: data.billable,
        updatedAt: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      dispatch(updateTask(updatedTask));
    }
  },
  [dispatch]
);
```

#### File: `worklenz-frontend/src/features/schedule/ScheduleDrawer.tsx`

**Changes:**
- Already imports and uses `useScheduleSocketHandlers()` hook
- No additional changes needed as the hook is already integrated

#### File: `worklenz-frontend/src/components/task-drawer/shared/info-tab/details/task-drawer-billable/task-drawer-billable.tsx`

**Changes:**
- Changed `defaultChecked` to `checked` prop on the Switch component
- This ensures the switch reflects the current task billable state from props, not just the initial state

**Before:**
```typescript
return <Switch defaultChecked={task?.billable} onChange={handleBillableChange} />;
```

**After:**
```typescript
return <Switch checked={task?.billable} onChange={handleBillableChange} />;
```

## How It Works

### Data Flow

1. **User Action:**
   - User opens task drawer and changes billable status (or any other tracked property)
   - Task drawer component emits socket event: `TASK_BILLABLE_CHANGE`

2. **Backend Processing:**
   - Backend receives socket event
   - Updates database
   - Emits event back to requesting socket
   - Broadcasts event to all clients in the project room

3. **Frontend Real-Time Update:**
   - `useScheduleSocketHandlers` hook receives the socket event
   - Hook dispatches RTK Query cache invalidation for relevant tags
   - RTK Query automatically refetches all queries using those tags
   - Components using those queries (`useFetchMemberScheduleSummaryQuery`, `useFetchProjectMemberTasksQuery`) automatically re-render with fresh data

4. **UI Updates:**
   - Schedule summary card shows updated billable/non-billable hours
   - Task list shows updated task data
   - All updates happen automatically without manual refresh

### RTK Query Cache Invalidation

The solution leverages RTK Query's built-in cache invalidation system:

```typescript
// When a socket event is received
dispatch(
  scheduleApi.util.invalidateTags([
    'Members',      // Invalidates member summary queries
    'TaskTimeline', // Invalidates task timeline queries
    'MemberProjects', // Invalidates member project queries
    'Workload',     // Invalidates workload queries
  ])
);
```

This automatically triggers refetch for all active queries that provide these tags:
- `useFetchMemberScheduleSummaryQuery` (provides 'Members' tag)
- `useFetchProjectMemberTasksQuery` (provides 'TaskTimeline' tag)
- `useFetchMemberProjectsQuery` (provides 'MemberProjects' tag)
- `useFetchMemberWorkloadQuery` (provides 'Workload' tag)

## Benefits

1. **Real-Time Updates:** Changes are reflected immediately across all open schedule views
2. **Automatic Refetch:** No manual refresh needed - RTK Query handles it automatically
3. **Efficient:** Only invalidates relevant cache tags, not the entire cache
4. **Scalable:** Easy to add more socket event handlers for other task properties
5. **Consistent:** Uses the same pattern as other real-time features in the application
6. **Multi-User Support:** All users viewing the same project see updates in real-time

## Testing Checklist

- [x] Billable status change triggers schedule summary update
- [x] Time estimation change triggers schedule data update
- [x] Assignee change triggers schedule data update
- [x] Task date changes trigger schedule data update
- [x] Task status change triggers schedule data update
- [x] Time log updates trigger schedule summary update
- [x] Time log updates trigger task list logged time update (ScheduleTaskRow)
- [x] Multiple users see updates in real-time
- [x] No TypeScript errors
- [x] Socket cleanup on component unmount

## Future Enhancements

1. **Optimistic Updates:** Update UI immediately before server confirmation
2. **Debouncing:** Batch multiple rapid changes to reduce server load
3. **Selective Invalidation:** Invalidate only specific member/project data instead of all
4. **Error Handling:** Add retry logic for failed socket connections
5. **Loading States:** Show loading indicators during refetch

## Related Files

### Backend
- `worklenz-backend/src/socket.io/commands/on-task-billable-change.ts`
- `worklenz-backend/src/socket.io/events.ts`
- `worklenz-backend/src/socket.io/index.ts`

### Frontend
- `worklenz-frontend/src/hooks/useScheduleSocketHandlers.ts` (NEW)
- `worklenz-frontend/src/hooks/useTaskSocketHandlers.ts` (UPDATED - added billable handler)
- `worklenz-frontend/src/features/schedule/ScheduleDrawer.tsx`
- `worklenz-frontend/src/features/task-drawer/task-drawer.slice.ts` (UPDATED - added setTaskBillable action)
- `worklenz-frontend/src/components/schedule-old/tabs/withStartAndEndDates/WithStartAndEndDates.tsx`
- `worklenz-frontend/src/components/task-drawer/shared/info-tab/details/task-drawer-billable/task-drawer-billable.tsx`
- `worklenz-frontend/src/api/schedule/scheduleApi.ts`
- `worklenz-frontend/src/shared/socket-events.ts`

## Bug Fix: Task Drawer Data Not Loading After Billable Toggle

### Problem
After clicking the billable toggle in the task drawer, closing the drawer, and reopening it (even for the same task), the task data would not load properly. The drawer would show "loading" state with empty or missing field values.

### Root Cause Analysis

**Issue 1: Missing Socket Handler for Billable Changes**
The task drawer's billable state was not being updated when the socket event was received. When the user toggled billable status:
1. The backend updated the database and emitted a socket event
2. The schedule view received the event and invalidated its cache
3. However, the task drawer's Redux state (`taskFormViewModel`) was not updated
4. When reopening the drawer, it would try to display stale data or fail to load

**Issue 2: useEffect Skip Logic Preventing Refetch**
The `TaskDrawerInfoTab` component had logic to prevent unnecessary refetches:
```typescript
if (selectedTaskId === prevTaskIdRef.current) return; // Skip if same task
```

However, this caused a problem:
1. When drawer closes, `afterOpenChange` clears `taskFormViewModel` to null
2. But `prevTaskIdRef` still holds the task ID
3. When reopening the same task, the useEffect sees the same ID and skips the fetch
4. Result: drawer shows loading state with no data because `taskFormViewModel` is null

### Solution

**Part 1: Added Socket Handler for Billable Changes**

1. **Added `setTaskBillable` reducer action** in `task-drawer.slice.ts`:
   - Updates the `taskFormViewModel.task.billable` field when billable changes
   - Keeps the task drawer state in sync with the backend

2. **Added `handleBillableChange` handler** in `useTaskSocketHandlers.ts`:
   - Listens for `TASK_BILLABLE_CHANGE` socket events
   - Updates the task drawer state if the changed task is currently open
   - Also updates the task-management slice for task list views

3. **Registered the handler** in the socket event listeners array:
   - Ensures the handler is properly attached and cleaned up

**Part 2: Fixed useEffect Logic to Handle Missing Data**

Modified the useEffect in `TaskDrawerInfoTab` to check BOTH conditions:
1. Is it a different task? (`selectedTaskId !== prevTaskIdRef.current`)
2. Is data missing? (`!taskFormViewModel || !taskFormViewModel.task`)

If EITHER condition is true, fetch fresh data. This ensures:
- Different tasks always trigger a fetch
- Same task with missing data (after drawer close) triggers a fetch
- Same task with existing data skips unnecessary fetch

Also reset `prevTaskIdRef` when drawer closes (`selectedTaskId` becomes null) to ensure clean state.

### Code Changes

**task-drawer.slice.ts:**
```typescript
setTaskBillable: (
  state,
  action: PayloadAction<{
    id: string;
    billable: boolean;
  }>
) => {
  if (!action.payload) return;
  const { id, billable } = action.payload;
  if (state.taskFormViewModel?.task && state.taskFormViewModel.task.id === id) {
    state.taskFormViewModel.task.billable = billable;
  }
},
```

**useTaskSocketHandlers.ts:**
```typescript
const handleBillableChange = useCallback(
  (data: { id: string; billable: boolean; error?: string }) => {
    if (!data || data.error) return;

    // Update the task drawer if this task is currently open
    const state = store.getState();
    const currentTaskId = state.taskDrawerReducer?.selectedTaskId;
    
    if (currentTaskId === data.id) {
      import('@/features/task-drawer/task-drawer.slice').then(({ setTaskBillable }) => {
        dispatch(setTaskBillable({ id: data.id, billable: data.billable }));
      });
    }

    // Update the task-management slice for task-list-v2 components
    const currentTask = state.taskManagement.entities[data.id];
    if (currentTask) {
      const updatedTask: Task = {
        ...currentTask,
        billable: data.billable,
        updatedAt: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      dispatch(updateTask(updatedTask));
    }
  },
  [dispatch]
);
```

**task-drawer-info-tab.tsx:**
```typescript
useEffect(() => {
  if (!selectedTaskId) {
    // Reset the prevTaskIdRef when drawer closes
    prevTaskIdRef.current = null;
    return;
  }

  // Check if we need to fetch data:
  // 1. If it's a different task than before, OR
  // 2. If it's the same task but taskFormViewModel is empty (drawer was closed and reopened)
  const isDifferentTask = selectedTaskId !== prevTaskIdRef.current;
  const isDataMissing = !taskFormViewModel || !taskFormViewModel.task;
  
  if (!isDifferentTask && !isDataMissing) {
    // Same task and data is already loaded, skip fetch
    return;
  }

  prevTaskIdRef.current = selectedTaskId;

  fetchTaskData();
  fetchSubTasks();
  fetchTaskDependencies();
  fetchTaskAttachments();
  fetchTaskComments();

  return () => {
    setSubTasks([]);
    setTaskDependencies([]);
    setTaskAttachments([]);
    selectedFilesRef.current = [];
    setTaskComments([]);
  };
}, [selectedTaskId, projectId, taskFormViewModel]);
```

### Result
✓ Task drawer now properly updates its billable state via socket events  
✓ Reopening the drawer (same or different task) always loads correct data  
✓ No unnecessary refetches when data is already loaded and valid  
✓ Schedule view continues to update in real-time  
✓ **Billable toggle button updates immediately when clicked (real-time UI feedback)**  
✓ All TypeScript checks pass with no errors

## Additional Fix: Real-Time Toggle Button Update

### Problem
After the above fixes, there was still one UI issue: when clicking the billable toggle button, it would change the value in the backend and Redux, but the toggle button itself wouldn't visually update until the drawer was closed and reopened.

### Root Cause
The `TaskDrawerBillable` component was reading the billable value from the `task` prop:
```typescript
<Switch checked={task?.billable} onChange={handleBillableChange} />
```

The component receives the `task` prop from `TaskDetailsForm`, which has logic to prevent form resets when the task ID hasn't changed (to avoid unnecessary re-renders). When the socket event updated `taskFormViewModel.task.billable` in Redux, the component didn't re-render because:
1. The prop value didn't change (it was still pointing to the old task object)
2. React didn't detect a change that would trigger a re-render

### Solution
Modified `TaskDrawerBillable` to read the billable value directly from Redux state instead of relying solely on the prop:

```typescript
// Read billable status directly from Redux to ensure real-time updates
const billableFromRedux = useAppSelector(
  state => state.taskDrawerReducer?.taskFormViewModel?.task?.billable
);

// Use Redux value if available, otherwise fall back to prop
const billableValue = billableFromRedux !== undefined ? billableFromRedux : task?.billable;

return <Switch checked={billableValue} onChange={handleBillableChange} />;
```

This ensures:
- Component subscribes to Redux state changes
- When socket event updates Redux, component automatically re-renders
- Toggle button reflects the current state immediately
- Fallback to prop ensures compatibility if Redux state is not yet loaded

### Result
✓ Toggle button now updates immediately when clicked  
✓ Real-time visual feedback for user actions  
✓ No need to close/reopen drawer to see toggle state change  
✓ Consistent behavior across all task drawer interactions

## Notes

- The hook is already integrated in `ScheduleDrawer.tsx` via `useScheduleSocketHandlers()`
- The implementation follows the existing patterns used in the codebase for real-time updates
- All socket event listeners are properly cleaned up on component unmount to prevent memory leaks
- The solution is compatible with the existing RTK Query setup and doesn't require changes to the API layer

## Bug Fix: Task List Logged Time Not Updating in Real-Time

### Problem
When users added a new time log from the task drawer, the schedule summary section (allocated hours, total logged, billable/non-billable hours) updated correctly in real-time. However, the "Logged Time" column in the task list (`ScheduleTaskRow` component) did not update until the page was manually refreshed.

### Root Cause
The issue was in the socket event handler for time log updates. When a time log was added/updated/deleted:

1. The backend emitted `TASK_TIME_LOG_UPDATED` socket event
2. The `useScheduleSocketHandlers` hook received the event
3. The handler invalidated `Members` and `Workload` cache tags
4. This triggered refetch of `useFetchMemberScheduleSummaryQuery` (which provides the summary data)
5. **BUT** it did NOT invalidate the `TaskTimeline` tag
6. Therefore, `useFetchProjectMemberTasksQuery` (which provides task list data including `total_minutes_spent`) was NOT refetched
7. Result: Summary updated, but task list logged time remained stale

### Solution

**File: `worklenz-frontend/src/hooks/useScheduleSocketHandlers.ts`**

Added `TaskTimeline` to the list of invalidated tags in the `handleTimeLogUpdate` handler:

```typescript
// Handler for task time log updates
const handleTimeLogUpdate = (data: { task_id: string }) => {
  logger.info('Task time log updated, refreshing schedule data', { taskId: data.task_id });

  dispatch(
    scheduleApi.util.invalidateTags([
      'Members', // Member summary includes logged hours
      'Workload',
      'TaskTimeline', // Task list includes logged time (total_minutes_spent) ← ADDED
    ])
  );
};
```

### How It Works

1. **User adds time log** in task drawer
2. **Backend emits** `TASK_TIME_LOG_UPDATED` event
3. **Socket handler receives** event and invalidates cache tags:
   - `Members` → Refetches `useFetchMemberScheduleSummaryQuery` (summary card)
   - `Workload` → Refetches workload data
   - `TaskTimeline` → Refetches `useFetchProjectMemberTasksQuery` (task list)
4. **RTK Query automatically refetches** all queries with invalidated tags
5. **Components re-render** with fresh data:
   - Summary card shows updated logged hours
   - Task list shows updated logged time per task
6. **All updates happen automatically** without manual refresh

### Data Flow

```
Task Drawer (Add Time Log)
    ↓
Backend (Update DB + Emit Socket Event)
    ↓
useScheduleSocketHandlers (Receive Event)
    ↓
Invalidate Cache Tags: ['Members', 'Workload', 'TaskTimeline']
    ↓
RTK Query Auto-Refetch
    ├─→ useFetchMemberScheduleSummaryQuery (Summary Card)
    └─→ useFetchProjectMemberTasksQuery (Task List)
    ↓
Components Re-render with Fresh Data
    ├─→ WithStartAndEndDates (Summary Section) ✓
    └─→ ScheduleTaskRow (Logged Time Column) ✓
```

### Result
✓ Summary card updates in real-time (already working)  
✓ Task list logged time updates in real-time (now fixed)  
✓ No manual refresh needed  
✓ Consistent real-time behavior across all schedule components  
✓ Leverages existing RTK Query cache invalidation system  
✓ No changes needed to `ScheduleTaskRow` component (automatic via RTK Query)

### Related Components
- `worklenz-frontend/src/hooks/useScheduleSocketHandlers.ts` (UPDATED)
- `worklenz-frontend/src/components/schedule-old/tabs/withStartAndEndDates/WithStartAndEndDates.tsx` (uses the query)
- `worklenz-frontend/src/components/schedule/ScheduleTaskRow.tsx` (displays the data)
- `worklenz-frontend/src/api/schedule/scheduleApi.ts` (defines the query and tags)

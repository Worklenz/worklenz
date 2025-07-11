# Task Progress Tracking Methods in WorkLenz

## Overview
WorkLenz supports three different methods for tracking task progress, each suitable for different project management approaches:

1. **Manual Progress** - Direct input of progress percentages
2. **Weighted Progress** - Tasks have weights that affect overall progress calculation
3. **Time-based Progress** - Progress calculated based on estimated time vs. time spent

These modes can be selected when creating or editing a project in the project drawer.

## 1. Manual Progress Mode

This mode allows direct input of progress percentages for individual tasks without subtasks.

**Implementation:**
- Enabled by setting `use_manual_progress` to true in the project settings
- Progress is updated through the `on-update-task-progress.ts` socket event handler
- The UI shows a manual progress input slider in the task drawer for tasks without subtasks
- Updates the database with `progress_value` and sets `manual_progress` flag to true

**Calculation Logic:**
- For tasks without subtasks: Uses the manually set progress value
- For parent tasks: Calculates the average of all subtask progress values
- Subtask progress comes from either manual values or completion status (0% or 100%)

**Code Example:**
```typescript
// Manual progress update via socket.io
socket?.emit(SocketEvents.UPDATE_TASK_PROGRESS.toString(), JSON.stringify({
  task_id: task.id,
  progress_value: value,
  parent_task_id: task.parent_task_id
}));
```

### Showing Progress in Subtask Rows

When manual progress is enabled in a project, progress is shown in the following ways:

1. **In Task List Views**:
   - Subtasks display their individual progress values in the progress column
   - Parent tasks display the calculated average progress of all subtasks

2. **Implementation Details**:
   - The progress values are stored in the `progress_value` column in the database
   - For subtasks with manual progress set, the value is shown directly
   - For subtasks without manual progress, the completion status determines the value (0% or 100%)
   - The task view model includes both `progress` and `complete_ratio` properties

**Relevant Components:**
```typescript
// From task-list-progress-cell.tsx
const TaskListProgressCell = ({ task }: TaskListProgressCellProps) => {
  return task.is_sub_task ? null : (
    <Tooltip title={`${task.completed_count || 0} / ${task.total_tasks_count || 0}`}>
      <Progress
        percent={task.complete_ratio || 0}
        type="circle"
        size={24}
        style={{ cursor: 'default' }}
      />
    </Tooltip>
  );
};
```

**Task Progress Calculation in Backend:**
```typescript
// From tasks-controller-base.ts
// For tasks without subtasks, respect manual progress if set
if (task.manual_progress === true && task.progress_value !== null) {
  // For manually set progress, use that value directly
  task.progress = parseInt(task.progress_value);
  task.complete_ratio = parseInt(task.progress_value);
} 
```

## 2. Weighted Progress Mode

This mode allows assigning different weights to subtasks to reflect their relative importance in the overall task or project progress.

**Implementation:**
- Enabled by setting `use_weighted_progress` to true in the project settings
- Weights are updated through the `on-update-task-weight.ts` socket event handler
- The UI shows a weight input for subtasks in the task drawer
- Default weight is 100 if not specified

**Calculation Logic:**
- Progress is calculated using a weighted average: `SUM(progress_value * weight) / SUM(weight)`
- This gives more influence to tasks with higher weights
- A parent task's progress is the weighted average of its subtasks' progress

**Code Example:**
```typescript
// Weight update via socket.io
socket?.emit(SocketEvents.UPDATE_TASK_WEIGHT.toString(), JSON.stringify({
  task_id: task.id,
  weight: value,
  parent_task_id: task.parent_task_id
}));
```

## 3. Time-based Progress Mode

This mode calculates progress based on estimated time vs. actual time spent.

**Implementation:**
- Enabled by setting `use_time_progress` to true in the project settings
- Uses task time estimates (hours and minutes) for calculation
- No separate socket handler needed as it's calculated automatically

**Calculation Logic:**
- Progress is calculated using time as the weight: `SUM(progress_value * estimated_minutes) / SUM(estimated_minutes)`
- For tasks with time tracking, estimated vs. actual time can be factored in
- Parent task progress is weighted by the estimated time of each subtask

**SQL Example:**
```sql
WITH subtask_progress AS (
    SELECT 
        CASE 
            WHEN manual_progress IS TRUE AND progress_value IS NOT NULL THEN 
                progress_value
            ELSE
                CASE 
                    WHEN EXISTS(
                        SELECT 1
                        FROM tasks_with_status_view
                        WHERE tasks_with_status_view.task_id = t.id
                        AND is_done IS TRUE
                    ) THEN 100
                    ELSE 0
                END
        END AS progress_value,
        COALESCE(total_hours * 60 + total_minutes, 0) AS estimated_minutes
    FROM tasks t
    WHERE t.parent_task_id = _task_id
    AND t.archived IS FALSE
)
SELECT COALESCE(
    SUM(progress_value * estimated_minutes) / NULLIF(SUM(estimated_minutes), 0),
    0
)
FROM subtask_progress
INTO _ratio;
```

## Default Progress Tracking (when no special mode is selected)

If no specific progress mode is enabled, the system falls back to a traditional completion-based calculation:

**Implementation:**
- Default mode when all three special modes are disabled
- Based on task completion status only

**Calculation Logic:**
- For tasks without subtasks: 0% if not done, 100% if done
- For parent tasks: `(completed_tasks / total_tasks) * 100`
- Counts both the parent and all subtasks in the calculation

**SQL Example:**
```sql
-- Traditional calculation based on completion status
SELECT (CASE
            WHEN EXISTS(SELECT 1
                        FROM tasks_with_status_view
                        WHERE tasks_with_status_view.task_id = _task_id
                          AND is_done IS TRUE) THEN 1
            ELSE 0 END)
INTO _parent_task_done;
            
SELECT COUNT(*)
FROM tasks_with_status_view
WHERE parent_task_id = _task_id
  AND is_done IS TRUE
INTO _sub_tasks_done;
            
_total_completed = _parent_task_done + _sub_tasks_done;
_total_tasks = _sub_tasks_count + 1; -- +1 for the parent task
            
IF _total_tasks = 0 THEN
    _ratio = 0;
ELSE
    _ratio = (_total_completed / _total_tasks) * 100;
END IF;
```

## Technical Implementation Details

The progress calculation logic is implemented in PostgreSQL functions, primarily in the `get_task_complete_ratio` function. Progress updates flow through the system as follows:

1. **User Action**: User updates task progress or weight in the UI
2. **Socket Event**: Client emits socket event (UPDATE_TASK_PROGRESS or UPDATE_TASK_WEIGHT)
3. **Server Handler**: Server processes the event in the respective handler function
4. **Database Update**: Progress/weight value is updated in the database
5. **Recalculation**: If needed, parent task progress is recalculated
6. **Broadcast**: Changes are broadcast to all clients in the project room
7. **UI Update**: Client UI updates to reflect the new progress values

This architecture allows for real-time updates and consistent progress calculation across all clients.

## Associated Files and Components

### Backend Files

1. **Socket Event Handlers**:
   - `worklenz-backend/src/socket.io/commands/on-update-task-progress.ts` - Handles manual progress updates
   - `worklenz-backend/src/socket.io/commands/on-update-task-weight.ts` - Handles task weight updates

2. **Database Functions**:
   - `worklenz-backend/database/migrations/20250423000000-subtask-manual-progress.sql` - Contains the `get_task_complete_ratio` function that calculates progress based on the selected method
   - Functions that support project creation/updates with progress mode settings:
     - `create_project`
     - `update_project`

3. **Controllers**:
   - `worklenz-backend/src/controllers/project-workload/workload-gannt-base.ts` - Contains the `calculateTaskCompleteRatio` method
   - `worklenz-backend/src/controllers/projects-controller.ts` - Handles project-level progress calculations
   - `worklenz-backend/src/controllers/tasks-controller-base.ts` - Handles task progress calculation and updates task view models

### Frontend Files

1. **Project Configuration**:
   - `worklenz-frontend/src/components/projects/project-drawer/project-drawer.tsx` - Contains UI for selecting progress method when creating/editing projects

2. **Progress Visualization Components**:
   - `worklenz-frontend/src/components/project-list/project-list-table/project-list-progress/progress-list-progress.tsx` - Displays project progress
   - `worklenz-frontend/src/pages/projects/project-view-1/taskList/taskListTable/taskListTableCells/TaskProgress.tsx` - Displays task progress
   - `worklenz-frontend/src/pages/projects/projectView/taskList/task-list-table/task-list-table-cells/task-list-progress-cell/task-list-progress-cell.tsx` - Alternative task progress cell
   - `worklenz-frontend/src/components/task-list-common/task-row/task-row-progress/task-row-progress.tsx` - Displays progress in task rows

3. **Progress Input Components**:
   - `worklenz-frontend/src/components/task-drawer/shared/info-tab/details/task-drawer-progress/task-drawer-progress.tsx` - Component for inputting task progress/weight

## Choosing the Right Progress Method

Each progress method is suitable for different types of projects:

- **Manual Progress**: Best for creative work where progress is subjective
- **Weighted Progress**: Ideal for projects where some tasks are more significant than others
- **Time-based Progress**: Perfect for projects where time estimates are reliable and important

Project managers can choose the appropriate method when creating or editing a project in the project drawer, based on their team's workflow and project requirements. 
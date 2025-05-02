# Task Progress Tracking Methods in WorkLenz

## Overview
WorkLenz supports three different methods for tracking task progress, each suitable for different project management approaches:

1. **Manual Progress** - Direct input of progress percentages
2. **Weighted Progress** - Tasks have weights that affect overall progress calculation
3. **Time-based Progress** - Progress calculated based on estimated time vs. time spent

These modes can be selected when creating or editing a project in the project drawer. Only one progress method can be enabled at a time. If none of these methods are enabled, progress will be calculated based on task completion status as described in the "Default Progress Tracking" section below.

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

## 2. Weighted Progress Mode

This mode allows assigning different weights to subtasks to reflect their relative importance in the overall task or project progress.

**Implementation:**
- Enabled by setting `use_weighted_progress` to true in the project settings
- Weights are updated through the `on-update-task-weight.ts` socket event handler
- The UI shows a weight input for subtasks in the task drawer
- Manual progress input is still required for tasks without subtasks
- Default weight is 100 if not specified
- Weight values range from 0 to 100%

**Calculation Logic:**
- For tasks without subtasks: Uses the manually entered progress value
- Progress is calculated using a weighted average: `SUM(progress_value * weight) / SUM(weight)`
- This gives more influence to tasks with higher weights
- A parent task's progress is the weighted average of its subtasks' progress values

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
- Manual progress input is still required for tasks without subtasks
- No separate socket handler needed as it's calculated automatically

**Calculation Logic:**
- For tasks without subtasks: Uses the manually entered progress value
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

## Manual Progress Input Implementation

Regardless of which progress tracking method is selected for a project, tasks without subtasks (leaf tasks) require manual progress input. This section details how manual progress input is implemented and used across all progress tracking methods.

### UI Component

The manual progress input component is implemented in `worklenz-frontend/src/components/task-drawer/shared/info-tab/details/task-drawer-progress/task-drawer-progress.tsx` and includes:

1. **Progress Slider**: A slider UI control that allows users to set progress values from 0% to 100%
2. **Progress Input Field**: A numeric input field that accepts direct entry of progress percentage
3. **Progress Display**: Visual representation of the current progress value

The component is conditionally rendered in the task drawer for tasks that don't have subtasks.

**Usage Across Progress Methods:**
- In **Manual Progress Mode**: Only the progress slider/input is shown
- In **Weighted Progress Mode**: Both the progress slider/input and weight input are shown
- In **Time-based Progress Mode**: The progress slider/input is shown alongside time estimate fields

### Progress Update Flow

When a user updates a task's progress manually, the following process occurs:

1. **User Input**: User adjusts the progress slider or enters a value in the input field
2. **UI Event Handler**: The UI component captures the change event and validates the input
3. **Socket Event Emission**: The component emits a `UPDATE_TASK_PROGRESS` socket event with:
   ```typescript
   {
     task_id: task.id,
     progress_value: value, // The new progress value (0-100)
     parent_task_id: task.parent_task_id // For recalculation
   }
   ```
4. **Server Processing**: The socket event handler on the server:
   - Updates the task's `progress_value` in the database
   - Sets the `manual_progress` flag to true
   - Triggers recalculation of parent task progress

### Progress Calculation Across Methods

The calculation of progress differs based on the active progress method:

1. **For Leaf Tasks (no subtasks)** in all methods:
   - Progress is always the manually entered value (`progress_value`)
   - If the task is marked as completed, progress is automatically set to 100%

2. **For Parent Tasks**:
   - **Manual Progress Mode**: Simple average of all subtask progress values
   - **Weighted Progress Mode**: Weighted average where each subtask's progress is multiplied by its weight
   - **Time-based Progress Mode**: Weighted average where each subtask's progress is multiplied by its estimated time
   - **Default Mode**: Percentage of completed tasks (including parent) vs. total tasks

### Detailed Calculation for Weighted Progress Method

In Weighted Progress mode, both the manual progress input and weight assignment are critical components:

1. **Manual Progress Input**:
   - For leaf tasks (without subtasks), users must manually input progress percentages (0-100%)
   - If a leaf task is marked as complete, its progress is automatically set to 100%
   - If a leaf task's progress is not manually set, it defaults to 0% (or 100% if completed)

2. **Weight Assignment**:
   - Each task can be assigned a weight value between 0-100% (default 100% if not specified)
   - Higher weight values give tasks more influence in parent task progress calculations
   - A weight of 0% means the task doesn't contribute to the parent's progress calculation

3. **Parent Task Calculation**:
   The weighted progress formula is:
   ```
   ParentProgress = ∑(SubtaskProgress * SubtaskWeight) / ∑(SubtaskWeight)
   ```

   **Example Calculation**:
   Consider a parent task with three subtasks:
   - Subtask A: Progress 50%, Weight 60%
   - Subtask B: Progress 75%, Weight 20%
   - Subtask C: Progress 25%, Weight 100%

   Calculation:
   ```
   ParentProgress = ((50 * 60) + (75 * 20) + (25 * 100)) / (60 + 20 + 100)
   ParentProgress = (3000 + 1500 + 2500) / 180
   ParentProgress = 7000 / 180
   ParentProgress = 38.89%
   ```

   Notice that Subtask C, despite having the lowest progress, has a significant impact on the parent task progress due to its higher weight.

4. **Zero Weight Handling**:
   Tasks with zero weight are excluded from the calculation:
   - Subtask A: Progress 40%, Weight 50%
   - Subtask B: Progress 80%, Weight 0%

   Calculation:
   ```
   ParentProgress = ((40 * 50) + (80 * 0)) / (50 + 0)
   ParentProgress = 2000 / 50
   ParentProgress = 40%
   ```

   In this case, only Subtask A influences the parent task progress because Subtask B has a weight of 0%.
   
5. **Default Weight Behavior**:
   When weights aren't explicitly assigned to some tasks:
   - Subtask A: Progress 30%, Weight 60% (explicitly set)
   - Subtask B: Progress 70%, Weight not set (defaults to 100%)
   - Subtask C: Progress 90%, Weight not set (defaults to 100%)

   Calculation:
   ```
   ParentProgress = ((30 * 60) + (70 * 100) + (90 * 100)) / (60 + 100 + 100)
   ParentProgress = (1800 + 7000 + 9000) / 260
   ParentProgress = 17800 / 260
   ParentProgress = 68.46%
   ```

   Note that Subtasks B and C have more influence than Subtask A because they have higher default weights.

6. **All Zero Weights Edge Case**:
   If all subtasks have zero weight, the progress is calculated as 0%:
   ```
   ParentProgress = SUM(progress_value * 0) / SUM(0) = 0 / 0 = undefined
   ```
   
   The SQL implementation handles this with `NULLIF` and `COALESCE` to return 0% in this case.

4. **Actual SQL Implementation**:
   The database function implements the weighted calculation as follows:
   ```sql
   WITH subtask_progress AS (
       SELECT 
           CASE 
               -- If subtask has manual progress, use that value
               WHEN manual_progress IS TRUE AND progress_value IS NOT NULL THEN 
                   progress_value
               -- Otherwise use completion status (0 or 100)
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
           COALESCE(weight, 100) AS weight
       FROM tasks t
       WHERE t.parent_task_id = _task_id
       AND t.archived IS FALSE
   )
   SELECT COALESCE(
       SUM(progress_value * weight) / NULLIF(SUM(weight), 0),
       0
   )
   FROM subtask_progress
   INTO _ratio;
   ```

   This SQL implementation:
   - Gets all non-archived subtasks of the parent task
   - For each subtask, determines its progress value:
     - If manual progress is set, uses that value
     - Otherwise, uses 100% if the task is done or 0% if not done
   - Uses COALESCE to default weight to 100 if not specified
   - Calculates the weighted average, handling the case where sum of weights might be zero
   - Returns 0 if there are no subtasks with weights

### Detailed Calculation for Time-based Progress Method

In Time-based Progress mode, the task's estimated time serves as its weight in progress calculations:

1. **Manual Progress Input**:
   - As with weighted progress, leaf tasks require manual progress input
   - Progress is entered as a percentage (0-100%)
   - Completed tasks are automatically set to 100% progress

2. **Time Estimation**:
   - Each task has an estimated time in hours and minutes
   - These values are stored in `total_hours` and `total_minutes` fields
   - Time estimates effectively function as weights in progress calculations
   - Tasks with longer estimated durations have more influence on parent task progress
   - Tasks with zero or no time estimate don't contribute to the parent's progress calculation

3. **Parent Task Calculation**:
   The time-based progress formula is:
   ```
   ParentProgress = ∑(SubtaskProgress * SubtaskEstimatedMinutes) / ∑(SubtaskEstimatedMinutes)
   ```
   where `SubtaskEstimatedMinutes = (SubtaskHours * 60) + SubtaskMinutes`

   **Example Calculation**:
   Consider a parent task with three subtasks:
   - Subtask A: Progress 40%, Estimated Time 2h 30m (150 minutes)
   - Subtask B: Progress 80%, Estimated Time 1h (60 minutes)
   - Subtask C: Progress 10%, Estimated Time 4h (240 minutes)

   Calculation:
   ```
   ParentProgress = ((40 * 150) + (80 * 60) + (10 * 240)) / (150 + 60 + 240)
   ParentProgress = (6000 + 4800 + 2400) / 450
   ParentProgress = 13200 / 450
   ParentProgress = 29.33%
   ```

   Note how Subtask C, with its large time estimate, significantly pulls down the overall progress despite Subtask B being mostly complete.

4. **Zero Time Estimate Handling**:
   Tasks with zero time estimate are excluded from the calculation:
   - Subtask A: Progress 40%, Estimated Time 3h (180 minutes)
   - Subtask B: Progress 80%, Estimated Time 0h (0 minutes)

   Calculation:
   ```
   ParentProgress = ((40 * 180) + (80 * 0)) / (180 + 0)
   ParentProgress = 7200 / 180
   ParentProgress = 40%
   ```

   In this case, only Subtask A influences the parent task progress because Subtask B has no time estimate.

5. **All Zero Time Estimates Edge Case**:
   If all subtasks have zero time estimates, the progress is calculated as 0%:
   ```
   ParentProgress = SUM(progress_value * 0) / SUM(0) = 0 / 0 = undefined
   ```
   
   The SQL implementation handles this with `NULLIF` and `COALESCE` to return 0% in this case.

6. **Actual SQL Implementation**:
   The SQL function for this calculation first converts hours to minutes for consistent measurement:
   ```sql
   WITH subtask_progress AS (
       SELECT 
           CASE 
               -- If subtask has manual progress, use that value
               WHEN manual_progress IS TRUE AND progress_value IS NOT NULL THEN 
                   progress_value
               -- Otherwise use completion status (0 or 100)
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

   This implementation:
   - Gets all non-archived subtasks of the parent task
   - Determines each subtask's progress value (manual or completion-based)
   - Calculates total minutes by converting hours to minutes and adding them together
   - Uses COALESCE to treat NULL time estimates as 0 minutes
   - Uses NULLIF to handle cases where all time estimates are zero
   - Returns 0% progress if there are no subtasks with time estimates

### Common Implementation Considerations

For both weighted and time-based progress calculation:

1. **Null Handling**:
   - Tasks with NULL progress values are treated as 0% progress (unless completed)
   - Tasks with NULL weights default to 100 in weighted mode
   - Tasks with NULL time estimates are treated as 0 minutes in time-based mode

2. **Progress Propagation**:
   - When a leaf task's progress changes, all ancestor tasks are recalculated
   - Progress updates are propagated through socket events to all connected clients
   - The recalculation happens server-side to ensure consistency

3. **Edge Cases**:
   - If all subtasks have zero weight/time, the system falls back to a simple average
   - If a parent task has no subtasks, its own manual progress value is used
   - If a task is archived, it's excluded from parent task calculations

### Database Implementation

The manual progress value is stored in the `tasks` table with these relevant fields:

```sql
tasks (
  -- other fields
  progress_value FLOAT, -- The manually entered progress value (0-100)
  manual_progress BOOLEAN, -- Flag indicating if progress was manually set
  weight INTEGER DEFAULT 100, -- For weighted progress calculation
  total_hours INTEGER, -- For time-based progress calculation
  total_minutes INTEGER -- For time-based progress calculation
)
```

### Integration with Parent Task Calculation

When a subtask's progress is updated manually, the parent task's progress is automatically recalculated based on the active progress method:

```typescript
// Pseudocode for parent task recalculation
function recalculateParentTaskProgress(taskId, parentTaskId) {
  if (!parentTaskId) return;
  
  // Get project settings to determine active progress method
  const project = getProjectByTaskId(taskId);
  
  if (project.use_manual_progress) {
    // Calculate average of all subtask progress values
    updateParentProgress(parentTaskId, calculateAverageProgress(parentTaskId));
  } 
  else if (project.use_weighted_progress) {
    // Calculate weighted average using subtask weights
    updateParentProgress(parentTaskId, calculateWeightedProgress(parentTaskId));
  }
  else if (project.use_time_progress) {
    // Calculate weighted average using time estimates
    updateParentProgress(parentTaskId, calculateTimeBasedProgress(parentTaskId));
  }
  else {
    // Default: Calculate based on task completion
    updateParentProgress(parentTaskId, calculateCompletionBasedProgress(parentTaskId));
  }
  
  // If this parent has a parent, continue recalculation up the tree
  const grandparentId = getParentTaskId(parentTaskId);
  if (grandparentId) {
    recalculateParentTaskProgress(parentTaskId, grandparentId);
  }
}
```

This recursive approach ensures that changes to any task's progress are properly propagated up the task hierarchy.

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

### Frontend Files

1. **Project Configuration**:
   - `worklenz-frontend/src/components/projects/project-drawer/project-drawer.tsx` - Contains UI for selecting progress method when creating/editing projects

2. **Progress Visualization Components**:
   - `worklenz-frontend/src/components/project-list/project-list-table/project-list-progress/progress-list-progress.tsx` - Displays project progress
   - `worklenz-frontend/src/pages/projects/project-view-1/taskList/taskListTable/taskListTableCells/TaskProgress.tsx` - Displays task progress
   - `worklenz-frontend/src/pages/projects/projectView/taskList/task-list-table/task-list-table-cells/task-list-progress-cell/task-list-progress-cell.tsx` - Alternative task progress cell

3. **Progress Input Components**:
   - `worklenz-frontend/src/components/task-drawer/shared/info-tab/details/task-drawer-progress/task-drawer-progress.tsx` - Component for inputting task progress/weight

## Choosing the Right Progress Method

Each progress method is suitable for different types of projects:

- **Manual Progress**: Best for creative work where progress is subjective
- **Weighted Progress**: Ideal for projects where some tasks are more significant than others
- **Time-based Progress**: Perfect for projects where time estimates are reliable and important

Project managers can choose the appropriate method when creating or editing a project in the project drawer, based on their team's workflow and project requirements. 
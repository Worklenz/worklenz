# Recurring Task Mode Selection Feature

## Overview

This feature adds the ability to choose between two different behaviors for recurring tasks:

1. **Create New Task** (Default) - Creates a new copy of the task at each recurring interval
2. **Change Task Status** - Changes the status of the existing task at each recurring interval

## User Interface

### Location
The recurring task configuration is accessible from the task drawer's info tab, under the "Recurring" toggle.

### New UI Elements

1. **Recurring Mode Selector**
   - Radio button group with two options:
     - "Create New Task" - Maintains the original behavior
     - "Change Task Status" - New behavior for status updates

2. **Target Status Selector** (visible only when "Change Task Status" is selected)
   - Dropdown showing all available statuses for the project
   - Allows users to select which status the task should change to
   - Defaults to the first available status

## Technical Implementation

### Database Changes

**Migration File**: `worklenz-backend/database/migrations/20260212000000-add-recurring-mode-selection.sql`

New columns added to `task_recurring_schedules` table:
- `recurring_mode` (enum: 'create_task' | 'change_status') - Default: 'create_task'
- `target_status_id` (UUID, nullable) - References task_statuses table

### Backend Changes

**Files Modified**:
1. `worklenz-backend/src/controllers/task-recurring-controller.ts`
   - Updated `getById` to return new fields
   - Updated `updateSchedule` to accept and validate new fields

2. `worklenz-backend/src/cron_jobs/recurring-tasks.ts`
   - Added new function `changeTaskStatus()` to handle status change mode
   - Updated main cron job loop to check `recurring_mode` and execute appropriate logic
   - Maintains separate logic paths for each mode

### Frontend Changes

**Files Modified**:
1. `worklenz-frontend/src/types/tasks/task-recurring-schedule.ts`
   - Added `IRecurringMode` enum
   - Added `recurring_mode` and `target_status_id` to `ITaskRecurringSchedule` interface

2. `worklenz-frontend/src/components/task-drawer/shared/info-tab/details/task-drawer-recurring-config/task-drawer-recurring-config.tsx`
   - Added mode selector UI
   - Added status dropdown (conditional rendering)
   - Integrated with status API to fetch available statuses
   - Updated save logic to include new fields

3. `worklenz-frontend/public/locales/en/task-drawer/task-drawer-recurring-config.json`
   - Added translation keys for new UI elements

## How It Works

### Create New Task Mode (Default)
- Behavior remains unchanged from the original implementation
- At each recurring interval, a new task is created based on the template
- The new task inherits properties from the original task (assignees, labels, etc.)
- Each occurrence is a separate task entity

### Change Task Status Mode (New)
- At each recurring interval, the original task's status is updated
- The task remains the same entity, only the status changes
- If `target_status_id` is specified, that status is used
- If `target_status_id` is null, the system defaults to the project's "Todo" category status
- Occurrence count is still tracked for both modes
- **Progress Handling**:
  - When status changes to a "Done" category: Progress is automatically set to 100% (if not already)
  - When status changes from "Done" to "Todo" or "Doing": `manual_progress` is reset to FALSE, allowing progress to be recalculated based on subtasks
  - This matches the behavior of manual status changes in the UI

## Cron Job Logic

The recurring tasks cron job (`worklenz-backend/src/cron_jobs/recurring-tasks.ts`) now:

1. Fetches all active recurring schedules with the new `recurring_mode` field
2. For each schedule, checks the `recurring_mode` value:
   - If `'create_task'`: Calls `createSingleRecurringTask()` (existing logic)
   - If `'change_status'`: Calls `changeTaskStatus()` (new logic)
3. Both modes update the schedule's `occurrence_count` and `last_checked_at` fields

## API Endpoints

### GET `/api/v1/task-recurring/:id`
Returns schedule data including:
- `recurring_mode`: 'create_task' | 'change_status'
- `target_status_id`: UUID or null

### PUT `/api/v1/task-recurring/:id`
Accepts body with:
- `recurring_mode`: 'create_task' | 'change_status' (optional, defaults to 'create_task')
- `target_status_id`: UUID or null (optional)

## Usage Example

1. User opens a task and enables recurring
2. User clicks the settings icon to configure recurring options
3. User selects "Change Task Status" mode
4. User selects "In Progress" from the status dropdown
5. User configures the recurring schedule (e.g., "Daily")
6. User saves the configuration
7. The cron job will now change the task's status to "In Progress" daily instead of creating new tasks

## Benefits

- **Flexibility**: Users can choose the behavior that fits their workflow
- **Status Automation**: Automatically move tasks through workflow stages
- **Reduced Clutter**: Avoid creating multiple task copies when only status changes are needed
- **Backward Compatible**: Existing recurring tasks continue to work with "Create New Task" mode

## Testing

To test the feature:

1. Create a task in a project
2. Enable recurring on the task
3. Configure it with "Change Task Status" mode
4. Select a target status
5. Set a short interval (e.g., daily)
6. Wait for the cron job to run (or trigger manually)
7. Verify the task status changes instead of creating a new task

## Migration

To apply the database changes:

```bash
psql -U your_user -d your_database -f worklenz-backend/database/migrations/20260212000000-add-recurring-mode-selection.sql
```

Or use your existing migration system to apply the changes.

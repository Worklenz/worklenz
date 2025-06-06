# Recurring Tasks Cron Job Documentation

## Overview
The recurring tasks cron job automates the creation of tasks based on predefined templates and schedules. It ensures that tasks are generated at the correct intervals without manual intervention, supporting efficient project management and timely task assignment.

## Purpose
- Automatically create tasks according to recurring schedules defined in the database.
- Prevent duplicate task creation for the same schedule and date.
- Assign team members and labels to newly created tasks as specified in the template.

## Scheduling Logic
- The cron job is scheduled using the [cron](https://www.npmjs.com/package/cron) package.
- The schedule is defined by a cron expression (e.g., `*/2 * * * *` for every 2 minutes, or `0 11 */1 * 1-5` for 11:00 UTC on weekdays).
- On each tick, the job:
  1. Fetches all recurring task templates and their schedules.
  2. Determines the next occurrence for each template using `calculateNextEndDate`.
  3. Checks if a task for the next occurrence already exists.
  4. Creates a new task if it does not exist and the next occurrence is within the allowed future window.

## Future Limit Logic
The system implements different future limits based on the schedule type to maintain an appropriate number of future tasks:

```typescript
const FUTURE_LIMITS = {
  daily: moment.duration(7, 'days'),
  weekly: moment.duration(2, 'weeks'),
  monthly: moment.duration(2, 'months'),
  every_x_days: (interval: number) => moment.duration(interval * 2, 'days'),
  every_x_weeks: (interval: number) => moment.duration(interval * 2, 'weeks'),
  every_x_months: (interval: number) => moment.duration(interval * 2, 'months')
};
```

### Implementation Details
- **Base Calculation:**
  ```typescript
  const futureLimit = moment(template.last_checked_at || template.created_at)
    .add(getFutureLimit(schedule.schedule_type, schedule.interval), 'days');
  ```

- **Task Creation Rules:**
  1. Only create tasks if the next occurrence is before the future limit
  2. Skip creation if a task already exists for that date
  3. Update `last_checked_at` after processing

- **Benefits:**
  - Prevents excessive task creation
  - Maintains system performance
  - Ensures timely task visibility
  - Allows for schedule modifications

## Date Handling
- **Monthly Tasks:**
  - Dates are limited to 1-28 to ensure consistency across all months
  - This prevents issues with months having different numbers of days
  - No special handling needed for February or months with 30/31 days
- **Weekly Tasks:**
  - Supports multiple days of the week (0-6, where 0 is Sunday)
  - Tasks are created for each selected day
- **Interval-based Tasks:**
  - Every X days/weeks/months from the last task's end date
  - Minimum interval is 1 day/week/month
  - No maximum limit, but tasks are only created up to the future limit

## Database Interactions
- **Templates and Schedules:**
  - Templates are stored in `task_recurring_templates`.
  - Schedules are stored in `task_recurring_schedules`.
  - The job joins these tables to get all necessary data for task creation.
- **Task Creation:**
  - Uses a stored procedure `create_quick_task` to insert new tasks.
  - Assigns team members and labels by calling appropriate functions/controllers.
- **State Tracking:**
  - Updates `last_checked_at` and `last_created_task_end_date` in the schedule after processing.
  - Maintains future limits based on schedule type.

## Task Creation Process
1. **Fetch Templates:** Retrieve all templates and their associated schedules.
2. **Determine Next Occurrence:** Use the last task's end date or the schedule's creation date to calculate the next due date.
3. **Check for Existing Task:** Ensure no duplicate task is created for the same schedule and date.
4. **Create Task:**
   - Insert the new task using the template's data.
   - Assign team members and labels as specified.
5. **Update Schedule:** Record the last checked and created dates for accurate future runs.

## Configuration & Extension Points
- **Cron Expression:** Modify the `TIME` constant in the code to change the schedule.
- **Task Template Structure:** Extend the template or schedule interfaces to support additional fields.
- **Task Creation Logic:** Customize the task creation process or add new assignment/labeling logic as needed.
- **Future Window:** Adjust the future limits by modifying the `FUTURE_LIMITS` configuration.

## Error Handling
- Errors are logged using the `log_error` utility.
- The job continues processing other templates even if one fails.
- Failed task creations are not retried automatically.

## References
- Source: `src/cron_jobs/recurring-tasks.ts`
- Utilities: `src/shared/utils.ts`
- Database: `src/config/db.ts`
- Controllers: `src/controllers/tasks-controller.ts`

---
For further customization or troubleshooting, refer to the source code and update the documentation as needed.
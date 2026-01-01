# Task-Level Timeline View Implementation Plan

## Executive Summary

**Goal:** Add a task-level timeline view with drag-and-drop scheduling to show individual task assignments across team members over time, similar to Jira/Asana timeline views.

**User Requirements (Confirmed):**
- ✅ Task-level timeline view (show individual tasks, not just project allocations)
- ✅ Drag-and-drop individual task bars to reschedule
- ✅ Manual time-off entry for availability tracking
- ✅ React virtualization for performance with large datasets

---

## 1. ARCHITECTURE DECISIONS

### 1.1 Library Selection: `gantt-task-react` ✅

**Selected:** Use existing `gantt-task-react` library (already installed v0.3.9)

**Why:**
- ✅ Already in package.json and proven in production (roadmap feature)
- ✅ MIT license, TypeScript support
- ✅ Built-in drag-and-drop via `onDateChange` callback
- ✅ Virtual rendering built-in (handles 100k+ tasks efficiently)
- ✅ Subtask support for hierarchical structure
- ✅ Customizable to match existing theme system

**Alternatives rejected:** Building custom solution would take 3-4 weeks; library provides all needed features out-of-the-box.

### 1.2 View Architecture

```
Schedule Page (schedule.tsx)
├── View Toggle: [Project View | Task View] ← NEW
└── Conditional Rendering:
    ├── GranttChart.tsx (existing - project allocations)
    └── TaskTimelineView.tsx (NEW - task timeline)
        ├── GanttTaskReactWrapper (library integration)
        ├── TaskTimelineFilters (project/member/status filters)
        └── TimeOffCalendar (manual time-off management)
```

### 1.3 Data Flow

```
User drags task → gantt-task-react onDateChange callback
    ↓
Optimistic update (Redux/RTK Query cache)
    ↓
API call: PUT /tasks/:taskId/dates
    ↓
Socket.IO broadcast to other users
    ↓
Database update (tasks.start_date, tasks.end_date)
    ↓
RTK Query cache invalidation & refetch
```

---

## 2. DATABASE CHANGES

### 2.1 New Table: member_time_off

```sql
CREATE TABLE member_time_off (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT valid_date_range CHECK (end_date >= start_date)
);

CREATE INDEX idx_member_time_off_dates
    ON member_time_off(team_member_id, start_date, end_date);
```

**Migration file:** `worklenz-backend/database/sql/migrations/add_member_time_off_table.sql`

### 2.2 Existing Tables (No Changes Needed)

The `tasks` table already has all required fields:
- `start_date`, `end_date` - for scheduling
- `tasks_assignees` junction table - for member assignments
- `status_id`, `priority_id` - for filtering/coloring
- `parent_task_id` - for subtask grouping

---

## 3. BACKEND IMPLEMENTATION

### 3.1 New Controller: TaskTimelineController

**File:** `worklenz-backend/src/controllers/schedule-v2/task-timeline-controller.ts`

**Endpoints:**
```typescript
GET  /api/schedule-gannt-v2/tasks/:teamId
     // Returns tasks with assignees, dates, project info
     // Query params: startDate, endDate, memberId, projectId, statusId

PUT  /api/schedule-gannt-v2/tasks/:taskId/dates
     // Updates task start/end dates (handles drag-drop)
     // Body: { start_date, end_date }
     // Emits Socket.IO event for real-time updates

GET  /api/schedule-gannt-v2/tasks/:taskId/conflicts
     // Checks for scheduling conflicts (time-off, overallocation)
```

### 3.2 New Controller: TimeOffController

**File:** `worklenz-backend/src/controllers/schedule-v2/time-off-controller.ts`

**Endpoints:**
```typescript
GET    /api/schedule-gannt-v2/time-off
       // Query params: teamMemberId, startDate, endDate

POST   /api/schedule-gannt-v2/time-off
       // Body: { team_member_id, start_date, end_date, reason }

DELETE /api/schedule-gannt-v2/time-off/:id
```

### 3.3 Socket.IO Handler

**File:** `worklenz-backend/src/socket.io/commands/on_schedule_task_drag_change.ts`

```typescript
// Listens for task drag events
// Updates database
// Broadcasts to all users in project room: SCHEDULE_TASK_UPDATE event
// Logs activity for audit trail
```

**Router updates:** Add routes to `schedule-api-v2-router.ts`

---

## 4. FRONTEND IMPLEMENTATION

### 4.1 RTK Query API Extensions

**File:** `worklenz-frontend/src/api/schedule/scheduleApi.ts`

```typescript
// Add new endpoints:
fetchTaskTimeline: builder.query<Task[]>({ ... })
updateTaskDates: builder.mutation({
  // Includes optimistic update logic
  invalidatesTags: ['TaskTimeline', 'Workload']
})
fetchTimeOff: builder.query({ ... })
createTimeOff: builder.mutation({ ... })
deleteTimeOff: builder.mutation({ ... })
```

### 4.2 New Component: TaskTimelineView

**File:** `worklenz-frontend/src/components/schedule/task-timeline/TaskTimelineView.tsx`

**Key features:**
- Integrates `gantt-task-react` library
- Fetches tasks via `useFetchTaskTimelineQuery()`
- Handles drag-drop via `onDateChange` callback
- Calls `useUpdateTaskDatesMutation()` with optimistic updates
- ViewMode mapping: week → Day view, month → Week view
- Custom styling to match existing theme (dark/light)
- Socket.IO listener for real-time updates from other users

### 4.3 Data Transformation

**File:** `worklenz-frontend/src/components/schedule/task-timeline/taskTransformers.ts`

```typescript
// Transforms Worklenz task data to gantt-task-react format
function transformTasksToGanttFormat(tasks: Task[]): GanttTask[] {
  // Maps: id, name, start, end, progress, assignees, status
  // Adds custom styling based on status color
  // Handles subtask hierarchy via parent_task_id
}
```

### 4.4 Schedule Page Update

**File:** `worklenz-frontend/src/pages/schedule/schedule.tsx`

```tsx
// Add view toggle:
<Radio.Group value={viewMode} onChange={e => setViewMode(e.target.value)}>
  <Radio.Button value="project">Project View</Radio.Button>
  <Radio.Button value="task">Task View</Radio.Button>
</Radio.Group>

// Conditional rendering:
{viewMode === 'project' ? (
  <GranttChart ... /> // Existing
) : (
  <TaskTimelineView ... /> // NEW
)}
```

### 4.5 Time-Off Management UI

**File:** `worklenz-frontend/src/components/schedule/task-timeline/TimeOffCalendar.tsx`

- Modal with form: Select member, start date, end date, reason
- Display time-off entries in list
- Visual overlay on timeline showing blocked dates
- CRUD operations via RTK Query mutations

### 4.6 Filters Component

**File:** `worklenz-frontend/src/components/schedule/task-timeline/TaskTimelineFilters.tsx`

- Filter by: Project, Team Member, Status, Priority
- Date range picker
- Clear filters button

---

## 5. VIRTUALIZATION STRATEGY

**Good news:** `gantt-task-react` has built-in virtual rendering! No additional work needed.

**Performance targets:**
- 1000 tasks: 60 FPS scrolling
- 5000 tasks: 30 FPS scrolling
- Initial render: < 2 seconds

**Optimization hooks:**
- Use React.memo for custom task bar components
- Debounce scroll events
- Server-side pagination (load only tasks in visible date range)
- Lazy load subtasks (expand-on-demand)

---

## 6. REAL-TIME UPDATES (SOCKET.IO)

**Backend:** Emit `SCHEDULE_TASK_UPDATE` event when task dates change
**Frontend:** Listen for event, update RTK Query cache via `updateQueryData`

```tsx
socket.on(SocketEvents.SCHEDULE_TASK_UPDATE, (data) => {
  dispatch(scheduleApi.util.updateQueryData('fetchTaskTimeline',
    { teamId },
    (draft) => {
      const task = draft.find(t => t.id === data.task_id);
      if (task) {
        task.start_date = data.start_date;
        task.end_date = data.end_date;
      }
    }
  ));
});
```

---

## 7. VALIDATION & CONFLICT DETECTION

### Client-Side
- Validate: end_date > start_date
- Check time-off conflicts for assignees
- Check overallocation (multiple tasks same assignee)
- Show warnings (non-blocking)

### Server-Side
- Validate date range (400 error if invalid)
- Return warnings for conflicts (but still save)
- Log validation failures for monitoring

---

## 8. IMPLEMENTATION PHASES

### Phase 1: Backend Foundation (Week 1)
- ✅ Database migration: `member_time_off` table
- ✅ `TaskTimelineController` with GET tasks endpoint
- ✅ `TimeOffController` CRUD endpoints
- ✅ Router updates
- ✅ Unit tests

**Deliverable:** API endpoints ready

### Phase 2: Frontend Basic View (Week 2)
- ✅ View toggle in `schedule.tsx`
- ✅ `TaskTimelineView.tsx` component
- ✅ Integrate `gantt-task-react`
- ✅ Data fetching via RTK Query
- ✅ Basic drag-drop (no real-time yet)

**Deliverable:** Users can see task timeline

### Phase 3: Drag-Drop & Real-Time (Week 3)
- ✅ `updateTaskDates` mutation
- ✅ Optimistic updates
- ✅ Socket.IO handler + listener
- ✅ Validation & conflict warnings

**Deliverable:** Full drag-drop functionality

### Phase 4: Time-Off & Enhancements (Week 4)
- ✅ `TimeOffCalendar` component
- ✅ Time-off overlay on timeline
- ✅ Filters and grouping UI
- ✅ Performance testing (5k tasks)

**Deliverable:** Feature complete

### Phase 5: Testing & Polish (Week 5)
- ✅ End-to-end tests
- ✅ Performance profiling
- ✅ Accessibility (keyboard nav, screen readers)
- ✅ Cross-browser testing
- ✅ Documentation

**Deliverable:** Production-ready

---

## 9. CRITICAL FILES TO MODIFY/CREATE

### Backend (Create)
1. `worklenz-backend/src/controllers/schedule-v2/task-timeline-controller.ts` - Core task timeline logic
2. `worklenz-backend/src/controllers/schedule-v2/time-off-controller.ts` - Time-off CRUD
3. `worklenz-backend/src/socket.io/commands/on_schedule_task_drag_change.ts` - Real-time handler
4. `worklenz-backend/database/sql/migrations/add_member_time_off_table.sql` - Database schema

### Frontend (Create)
5. `worklenz-frontend/src/components/schedule/task-timeline/TaskTimelineView.tsx` - Main component
6. `worklenz-frontend/src/components/schedule/task-timeline/taskTransformers.ts` - Data transformation
7. `worklenz-frontend/src/components/schedule/task-timeline/TimeOffCalendar.tsx` - Time-off UI
8. `worklenz-frontend/src/components/schedule/task-timeline/TaskTimelineFilters.tsx` - Filters UI

### Frontend (Modify)
9. `worklenz-frontend/src/pages/schedule/schedule.tsx` - Add view toggle
10. `worklenz-frontend/src/api/schedule/scheduleApi.ts` - Add RTK Query endpoints

### Backend (Modify)
11. `worklenz-backend/src/routes/apis/gannt-apis/schedule-api-v2-router.ts` - Add routes

---

## 10. POTENTIAL CHALLENGES & SOLUTIONS

| Challenge | Solution |
|-----------|----------|
| **Performance with 5k+ tasks** | ✅ Built-in virtualization in `gantt-task-react`<br>✅ Server-side pagination (load visible range only)<br>✅ React.memo for custom components |
| **Real-time conflicts (2 users drag same task)** | ✅ Optimistic updates with rollback<br>✅ Last-write-wins strategy<br>✅ Notification to user if overridden |
| **Time zone handling** | ✅ Store all dates in UTC (already done)<br>✅ Convert to user timezone on frontend with `momentTime.tz()` |
| **Mobile responsiveness** | ✅ Disable drag-drop on mobile<br>✅ Provide alternative list view<br>✅ Horizontal scroll for dates |
| **Browser compatibility** | ✅ `gantt-task-react` uses standard React/SVG (cross-browser)<br>✅ Test on Chrome, Firefox, Safari, Edge |

---

## 11. TESTING STRATEGY

### Unit Tests
- Backend: Controllers (task queries, date updates, validation)
- Frontend: Components (rendering, drag events, data transformation)

### Integration Tests
- Full flow: Drag task → API call → Socket.IO → UI update
- Conflict detection: Time-off overlap warnings
- Filter functionality

### Performance Tests
- Render 1000 tasks in < 2 seconds
- Maintain 60 FPS scrolling with 5000 tasks

### E2E Tests (Cypress/Playwright)
- User flow: Switch to task view, drag task, verify update
- Real-time: Two browser tabs, one drags, other sees update

---

## 12. MONITORING & ANALYTICS

**Mixpanel Events:**
- `schedule_task_view_open` - User opens task timeline
- `schedule_task_drag` - User drags task
- `schedule_task_date_update` - Date update succeeds/fails
- `schedule_time_off_create` - Time-off entry created
- `schedule_conflict_detected` - Validation warning shown

**Performance Metrics:**
- Render time by task count
- API response times
- Socket.IO latency

**Error Tracking:**
- Sentry integration for failed API calls
- Tag errors with `feature: schedule_task_timeline`

---

## 13. ROLLOUT PLAN

1. **Internal Testing (Week 1-2):** Dev environment only
2. **Beta Users (Week 3):** Feature flag for select organizations
3. **Public Beta (Week 4):** Opt-in for all users
4. **General Availability (Week 5):** Default enabled

**Feature Flag:**
```typescript
FEATURE_FLAGS.TASK_TIMELINE_VIEW =
  process.env.REACT_APP_ENABLE_TASK_TIMELINE === 'true'
```

---

## Industry Research Sources

Based on research of leading PM tools:

**Jira Timeline:**
- Drag timeline bars to reschedule instantly
- Subtasks move with parent tasks
- Dependencies shown as connecting lines
- Real-time updates across team

**Asana Timeline:**
- Drag-and-drop tasks across timeline
- Dependencies auto-adjust
- Click timeline to create new task
- Milestones for project checkpoints

**Hello Bonsai (Key Insights for Worklenz):**
- **Resourcing Schedule View:** Comprehensive overview of team's project allocations with visual indicators for over-allocations
- **Drag-and-drop Timeline:** Shuffle bookings, stretch them, or split them in seconds
- **Workload View:** Unplanned tasks can be dragged into timeline based on team capacities (tasks must have assignee + due date)
- **Live Capacity Tracking:** Real-time view of under/over-utilization, automatically factors in part-timers and holidays
- **Instant Updates:** Any update to timeline/schedule/timesheet instantly reflected across platform
- **Visual Indicators:** Color-coded timelines, at-a-glance indicators for overcapacity or schedule conflicts
- **Reassignment:** Click allocation to reassign to different team member
- **Flexible Scheduling:** Adjust task start/due dates by dragging along timeline
- **Three Project Views:** Board, List, and Gantt (Premium tier includes Gantt + workload view)

**Key Learnings for Implementation:**
1. **Two-View System:** Separate "Resourcing Schedule" (project allocations) and "Workload View" (individual tasks)
2. **Capacity-First Design:** Always show capacity indicators and over/under-allocation warnings
3. **Drag Flexibility:** Support multiple drag operations - move, stretch, split, reassign
4. **Task Prerequisites:** Tasks need assignee + due date to appear in timeline
5. **Real-Time Sync:** All timeline updates instantly reflected everywhere
6. **Visual Hierarchy:** Color-coding for conflicts, capacity status, project ownership

**React Libraries:**
- `gantt-task-react` chosen for MIT license, TypeScript support, virtual rendering
- Alternatives: SVAR Gantt, React Modern Gantt, DHTMLX (commercial)

Sources:
- [Jira Timeline Features 2025](https://community.atlassian.com/forums/App-Central-articles/Jira-Timeline-in-2025-Key-Secrets-to-Manage-Projects-Visually/ba-p/2994659)
- [Asana Timeline View](https://asana.com/features/project-management/project-views)
- [Hello Bonsai Workload View](https://help.hellobonsai.com/en/articles/10458662-the-workload-view)
- [Hello Bonsai Resourcing Schedule](https://help.hellobonsai.com/en/articles/10548568-the-resourcing-schedule-view)
- [Bonsai Resource Management](https://www.hellobonsai.com/resource-management)
- [React Gantt Libraries](https://svar.dev/react/gantt/)
- [Activity Timeline Drag-Drop](https://help.activitytimeline.com/at/issue-scheduling-through-drag-n-drop)

---

## 14. ENHANCEMENTS INSPIRED BY HELLO BONSAI

Based on Hello Bonsai's implementation, here are recommended enhancements to incorporate:

### 14.1 Capacity-First Design

**Implementation:**
```tsx
// Show capacity bar above each team member's timeline
<CapacityIndicator
  totalHours={member.workingHours * daysInRange}
  allocatedHours={member.allocatedHours}
  loggedHours={member.loggedHours}
  status={member.capacityStatus} // 'under' | 'optimal' | 'over'
/>

// Color-code timeline background based on capacity
<TimelineRow style={{
  backgroundColor: getCapacityColor(member.utilizationPercent)
}}>
```

**Why:** Hello Bonsai shows capacity status instantly at a glance - critical for resource planning.

### 14.2 Task Prerequisites Filter

**Implementation:**
```typescript
// Only show tasks with both assignee AND due date
const validTasks = tasks.filter(task =>
  task.assignees?.length > 0 &&
  task.start_date &&
  task.end_date
);

// Display warning for invalid tasks
<Alert type="warning">
  {invalidTaskCount} tasks hidden (missing assignee or dates).
  <Link to="/tasks">Fix now</Link>
</Alert>
```

**Why:** Prevents timeline clutter with unschedulable tasks. Encourages proper task setup.

### 14.3 Unplanned Tasks Panel

**File:** `worklenz-frontend/src/components/schedule/task-timeline/UnplannedTasksPanel.tsx`

```tsx
// Left sidebar showing tasks without dates
<UnplannedTasksPanel>
  <TasksList
    tasks={unplannedTasks}
    onDragStart={handleDragUnplannedTask}
  />
</UnplannedTasksPanel>

// Users can drag unplanned tasks onto timeline to schedule them
const handleDropUnplannedTask = (task, date) => {
  updateTaskDates({
    taskId: task.id,
    start_date: date,
    end_date: calculateEndDate(date, task.estimated_hours),
  });
};
```

**Why:** Bonsai's workload view allows dragging unplanned tasks onto timeline - powerful scheduling workflow.

### 14.4 Reassignment via Click

**Implementation:**
```tsx
// Click task bar to open quick actions menu
const handleTaskBarClick = (task) => {
  showContextMenu([
    { label: 'Reassign', action: () => openReassignModal(task) },
    { label: 'Adjust dates', action: () => enableDragMode(task) },
    { label: 'Split task', action: () => openSplitModal(task) },
    { label: 'View details', action: () => openTaskDrawer(task) },
  ]);
};
```

**Why:** Bonsai allows quick reassignment with a click - faster than drag-drop for reassigning to non-adjacent members.

### 14.5 Holiday/Part-Time Auto-Adjustment

**Database Schema Addition:**
```sql
-- Add to team_members table (or create team_member_settings)
ALTER TABLE team_members
ADD COLUMN working_hours_per_day DECIMAL(4,2) DEFAULT 8.0,
ADD COLUMN is_part_time BOOLEAN DEFAULT FALSE;

-- Holiday calendar (shared across organization)
CREATE TABLE organization_holidays (
    id UUID PRIMARY KEY,
    team_id UUID NOT NULL,
    date DATE NOT NULL,
    name VARCHAR(255),
    UNIQUE(team_id, date)
);
```

**Capacity Calculation:**
```typescript
function calculateAvailableHours(member, startDate, endDate) {
  const days = getWorkingDays(startDate, endDate);
  let totalHours = 0;

  for (const day of days) {
    // Skip holidays
    if (isHoliday(day, member.team_id)) continue;

    // Skip member time-off
    if (isTimeOff(day, member.id)) continue;

    // Add working hours (accounts for part-time)
    totalHours += member.working_hours_per_day;
  }

  return totalHours;
}
```

**Why:** Bonsai automatically factors in part-timers and holidays - critical for accurate capacity planning.

### 14.6 Stretch/Split Operations

**Implementation:**
```tsx
// Extend task duration by dragging edges (already supported by gantt-task-react)
// Add split functionality:
const handleSplitTask = async (task, splitDate) => {
  // Create two allocations from one task
  const part1 = {
    ...task,
    end_date: splitDate,
  };

  const part2 = {
    ...task,
    start_date: addDays(splitDate, 1),
  };

  // Update via API
  await splitTaskAllocation({ taskId: task.id, splitDate });
};
```

**Why:** Bonsai allows "splitting" bookings - useful for interrupted work or shared capacity across multiple periods.

### 14.7 Real-Time Everywhere

**Socket.IO Events to Add:**
```typescript
// Emit on every timeline change
SocketEvents.TASK_DATES_CHANGED
SocketEvents.TASK_REASSIGNED
SocketEvents.CAPACITY_UPDATED
SocketEvents.TIME_OFF_ADDED
SocketEvents.TIME_OFF_REMOVED

// Listen and update RTK Query cache
socket.on(SocketEvents.TASK_DATES_CHANGED, (data) => {
  invalidateQueries(['TaskTimeline', 'Workload', 'Capacity']);
  showNotification(`${data.taskName} rescheduled by ${data.userName}`);
});
```

**Why:** Bonsai's instant sync across platform prevents conflicts and keeps everyone in sync.

---

## Summary

This plan leverages the existing `gantt-task-react` library already in the codebase to add a comprehensive task-level timeline view with:
- ✅ Individual task drag-and-drop scheduling
- ✅ Real-time updates via Socket.IO
- ✅ Manual time-off tracking
- ✅ Built-in virtualization for performance
- ✅ Filters and conflict detection
- ✅ Seamless integration with existing schedule feature

**Total estimated effort:** 5 weeks
**Risk level:** Low (using proven library, existing infrastructure)
**Impact:** High (matches Jira/Asana capabilities)

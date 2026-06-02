# Task Creation Restriction Feature

**Business Plan Feature** · Last reviewed: June 2026

---

## Overview

The Task Creation Restriction feature lets project administrators limit who can create tasks, edit task names, assign members, and modify task details within a project. When enabled, only users with the **Owner**, **Admin**, or **Team Lead** role can perform write operations. Regular **Team Members** see the UI in a read-only/disabled state.

This restriction can be enabled at two levels:

| Level | Where configured | Scope |
|---|---|---|
| **Project-level** | Project Drawer → Advanced Settings | Affects only that project |
| **Org-level** | Admin Center → Org Configuration | Affects all projects in the organisation |

Project-level takes priority: if a project explicitly sets `restrict_task_creation = true`, the restriction applies regardless of the org setting.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  PROJECT DRAWER (Admin sets restrict_task_creation = true)    │
│  PUT /api/v1/projects/:id  →  update_project() SQL function   │
│  → projects.restrict_task_creation = true persisted in DB     │
└──────────────────────────────────────────────────────────────┘
              │ page.reload() after save
              ▼
┌──────────────────────────────────────────────────────────────┐
│  PROJECT VIEW loads                                           │
│  GET /api/v1/projects/:id  →  getById() controller           │
│  → restrict_task_creation returned in project payload         │
│  → stored in Redux: state.projectReducer.project              │
└──────────────────────────────────────────────────────────────┘
              │
              ▼
┌──────────────────────────────────────────────────────────────┐
│  useTaskCreationPermission() hook                             │
│  Reads: state.projectReducer.project.restrict_task_creation   │
│  Reads: state.orgConfigReducer.restrict_task_creation         │
│  Checks: user role (Owner / Admin / Team Lead = privileged)   │
│  Returns: { canCreateTask: boolean, isRestricted: boolean }   │
└──────────────────────────────────────────────────────────────┘
              │
              ▼ canCreateTask propagated to all UI components
┌──────────────────────────────────────────────────────────────┐
│  UI ENFORCEMENT (disabled/hidden controls)                    │
│  Task List · Kanban Board · Task Drawer · Bulk Action Bar     │
└──────────────────────────────────────────────────────────────┘
              │ if user bypasses UI (direct socket/API call)
              ▼
┌──────────────────────────────────────────────────────────────┐
│  SERVER ENFORCEMENT                                           │
│  is_task_creation_restricted(userId, projectId) DB function   │
│  checked in: tasks-controller, on-quick-task,                 │
│  on-task-assignees-change, on-quick-assign-or-remove          │
└──────────────────────────────────────────────────────────────┘
```

---

## Database

### Column

```sql
-- Table: projects
restrict_task_creation BOOLEAN DEFAULT FALSE
```

### PostgreSQL Helper Function

All server-side enforcement goes through a single DB function:

```sql
is_task_creation_restricted(user_id UUID, project_id UUID) RETURNS BOOLEAN
```

This function checks:
1. Is the user on a Business plan?
2. Is `restrict_task_creation = true` on the project **OR** on the organisation?
3. Is the user's role NOT `OWNER`, `ADMIN`, or `TEAM_LEAD`?

Returns `TRUE` only when all three are satisfied — meaning the user is restricted.

### Org-level Column

```sql
-- Table: organizations
restrict_task_creation BOOLEAN DEFAULT FALSE
```

---

## Backend

### Saving the Setting

**Route:** `PUT /api/v1/projects/:id`
**Middleware:** `projectManagerValidator` (only project managers and admins can reach this route)
**Controller:** `ProjectsController.update`

The entire `req.body` is passed as JSON to the `update_project($1)` PostgreSQL function. The function reads `restrict_task_creation` from the JSON and writes it to `projects.restrict_task_creation`. No explicit field extraction is needed on the Node.js side.

```typescript
// projects-controller.ts → update()
const q = `SELECT update_project($1) AS project;`;
const result = await db.query(q, [JSON.stringify(req.body)]);
// req.body.restrict_task_creation is included automatically
```

### Reading the Setting

**Route:** `GET /api/v1/projects/:id`
**Controller:** `ProjectsController.getById`

The query selects `projects.restrict_task_creation` along with all other project fields and returns it in the response payload. The frontend stores this in `state.projectReducer.project`.

```sql
-- Snippet from getById query:
projects.restrict_task_creation,
```

### Server-Side Enforcement Points

The restriction is checked server-side at every write entry point. This prevents bypasses via direct API/socket calls.

#### 1. HTTP Task Creation — `TasksController.create`
```typescript
// tasks-controller.ts
const restrictResult = await db.query(
  "SELECT is_task_creation_restricted($1, $2) AS restricted;",
  [userId, projectId]
);
if (restrictResult.rows[0]?.restricted === true) {
  return res.status(403).send(
    new ServerResponse(false, null, "Task creation is restricted...")
  );
}
```

#### 2. Socket Task Creation — `on_quick_task`
```typescript
// on-quick-task.ts
const restricted = await isTaskCreationRestricted(userId, body.project_id);
if (restricted) {
  socket.emit(SocketEvents.QUICK_TASK.toString(), {
    error: true,
    message: "Task creation is restricted..."
  });
  return;
}
```

#### 3. Socket Assignee Change — `on_task_assignees_change`
```typescript
// on-task-assignees-change.ts
const restricted = await isTaskCreationRestricted(userId, body.project_id);
if (restricted) {
  socket.emit(SocketEvents.TASK_ASSIGNEES_CHANGE.toString(), {
    error: true,
    message: "Task assignment is restricted to Admins and Team Leads only."
  });
  return;
}
```

#### 4. Socket Quick Assign/Remove — `on_quick_assign_or_remove`
```typescript
// on-quick-assign-or-remove.ts — only blocks new assignments (mode == 0)
if (isAssign && userId) {
  const restrictResult = await db.query(
    "SELECT is_task_creation_restricted($1, $2) AS restricted;",
    [userId, projectId]
  );
  if (restrictResult.rows[0]?.restricted === true) {
    socket.emit(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), {
      error: true,
      message: "Task assignment is restricted..."
    });
    return;
  }
}
```

> **Note:** Unassignment (`mode == 1`) is not blocked — a restricted user can still remove themselves from a task.

### Org-Level Configuration

**Route:** `GET /api/v1/org-configuration` / `PUT /api/v1/org-configuration`
**Controller:** `OrgConfigurationController`

Reads and writes `organizations.restrict_task_creation`. The `is_task_creation_restricted` DB function checks this table as a fallback when the project-level flag is `false`.

---

## Frontend

### Core Hook — `useTaskCreationPermission`

**File:** `src/hooks/useTaskCreationPermission.ts`

This is the single source of truth for the permission on the frontend.

```typescript
const useTaskCreationPermission = (
  projectOverride?: { restrict_task_creation?: boolean } | null
): ITaskCreationPermission => {
  // Reads from Redux
  const reduxProject = useAppSelector(state => state.projectReducer.project);
  const orgConfig   = useAppSelector(state => state.orgConfigReducer);

  return useMemo(() => {
    // 1. Free plan → no restriction
    if (!hasBusinessFeatureAccess(session)) {
      return { canCreateTask: true, isRestricted: false };
    }

    // 2. Check project-level OR org-level restriction
    const projectRestricted = project?.restrict_task_creation ?? false;
    const orgRestricted     = orgConfig?.restrict_task_creation ?? false;
    const isRestricted      = projectRestricted || orgRestricted;

    if (!isRestricted) return { canCreateTask: true, isRestricted: false };

    // 3. If restricted, only privileged roles can create
    const roleName    = getSessionRoleName(session);
    const isPrivileged = [ROLE_NAMES.OWNER, ROLE_NAMES.ADMIN, ROLE_NAMES.TEAM_LEAD]
      .includes(roleName);

    return { canCreateTask: isPrivileged, isRestricted: true };
  }, [session, reduxProject, orgConfig, projectOverride]);
};
```

**`projectOverride` parameter:** Allows passing a project object directly when outside the normal Redux project context (e.g., when viewing another project's data). If omitted, the Redux project state is used.

**Returns:**
- `canCreateTask` — `true` if the user can create/edit tasks in this project
- `isRestricted` — `true` if the restriction toggle is on (regardless of user role; useful for showing upgrade banners)

### UI Enforcement Map

`canCreateTask` is consumed across every view. The table below shows what is disabled vs. hidden in each location.

#### Task List (`TaskListV2Table.tsx` / `TitleColumn.tsx` / `useTaskRowColumns.tsx`)

| Element | `canCreateTask = false` behaviour |
|---|---|
| Add Task row | **Hidden** entirely |
| Insert Task divider | **Hidden** entirely |
| Task name span (inline edit) | **Blocked** (click does nothing, cursor: default) |
| Example task rows (empty group) | **Blocked** (click does nothing) |
| Start Date / Due Date column | **Disabled** (opacity 0.4, DatePicker blocked) |
| Due Time column | **Disabled** (TimePicker `disabled`) |
| Time Estimation column | **Disabled** (Popover trigger removed) |
| Assignees column | **Disabled** (AssigneeSelector `disabled`) |
| Add Subtask button | **Hidden** |

#### Context Menu (`TaskContextMenu.tsx`)

| Item | `canCreateTask = false` behaviour |
|---|---|
| Assign to Me | **Always active** (read: the current user can always assign themselves) |
| Copy Link | **Always active** (read-only action) |
| Move To submenu | **Always active** (status/priority change not restricted) |
| Duplicate Task | **Disabled** (opacity 0.4, click blocked) |
| Archive / Unarchive | **Disabled** |
| Convert to Sub Task | **Disabled** |
| Convert to Task | **Disabled** |
| Delete | **Disabled** |

#### Bulk Action Bar (`optimized-bulk-action-bar.tsx`)

| Action | `canCreateTask = false` behaviour |
|---|---|
| Change Status | **Always active** |
| Change Priority | **Always active** |
| Change Phase | **Always active** |
| Change Labels | **Always active** |
| Assign to Me | **Always active** |
| Change Assignees | **Disabled** |
| Set Start Date | **Disabled** |
| Set Due Date | **Disabled** |
| Archive | **Disabled** |
| Delete | **Disabled** |

#### Kanban Board (`TaskCard.tsx`)

| Element | `canCreateTask = false` behaviour |
|---|---|
| Due date click | **Blocked** (cursor: default, no handler) |
| Assignee selector (task) | **Disabled** via `LazyAssigneeSelectorWrapper` |
| Assignee selector (subtask) | **Disabled** via `LazyAssigneeSelectorWrapper` |
| Archive context menu item | **Disabled** |
| Delete context menu item | **Disabled** |
| Add task button (KanbanGroup) | **Hidden** |

#### Task Drawer (`task-drawer.tsx` / `task-drawer-title-section.tsx` / `task-details-form.tsx`)

| Element | `canCreateTask = false` behaviour |
|---|---|
| Task name (click to edit) | **Blocked** (returns early, cursor: default) |
| Due Date + Start Date pickers | **Disabled** (`DatePicker disabled`) |
| Show/Hide Start Date button | **Always active** (user can view start date, just not edit it) |
| Due Time picker | **Disabled** (`TimePicker disabled`) |
| Time Estimation inputs | **Disabled** (`InputNumber disabled`) |
| Billable switch | **Disabled** |
| Recurring switch | **Disabled** |
| Notify member selector | **Disabled** (Dropdown trigger blocked) |
| Add Dependency button | **Disabled** |
| Delete dependency button | **Disabled** |

#### Project Tabs (`project-view-constants.ts` / `project-view.tsx`)

| Tab | `canCreateTask = false` behaviour |
|---|---|
| Roadmap | **Hidden** entirely from the tab bar |
| All other tabs | Unaffected |

#### Project Header (`project-view-header.tsx`)

The "Add Task" button in the project header is hidden when `!canCreateTask`.

### `LazyAssigneeSelectorWrapper`

**File:** `src/components/task-management/lazy-assignee-selector.tsx`

Added `disabled` prop. When `disabled = true`:
- The trigger button shows `opacity: 0.4` and `cursor: not-allowed`
- Click and hover events are suppressed — the full `AssigneeSelector` is never lazy-loaded
- The `disabled` attribute prevents all browser interaction

---

## Configuration UI

### Project-Level (Advanced Settings tab)

Found in: **Project Drawer → Advanced Settings → Access Control**

```
[Switch] Restrict task assignment to Admins and Team Leads
```

- Switch is disabled for free-plan users (shows upgrade alert)
- Switch is disabled for non-project-managers / non-admins
- When toggled and saved, `restrict_task_creation` is persisted via `PUT /api/v1/projects/:id`
- A full page reload happens after save, which re-fetches project data and immediately applies the new permission

### Org-Level

Found in: **Admin Center → Organisation Configuration**

Applies the restriction across all projects that don't have their own project-level override.

---

## Permission Matrix

| User Role | `restrict_task_creation = false` | `restrict_task_creation = true` |
|---|---|---|
| **Owner** | `canCreateTask = true` | `canCreateTask = true` |
| **Admin** | `canCreateTask = true` | `canCreateTask = true` |
| **Team Lead** | `canCreateTask = true` | `canCreateTask = true` |
| **Member** | `canCreateTask = true` | `canCreateTask = false` |
| Free plan (any role) | `canCreateTask = true` | `canCreateTask = true` *(plan gating)* |

---

## Known Gaps / Considerations

1. **`on_quick_task` via Gantt drag** — Task creation from Gantt drag (`body.is_dragged`) goes through `on_quick_task` which correctly enforces the restriction. ✅

2. **Unassignment not blocked** — `on_quick_assign_or_remove` only blocks new assignments (`mode == 0`). Restricted users can still remove assignees. This is intentional — a member should always be able to unassign themselves.

3. **No real-time restriction propagation** — When an admin enables the restriction while other users have the project open, those users will not see the restriction take effect until they reload the page. There is no socket event for `restrict_task_creation` changes.

4. **Org-level restriction not surfaced in project UI** — If the restriction is enabled org-wide but not project-level, the project drawer Advanced Settings switch will appear OFF (because it reads the project flag, not the org flag). The effective restriction still applies via `useTaskCreationPermission` which checks both.

5. **Gantt (Roadmap) tab hidden for restricted users** — The roadmap tab is completely removed from the tab bar when `canCreateTask = false`. This is a conservative choice — a read-only Gantt view would technically be acceptable for restricted users, but the current implementation hides it entirely.

6. **`assignMemberIfNot` bypass** — The `assignMemberIfNot` helper in `on-quick-assign-or-remove.ts` (used by `auto_assign_task_creator`) calls `on_quick_assign_or_remove` directly. If `auto_assign_task_creator` is enabled alongside `restrict_task_creation`, the restriction check inside `on_quick_assign_or_remove` would block auto-assignment for restricted users even when the system is trying to auto-assign. This edge case should be reviewed.

# Release Notes — v2.4.1

## What's New in v2.4.1 — June 03, 2026

### Task List Enhancements
- **In-list description editing** — Add or modify task descriptions directly from the task list by clicking the description cell
- **Auto-save** — Tasks save automatically when clicking outside the input field; pressing Enter saves and opens a new input row
- **Inline name editing** — Task names can be edited directly in the list row even while the task drawer remains open

### Task Drawer
- **Drag-and-drop file attachment** — Drop files anywhere within the drawer, not just on the upload icon

### Recurring Tasks
- **Behaviour control** — Choose whether recurring tasks create new copies or update the existing task's status at each recurrence

### Import
- **Subtask preservation** — Subtasks now import correctly as nested items under their parent tasks rather than becoming standalone tasks

### Client Portal
- **Time log visibility** — Clients can view logged time for individual tasks and overall projects

### Reporting: Efficiency Report *(new)*
A new **Efficiency** report is available under **Reporting → Time Reports**.

Shows how actual logged time compares to task estimates, grouped by Member, Team, Project, or Company.

- Switch between **Budget %** (logged ÷ estimated) and **Efficiency %** (estimated ÷ logged) calculation modes
- Toggle display between **h/min** and **Man Days** (8 h = 1 day)
- Preset date range selector: Last 7 days, Last 30 days, This/Last month, Last 3/6 months
- Filter by team and project; export to Excel

### Reporting: Month-End Summary *(new)*
A new **Month-End Summary** report is available under **Reporting**, between Tasks and Time Reports.

Month-by-month view of team performance across logged hours, completed tasks, and budget vs actual time.

- KPIs: Logged Hours, Tasks Completed, Budget (man days), Actual (man days), Variance, Efficiency
- Per-member and per-project breakdown with Budget, Actual, Variance, and Efficiency columns
- Filter by month, team, and project; export to Excel

### Other Improvements
- UI refinements including a streamlined task drawer header and improved empty state messaging for project templates
- Enhanced dark mode visibility

### Bug Fixes
48+ fixes resolving issues across task list and board operations, task drawer functionality, recurring task scheduling, project navigation and sidebar behaviour, reports access and functionality, member seat count accuracy, client portal authentication, and dark mode contrast.

---

## What's New in v2.4.0 — May 18, 2026

### Task List & Keyboard Navigation
- **Auto-focus next task** — Pressing Enter after saving a task name immediately opens a new input below, enabling rapid sequential task creation; Escape to exit
- **Insert tasks between items** — Hover over divider lines between tasks to reveal a plus button that creates a task at that exact position
- **Seamless drawer navigation** — Clicking different task rows while the drawer is open switches its content instantly
- **Drawer syncs with new tasks** — Creating a task while a drawer is open switches the drawer to preview the new item
- **Inline estimate entry** — Estimate time can be entered directly from task list rows
- **Custom field visibility control** — Custom field columns appear in column visibility settings for per-project toggling without data loss
- **Collapsed description preview** — Long descriptions display as a 6–8 line preview with a "View all" expansion option

### Board View
- **Collapsible Kanban columns** — Any column can collapse to a narrow labelled strip, reducing visual clutter while keeping all columns visible

### Task Drawer
- **Comment editing** — Comments in the Updates section can be edited post-publication with "edited" indicators
- **Redesigned selectors** — Notify and Label selection interfaces have improved layouts and keyboard navigation

### Projects & Reporting
- **Finance settings accessibility** — Budget and billing rate configurations are accessible directly from the project settings drawer
- **Category-wise project overview** — Reports display projects grouped by category with task distribution and progress metrics

### Other Improvements
- Defined access levels for Team Lead, Member, and Admin roles
- Password validation — new passwords must differ from current ones
- Settings tabs grouped into logical categories
- Tasks Report supports filtering by Phase and Client
- Expanded "Add New Task" clickable area spanning the full task name column
- Kanban board priority tooltips on hover

### Bug Fixes
50+ fixes addressing recurring task creation failures, status renaming reordering, bulk operations, UI jitter during drag, roadmap zoom reversal, pagination issues, client portal file upload timeouts, and numerous UI rendering inconsistencies.

---

*Previous changelog entries: [v2.4.0](https://worklenz.com/changelog/task-navigation-kanban-column-controls--50-fixes-v2-4-0/) · [v2.4.1](https://worklenz.com/changelog/task-workflows-recurring-task-controls--48-fixes-v2-4-1/)*

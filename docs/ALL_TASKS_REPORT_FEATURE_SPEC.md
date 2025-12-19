# All Tasks Report - Feature Specification

## Overview

This document outlines the feature specification for an **Organization-wide All Tasks View** within the Worklenz Reporting module. This feature addresses user requests for a centralized location to view, filter, and analyze all tasks across the entire organization.

---

## Competitor Analysis

### ClickUp - "Everything View"
- **Concept**: Birds-eye view of all tasks across every level of the organization
- **Key Features**:
  - Tasks organized by status from parent Spaces, Folders, or Lists
  - Can be filtered, sorted, and saved for any need
  - Supports multiple view layouts (List, Board, Calendar, etc.)
  - Cross-departmental and cross-functional collaboration visibility

### Asana - "Advanced Search & Reporting"
- **Concept**: Powerful search with saveable reports
- **Key Features**:
  - Filter by collaborators, custom fields, date ranges
  - Search across entire workspace
  - Save frequent searches as reports
  - Filter by teams, projects, priority custom fields
  - Completed vs incomplete task filtering

### Monday.com - "My Work & Board Filters"
- **Concept**: Cross-board task visibility with advanced filtering
- **Key Features**:
  - Filter by assignee, priority, status
  - Advanced filters with AND/OR logic
  - Cross-board automations and views
  - Group by status across boards

### Teamwork.com - "Everything" Area
- **Concept**: All active tasks across all projects in one view
- **Key Features**:
  - Filter by start/due date periods
  - Filter by assignees, tags
  - Filter by who assigned tasks (assigned by you, anyone, following)
  - Sort by start date, due date, date added, project, priority, company
  - Bulk edit tasks across multiple projects

### Notion - Database Views
- **Concept**: Flexible database views with powerful filtering
- **Key Features**:
  - Multiple view types (Table, Board, Timeline, Calendar, List, Gallery, Chart)
  - Advanced filters with AND/OR logic (nested up to 3 levels)
  - Group by any property
  - Sort by multiple properties
  - Save views for different use cases

### Jira - Cross-Project Reporting
- **Concept**: Multi-project visibility with resource planning
- **Key Features**:
  - Cross-project boards with board filters
  - Group issues by different characteristics (Priority, Project, etc.)
  - Team-based filtering
  - Project Resources Report for allocation tracking

---

## Proposed Feature: All Tasks Report

### Location in Worklenz
**Path**: `Reporting > All Tasks`

This will be a new top-level item in the reporting sidebar, positioned after "Members" and before "Time Reports".

```
Reporting
├── Overview
├── Projects
├── Members
├── All Tasks (NEW)
└── Time Reports
    ├── Overview
    ├── Projects
    ├── Members
    ├── Estimate vs Actual
    └── Logs
```

---

## Data Columns (Table Fields)

### Core Task Information
| Column | Description | Sortable | Default Visible |
|--------|-------------|----------|-----------------|
| Task Name | Task title with subtask indicator | ✅ | ✅ |
| Task Key | Unique task identifier (e.g., PROJ-123) | ✅ | ❌ |
| Project | Project name with color badge | ✅ | ✅ |
| Status | Task status with color tag | ✅ | ✅ |
| Priority | Task priority with color tag | ✅ | ✅ |
| Assignees | Team members assigned | ❌ | ✅ |

### Dates & Time
| Column | Description | Sortable | Default Visible |
|--------|-------------|----------|-----------------|
| Start Date | Task start date | ✅ | ❌ |
| Due Date | Task end/due date | ✅ | ✅ |
| Created Date | When task was created | ✅ | ❌ |
| Completed Date | When task was completed | ✅ | ❌ |
| Last Updated | Last modification date | ✅ | ❌ |
| Days Overdue | Number of days past due | ✅ | ✅ |

### Time Tracking
| Column | Description | Sortable | Default Visible |
|--------|-------------|----------|-----------------|
| Estimated Time | Total estimated hours/minutes | ✅ | ✅ |
| Logged Time | Time spent on task | ✅ | ✅ |
| Overlogged Time | Time exceeding estimate | ✅ | ❌ |

### Additional Metadata
| Column | Description | Sortable | Default Visible |
|--------|-------------|----------|-----------------|
| Phase | Project phase | ✅ | ❌ |
| Labels | Task labels/tags | ❌ | ❌ |
| Progress | Task completion percentage | ✅ | ❌ |
| Subtasks Count | Number of subtasks | ✅ | ❌ |
| Comments Count | Number of comments | ✅ | ❌ |
| Attachments | Number of attachments | ✅ | ❌ |
| Reporter/Creator | Who created the task | ✅ | ❌ |
| Billable | Whether task is billable | ✅ | ❌ |

---

## Filters

### Primary Filters (Always Visible)

#### 1. Team Filter
- Multi-select dropdown
- Filter tasks by team membership
- "Select All" / "Deselect All" options

#### 2. Project Filter
- Multi-select dropdown with search
- Shows project name with color indicator
- Filter by one or multiple projects
- Option to include/exclude archived projects

#### 3. Status Filter
- Multi-select dropdown
- Group by status categories: Todo, Doing, Done
- Filter by specific statuses across all projects

#### 4. Priority Filter
- Multi-select dropdown
- Filter by priority levels (High, Medium, Low, etc.)

#### 5. Assignee Filter
- Multi-select dropdown with search
- Filter by team members
- Special options:
  - "Unassigned" - tasks with no assignee
  - "Assigned to me" - current user's tasks

#### 6. Date Range Filter
- Preset options:
  - Today
  - This Week
  - This Month
  - This Quarter
  - Last 7 Days
  - Last 30 Days
  - Last 90 Days
  - Custom Range
- Apply to: Due Date, Start Date, Created Date, or Completed Date

### Secondary Filters (Expandable/Advanced)

#### 7. Labels Filter
- Multi-select dropdown
- Filter by task labels

#### 8. Phase Filter
- Multi-select dropdown
- Filter by project phases

#### 9. Task Type Filter
- Options:
  - All Tasks
  - Parent Tasks Only
  - Subtasks Only

#### 10. Completion Status Filter
- Options:
  - All
  - Incomplete Only
  - Completed Only
  - Overdue Only

#### 11. Time Tracking Filter
- Options:
  - All Tasks
  - With Time Logged
  - Without Time Logged
  - Over Estimated Time

#### 12. Billable Filter
- Options:
  - All
  - Billable Only
  - Non-Billable Only

#### 13. Project Category Filter
- Multi-select dropdown
- Filter by project categories

#### 14. Project Health Filter
- Options: On Track, At Risk, Off Track

#### 15. Project Status Filter
- Options: Active, Completed, On Hold, Cancelled

#### 16. Archived Filter
- Toggle to include/exclude archived tasks

---

## Sort Options

### Sortable Fields
Users can sort by any sortable column (ascending/descending):

1. **Task Name** - Alphabetical
2. **Project** - Alphabetical by project name
3. **Status** - By status order/category
4. **Priority** - By priority level (High → Low or Low → High)
5. **Due Date** - Chronological
6. **Start Date** - Chronological
7. **Created Date** - Chronological
8. **Completed Date** - Chronological
9. **Last Updated** - Chronological
10. **Days Overdue** - Numeric
11. **Estimated Time** - Numeric
12. **Logged Time** - Numeric
13. **Progress** - Percentage

### Default Sort
- **Primary**: Due Date (Ascending) - Nearest due first
- **Secondary**: Priority (Descending) - Highest priority first

### Multi-column Sort
Allow users to set primary and secondary sort criteria.

---

## Group By Options

Users can group tasks by:

| Group By | Description |
|----------|-------------|
| None | Flat list of all tasks |
| Project | Group tasks under their projects |
| Status | Group by task status |
| Priority | Group by priority level |
| Assignee | Group by assigned team member |
| Due Date | Group by due date (Today, This Week, This Month, Later, No Due Date) |
| Phase | Group by project phase |
| Team | Group by team |
| Project Category | Group by project category |

### Group Display
- Collapsible groups with expand/collapse all
- Show task count per group
- Show aggregate stats per group (optional):
  - Total estimated time
  - Total logged time
  - Completion percentage

---

## View Modes

### 1. Table View (Default)
- Spreadsheet-like view with sortable columns
- Column visibility toggle
- Column reordering (drag & drop)
- Sticky first column (Task Name)
- Horizontal scroll for many columns

### 2. Board View (Kanban)
- Cards grouped by Status (default) or other grouping
- Drag & drop between groups (if permissions allow)
- Card shows: Task name, project, assignees, due date, priority

### 3. List View
- Compact list with essential info
- Quick inline actions
- Expandable rows for more details

---

## Additional Features

### Search
- Global search bar
- Search by task name, description, task key
- Real-time filtering as user types

### Export Options
- Export to CSV
- Export to Excel
- Export to PDF (formatted report)

### Saved Views
- Save current filter/sort/group configuration
- Name and manage saved views
- Quick switch between saved views
- Share saved views with team (future enhancement)

### Quick Actions
- Click task to open task drawer
- Bulk selection with checkboxes
- Bulk actions on selected tasks:
  - Change status
  - Change priority
  - Assign/unassign members
  - Add labels
  - Archive tasks

### Pagination
- Default: 50 tasks per page
- Options: 25, 50, 100, 200
- Total count display
- Page navigation

### Real-time Updates
- WebSocket integration for live updates
- Show indicator when data has changed
- Option to auto-refresh or manual refresh

---

## Summary Statistics (Header Cards)

Display key metrics at the top of the page:

| Stat | Description |
|------|-------------|
| Total Tasks | Count of all tasks matching filters |
| Completed | Count and percentage of completed tasks |
| In Progress | Count of tasks in "Doing" status |
| Overdue | Count of overdue tasks |
| Unassigned | Count of tasks without assignees |
| Due This Week | Tasks due within current week |

---

## Permissions & Access Control

### Visibility Rules
- Users see tasks based on their project access
- Team leads see tasks for their team members
- Admins/Owners see all organization tasks
- Respect project-level permissions

### Action Permissions
- Edit actions require appropriate project permissions
- Bulk actions respect individual task permissions
- Export may be restricted by role

---

## Technical Considerations

### API Endpoint
New endpoint: `GET /api/reporting/all-tasks`

### Query Parameters
```typescript
interface IAllTasksReportRequest {
  // Pagination
  page: number;
  pageSize: number;
  
  // Sorting
  sortField: string;
  sortOrder: 'asc' | 'desc';
  
  // Filters
  teams?: string[];
  projects?: string[];
  statuses?: string[];
  priorities?: string[];
  assignees?: string[];
  labels?: string[];
  phases?: string[];
  
  // Date filters
  dateField?: 'due_date' | 'start_date' | 'created_at' | 'completed_at';
  dateFrom?: string;
  dateTo?: string;
  
  // Additional filters
  includeArchived?: boolean;
  includeSubtasks?: boolean;
  completionStatus?: 'all' | 'completed' | 'incomplete' | 'overdue';
  billable?: 'all' | 'billable' | 'non-billable';
  
  // Search
  search?: string;
  
  // Grouping
  groupBy?: string;
}
```

### Response Structure
```typescript
interface IAllTasksReportResponse {
  data: IProjectTask[];
  total: number;
  page: number;
  pageSize: number;
  stats: {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    overdueTasks: number;
    unassignedTasks: number;
    dueThisWeek: number;
  };
  groups?: ITaskGroup[]; // If grouped
}
```

### Performance Considerations
- Server-side pagination (mandatory for large datasets)
- Indexed database queries on filter fields
- Caching for frequently accessed data
- Lazy loading for expandable groups
- Virtual scrolling for large result sets

---

## UI/UX Guidelines

### Design Principles
1. **Consistency**: Follow existing Worklenz reporting patterns
2. **Performance**: Fast initial load, responsive filtering
3. **Accessibility**: Keyboard navigation, screen reader support
4. **Theme Support**: Full dark/light mode compatibility
5. **Responsive**: Works on desktop, tablet, mobile

### Loading States
- Skeleton loaders for initial load
- Spinner overlay for filter changes
- Progressive loading for large datasets

---

## Localization (i18next)

### Translation Namespace
Create new translation file: `reporting-all-tasks.json`

**Location**: `public/locales/{lang}/reporting-all-tasks.json`

Supported languages should match existing Worklenz locales (e.g., `en`, and any other configured languages).

### Required Translation Keys

```json
{
  // Page Header
  "pageTitle": "All Tasks",
  "pageDescription": "View all tasks across your organization",
  
  // Search
  "searchPlaceholder": "Search by task name, key, or description",
  
  // Filters - Labels
  "filtersTitle": "Filters",
  "teamsFilter": "Teams",
  "projectsFilter": "Projects",
  "statusFilter": "Status",
  "priorityFilter": "Priority",
  "assigneeFilter": "Assignee",
  "dateRangeFilter": "Date Range",
  "labelsFilter": "Labels",
  "phaseFilter": "Phase",
  "taskTypeFilter": "Task Type",
  "completionFilter": "Completion Status",
  "timeTrackingFilter": "Time Tracking",
  "billableFilter": "Billable",
  "categoryFilter": "Category",
  "healthFilter": "Health",
  "projectStatusFilter": "Project Status",
  "archivedFilter": "Include Archived",
  
  // Filter Options
  "allTeams": "All Teams",
  "allProjects": "All Projects",
  "allStatuses": "All Statuses",
  "allPriorities": "All Priorities",
  "allAssignees": "All Assignees",
  "unassigned": "Unassigned",
  "assignedToMe": "Assigned to me",
  "selectAll": "Select All",
  "clearAll": "Clear All",
  
  // Date Range Options
  "today": "Today",
  "thisWeek": "This Week",
  "thisMonth": "This Month",
  "thisQuarter": "This Quarter",
  "last7Days": "Last 7 Days",
  "last30Days": "Last 30 Days",
  "last90Days": "Last 90 Days",
  "customRange": "Custom Range",
  "applyToField": "Apply to",
  "dueDateField": "Due Date",
  "startDateField": "Start Date",
  "createdDateField": "Created Date",
  "completedDateField": "Completed Date",
  
  // Task Type Options
  "allTasks": "All Tasks",
  "parentTasksOnly": "Parent Tasks Only",
  "subtasksOnly": "Subtasks Only",
  
  // Completion Status Options
  "all": "All",
  "incompleteOnly": "Incomplete Only",
  "completedOnly": "Completed Only",
  "overdueOnly": "Overdue Only",
  
  // Time Tracking Options
  "withTimeLogged": "With Time Logged",
  "withoutTimeLogged": "Without Time Logged",
  "overEstimatedTime": "Over Estimated Time",
  
  // Billable Options
  "billableOnly": "Billable Only",
  "nonBillableOnly": "Non-Billable Only",
  
  // Table Columns
  "taskNameColumn": "Task",
  "taskKeyColumn": "Key",
  "projectColumn": "Project",
  "statusColumn": "Status",
  "priorityColumn": "Priority",
  "assigneesColumn": "Assignees",
  "startDateColumn": "Start Date",
  "dueDateColumn": "Due Date",
  "createdDateColumn": "Created",
  "completedDateColumn": "Completed",
  "lastUpdatedColumn": "Last Updated",
  "daysOverdueColumn": "Days Overdue",
  "estimatedTimeColumn": "Estimated",
  "loggedTimeColumn": "Logged",
  "overloggedTimeColumn": "Overlogged",
  "phaseColumn": "Phase",
  "labelsColumn": "Labels",
  "progressColumn": "Progress",
  "subtasksCountColumn": "Subtasks",
  "commentsCountColumn": "Comments",
  "attachmentsColumn": "Attachments",
  "reporterColumn": "Reporter",
  "billableColumn": "Billable",
  
  // Sort Options
  "sortBy": "Sort by",
  "ascending": "Ascending",
  "descending": "Descending",
  
  // Group By Options
  "groupBy": "Group by",
  "noGrouping": "None",
  "groupByProject": "Project",
  "groupByStatus": "Status",
  "groupByPriority": "Priority",
  "groupByAssignee": "Assignee",
  "groupByDueDate": "Due Date",
  "groupByPhase": "Phase",
  "groupByTeam": "Team",
  "groupByCategory": "Category",
  
  // Due Date Groups
  "dueToday": "Due Today",
  "dueThisWeek": "Due This Week",
  "dueThisMonth": "Due This Month",
  "dueLater": "Due Later",
  "noDueDate": "No Due Date",
  
  // View Modes
  "viewMode": "View",
  "tableView": "Table",
  "boardView": "Board",
  "listView": "List",
  
  // Show Fields
  "showFields": "Show Fields",
  
  // Statistics Cards
  "totalTasks": "Total Tasks",
  "completedTasks": "Completed",
  "inProgressTasks": "In Progress",
  "overdueTasks": "Overdue",
  "unassignedTasks": "Unassigned",
  "dueThisWeekTasks": "Due This Week",
  
  // Actions
  "exportButton": "Export",
  "exportToCsv": "Export to CSV",
  "exportToExcel": "Export to Excel",
  "exportToPdf": "Export to PDF",
  "refreshButton": "Refresh",
  "saveViewButton": "Save View",
  "savedViews": "Saved Views",
  "manageViews": "Manage Views",
  
  // Bulk Actions
  "bulkActions": "Bulk Actions",
  "selectedCount": "{{count}} selected",
  "changeStatus": "Change Status",
  "changePriority": "Change Priority",
  "assignMembers": "Assign Members",
  "addLabels": "Add Labels",
  "archiveTasks": "Archive Tasks",
  
  // Pagination
  "showingResults": "Showing {{from}}-{{to}} of {{total}} tasks",
  "tasksPerPage": "Tasks per page",
  "page": "Page",
  "of": "of",
  
  // Empty States
  "noTasksFound": "No tasks found",
  "noTasksDescription": "Try adjusting your filters or search criteria",
  "clearFilters": "Clear Filters",
  
  // Loading States
  "loadingTasks": "Loading tasks...",
  "applyingFilters": "Applying filters...",
  
  // Error States
  "errorLoadingTasks": "Error loading tasks",
  "tryAgain": "Try Again",
  
  // Tooltips
  "expandAllGroups": "Expand all groups",
  "collapseAllGroups": "Collapse all groups",
  "openTaskDetails": "Open task details",
  "moreFilters": "More filters",
  "lessFilters": "Less filters"
}
```

### Usage Pattern

```typescript
import { useTranslation } from 'react-i18next';

const AllTasksReport = () => {
  const { t } = useTranslation('reporting-all-tasks');
  
  return (
    <div>
      <h1>{t('pageTitle')}</h1>
      <Input placeholder={t('searchPlaceholder')} />
      {/* ... */}
    </div>
  );
};
```

### Pluralization Support

For counts that need pluralization:

```json
{
  "taskCount": "{{count}} task",
  "taskCount_plural": "{{count}} tasks",
  "selectedCount": "{{count}} task selected",
  "selectedCount_plural": "{{count}} tasks selected"
}
```

### Date/Time Formatting

Use `dayjs` with locale support for date formatting:

```typescript
import dayjs from 'dayjs';
import 'dayjs/locale/en';
// Import other locales as needed

// Format dates according to user's locale
const formattedDate = dayjs(date).locale(currentLocale).format('MMM DD, YYYY');
```

---

## Theme Support (Dark/Light Mode)

### Design Tokens

Use Ant Design theme tokens and CSS variables for consistent theming. **Never hardcode colors.**

### Color Usage Guidelines

| Element | Light Mode | Dark Mode | CSS Variable / Token |
|---------|------------|-----------|---------------------|
| Background | `#ffffff` | `#141414` | `--ant-color-bg-container` |
| Text Primary | `#1E1E1E` | `#ffffff` | `--ant-color-text` |
| Text Secondary | `#707070` | `#a6a6a6` | `--ant-color-text-secondary` |
| Border | `#d9d9d9` | `#424242` | `--ant-color-border` |
| Hover Background | `#f5f5f5` | `#262626` | `--ant-color-bg-text-hover` |
| Selected Row | `#e6f7ff` | `#111b26` | `--ant-color-primary-bg` |
| Table Header | `#fafafa` | `#1d1d1d` | `--ant-color-bg-container` |
| Table Stripe | `#fafafa` | `#1a1a1a` | Custom variable |

### Component-Specific Theming

#### Table Styling

```css
/* All Tasks Table - Theme-aware styling */
.all-tasks-table {
  /* Use Ant Design's built-in table theming */
}

.all-tasks-table .ant-table-row:hover {
  /* Hover states handled by Ant Design theme */
}

/* Alternating row colors */
.all-tasks-table .ant-table-row:nth-child(even) {
  background-color: var(--ant-color-fill-quaternary);
}

/* Dark mode specific overrides if needed */
:root[data-theme='dark'] .all-tasks-table .ant-table-row:nth-child(even) {
  background-color: rgba(255, 255, 255, 0.04);
}
```

#### Status/Priority Tags

Use existing color definitions from `@/styles/colors.ts` with theme-aware text colors:

```typescript
// Status tag with theme-aware text
<Tag
  style={{ 
    color: colors.darkGray,  // For light backgrounds
    borderRadius: 48 
  }}
  color={record.status_color}
>
  {record.status_name}
</Tag>
```

For dark mode, ensure tag text remains readable:

```css
/* Ensure tag text is readable in both themes */
.all-tasks-table .ant-tag {
  color: var(--ant-color-text);
}

/* Or use contrasting color based on background */
.all-tasks-table .ant-tag[style*="background"] {
  color: #1E1E1E; /* Dark text on colored backgrounds */
}
```

#### Statistics Cards

```css
.stats-card {
  background: var(--ant-color-bg-container);
  border: 1px solid var(--ant-color-border);
  border-radius: 8px;
}

.stats-card-value {
  color: var(--ant-color-text);
  font-size: 24px;
  font-weight: 600;
}

.stats-card-label {
  color: var(--ant-color-text-secondary);
  font-size: 14px;
}

/* Colored stat indicators */
.stats-card--overdue .stats-card-value {
  color: var(--ant-color-error);
}

.stats-card--completed .stats-card-value {
  color: var(--ant-color-success);
}
```

#### Filter Dropdowns

```css
/* Filter dropdown styling */
.filter-dropdown {
  background: var(--ant-color-bg-elevated);
  border: 1px solid var(--ant-color-border);
  box-shadow: var(--ant-box-shadow);
}

.filter-dropdown-item:hover {
  background: var(--ant-color-bg-text-hover);
}

.filter-dropdown-item--selected {
  background: var(--ant-color-primary-bg);
}
```

#### Empty State

```css
.empty-state {
  color: var(--ant-color-text-secondary);
}

.empty-state-icon {
  color: var(--ant-color-text-quaternary);
}
```

### Tailwind CSS Classes (Theme-Aware)

Use Tailwind's dark mode utilities:

```tsx
// Example: Table row with theme-aware hover
<tr className="hover:bg-gray-50 dark:hover:bg-gray-800">
  {/* ... */}
</tr>

// Example: Text with theme-aware colors
<span className="text-gray-900 dark:text-gray-100">
  {taskName}
</span>

// Example: Border with theme-aware colors
<div className="border border-gray-200 dark:border-gray-700">
  {/* ... */}
</div>
```

### Theme Detection

Use existing Worklenz theme context:

```typescript
import { useTheme } from '@/hooks/useTheme'; // or existing theme hook

const AllTasksReport = () => {
  const { isDarkMode } = useTheme();
  
  // Conditionally apply styles if needed
  const tableClassName = isDarkMode 
    ? 'all-tasks-table all-tasks-table--dark' 
    : 'all-tasks-table';
  
  return <Table className={tableClassName} />;
};
```

### Icon Colors

Ensure icons adapt to theme:

```tsx
// Use currentColor for icons to inherit text color
<FilterOutlined style={{ color: 'currentColor' }} />

// Or use Ant Design's token-based colors
<FilterOutlined className="text-[var(--ant-color-text-secondary)]" />
```

### Chart/Graph Colors (if applicable)

For any charts in statistics:

```typescript
const chartColors = {
  light: {
    completed: '#52c41a',
    inProgress: '#1890ff',
    overdue: '#ff4d4f',
    todo: '#d9d9d9',
  },
  dark: {
    completed: '#73d13d',
    inProgress: '#40a9ff',
    overdue: '#ff7875',
    todo: '#434343',
  },
};
```

### Testing Checklist

#### Light Mode
- [ ] All text is readable
- [ ] Status/priority tags have sufficient contrast
- [ ] Table rows have visible borders/separators
- [ ] Hover states are visible
- [ ] Selected states are distinguishable
- [ ] Empty states are visible
- [ ] Loading skeletons match theme

#### Dark Mode
- [ ] All text is readable (no dark text on dark background)
- [ ] Status/priority tags have sufficient contrast
- [ ] Table rows have visible borders/separators
- [ ] Hover states are visible
- [ ] Selected states are distinguishable
- [ ] No "flash" of wrong theme on load
- [ ] Scrollbars match theme (if custom)

### CSS File Structure

Create: `src/pages/reporting/all-tasks/all-tasks-report.css`

```css
/* All Tasks Report Styles */

/* Base styles (works for both themes) */
.all-tasks-report {
  /* Layout styles */
}

/* Table styles */
.all-tasks-table {
  /* Table-specific styles */
}

/* Filter bar styles */
.all-tasks-filters {
  /* Filter layout */
}

/* Statistics cards */
.all-tasks-stats {
  /* Stats layout */
}

/* 
 * Theme-specific overrides
 * Only use when Ant Design tokens are insufficient
 */
:root[data-theme='dark'] .all-tasks-report {
  /* Dark mode specific overrides */
}

/* Responsive styles */
@media (max-width: 768px) {
  .all-tasks-filters {
    /* Mobile filter layout */
  }
}
```

---

## Implementation Phases

### Phase 1: MVP
- Basic table view with core columns
- Primary filters (Team, Project, Status, Priority, Assignee, Date Range)
- Basic sorting (single column)
- Search functionality
- Pagination
- Task drawer integration

### Phase 2: Enhanced Filtering
- All secondary filters
- Multi-column sorting
- Group by functionality
- Summary statistics cards

### Phase 3: Advanced Features
- Board view
- List view
- Saved views
- Export functionality
- Bulk actions

### Phase 4: Optimization
- Real-time updates
- Performance optimization
- Advanced analytics

---

## Success Metrics

1. **Adoption**: % of users accessing All Tasks report weekly
2. **Engagement**: Average time spent on the page
3. **Filter Usage**: Most commonly used filters
4. **Export Usage**: Number of exports per week
5. **Performance**: Page load time < 2 seconds

---

## Open Questions

1. Should we allow editing tasks directly from this view or only via task drawer?
2. Should saved views be personal or shareable with team?
3. What is the maximum number of tasks to display before requiring filters?
4. Should we include a timeline/Gantt view option?
5. Should custom fields be included as filterable/displayable columns?

---

## References

- Existing Worklenz reporting: `@/pages/reporting/`
- Task list filters: `@/pages/projects/project-view-1/taskList/taskListFilters/`
- Project reports filters: `@/pages/reporting/projects-reports/projects-reports-filters/`
- Task types: `@/types/project/projectTasksViewModel.types.ts`
- Reporting constants: `@/lib/reporting/reporting-constants.ts`

---

*Document Version: 1.0*  
*Created: December 2024*  
*Status: Draft - Pending Review*

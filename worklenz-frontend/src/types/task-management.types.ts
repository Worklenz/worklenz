import { InlineMember } from './teamMembers/inlineMember.types';
import { EntityState } from '@reduxjs/toolkit';
import { ITaskListColumn } from './tasks/taskList.types';

export interface Task {
  id: string;
  title?: string; // Make title optional since it can be empty from database
  name?: string; // Alternative name field
  task_key?: string; // Task key field
  description?: string;
  status: string;
  priority: string;
  phase?: string;
  assignee?: string;
  assignees?: string[]; // Array of assigned member IDs
  assignee_names?: InlineMember[]; // Array of assigned members
  names?: InlineMember[]; // Alternative names field
  due_date?: string;
  dueDate?: string; // Alternative due date field
  startDate?: string; // Start date field
  completedAt?: string; // Completion date
  updatedAt?: string; // Update timestamp
  created_at: string;
  updated_at: string;
  sub_tasks?: Task[];
  sub_tasks_count?: number;
  show_sub_tasks?: boolean;
  parent_task_id?: string;
  is_sub_task?: boolean; // Add this property
  progress?: number;
  weight?: number;
  color?: string;
  statusColor?: string;
  priorityColor?: string;
  labels?: { id: string; name: string; color: string; end?: boolean; names?: string[] }[];
  comments_count?: number;
  attachments_count?: number;
  has_dependencies?: boolean;
  schedule_id?: string | null;
  order?: number;
  reporter?: string; // Reporter field
  timeTracking?: { // Time tracking information
    logged?: number;
    estimated?: number;
  };
  custom_column_values?: Record<string, any>; // Custom column values
  isTemporary?: boolean; // Temporary task indicator
  // Add any other task properties as needed
}

export interface TaskGroup {
  id: string;
  title: string;
  taskIds: string[];
  type?: 'status' | 'priority' | 'phase' | 'members';
  color?: string;
  collapsed?: boolean;
  groupValue?: string;
  // Add any other group properties as needed
}

export interface GroupingConfig {
  currentGrouping: 'status' | 'priority' | 'phase';
  customPhases: string[]; // User-defined phases
  groupOrder: Record<string, string[]>; // Order of groups for each grouping type
}

export interface Column {
  id: string;
  title: string;
  dataIndex: string;
  width: number;
  visible: boolean;
  editable: boolean;
  type: 'text' | 'select' | 'date' | 'progress' | 'tags' | 'users';
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  end?: boolean;
  names?: string[];
}

// Redux State Interfaces
export interface TaskManagementState {
  ids: string[];
  entities: Record<string, Task>;
  loading: boolean;
  error: string | null;
  groups: TaskGroup[];
  grouping: string | undefined;
  selectedPriorities: string[];
  search: string;
  archived: boolean;
  loadingSubtasks: Record<string, boolean>; // Track loading state for individual tasks
  loadingColumns: boolean;
  columns: ITaskListColumn[];
  customColumns: ITaskListColumn[];
}

export interface TaskGroupsState {
  entities: Record<string, TaskGroup>;
  ids: string[];
}

export interface GroupingState {
  currentGrouping: TaskGrouping | null;
  collapsedGroups: Set<string>;
}

export interface TaskGrouping {
  id: string;
  name: string;
  field: string;
  collapsed?: boolean;
}

export interface TaskSelection {
  selectedTaskIds: string[];
  lastSelectedTaskId: string | null;
}

export interface ColumnsState {
  entities: Record<string, Column>;
  ids: string[];
  order: string[];
}

export interface UIState {
  draggedTaskId: string | null;
  bulkActionMode: boolean;
  editingCell: { taskId: string; field: string } | null;
}

// Drag and Drop
export interface DragEndEvent {
  active: {
    id: string;
    data: {
      current?: {
        taskId: string;
        groupId: string;
      };
    };
  };
  over: {
    id: string;
    data: {
      current?: {
        groupId: string;
        type: 'group' | 'task';
      };
    };
  } | null;
}

// Bulk Actions
export interface BulkAction {
  type: 'status' | 'priority' | 'phase' | 'assignee' | 'label' | 'delete';
  value?: any;
  taskIds: string[];
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'todo' | 'doing' | 'done';
  priority: 'critical' | 'high' | 'medium' | 'low';
  phase: string; // Custom phases like 'planning', 'development', 'testing', 'deployment'
  progress: number; // 0-100
  assignees: string[];
  labels: string[];
  dueDate?: string;
  timeTracking: {
    estimated?: number;
    logged: number;
  };
  customFields: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  order: number;
}

export interface TaskGroup {
  id: string;
  title: string;
  groupType: 'status' | 'priority' | 'phase';
  groupValue: string; // The actual value for the group (e.g., 'todo', 'high', 'development')
  collapsed: boolean;
  taskIds: string[];
  color?: string; // For visual distinction
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
}

// Redux State Interfaces
export interface TaskManagementState {
  entities: Record<string, Task>;
  ids: string[];
  loading: boolean;
  error: string | null;
}

export interface TaskGroupsState {
  entities: Record<string, TaskGroup>;
  ids: string[];
}

export interface GroupingState {
  currentGrouping: 'status' | 'priority' | 'phase';
  customPhases: string[];
  groupOrder: Record<string, string[]>;
  groupStates: Record<string, { collapsed: boolean }>; // Persist group states
}

export interface SelectionState {
  selectedTaskIds: string[];
  lastSelectedId: string | null;
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
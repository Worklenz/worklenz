import { ReactNode } from 'react';

// Core Task Interface
export interface GanttTask {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  progress: number;
  duration?: number; // in days
  parent?: string;
  type: 'task' | 'milestone' | 'project';
  status: 'not-started' | 'in-progress' | 'completed' | 'on-hold' | 'overdue';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignee?: {
    id: string;
    name: string;
    avatar?: string;
  };
  dependencies?: string[];
  description?: string;
  tags?: string[];
  color?: string;
  isCollapsed?: boolean;
  level?: number; // for hierarchical display
  hasChildren?: boolean;
  isExpanded?: boolean;
}

// Column Configuration
export interface ColumnConfig {
  field: keyof GanttTask | string;
  title: string;
  width: number;
  minWidth?: number;
  maxWidth?: number;
  resizable: boolean;
  sortable: boolean;
  fixed: boolean;
  align?: 'left' | 'center' | 'right';
  renderer?: (value: any, task: GanttTask) => ReactNode;
  editor?: 'text' | 'date' | 'select' | 'number' | 'progress';
  editorOptions?: any;
}

// Timeline Configuration
export interface TimelineConfig {
  topTier: {
    unit: 'year' | 'month' | 'week' | 'day';
    format: string;
    height?: number;
  };
  bottomTier: {
    unit: 'month' | 'week' | 'day' | 'hour';
    format: string;
    height?: number;
  };
  showWeekends: boolean;
  showNonWorkingDays: boolean;
  holidays: Holiday[];
  workingDays: number[]; // 0-6, Sunday-Saturday
  workingHours: {
    start: number; // 0-23
    end: number; // 0-23
  };
  minDate?: Date;
  maxDate?: Date;
  dayWidth: number; // pixels per day
}

// Holiday Interface
export interface Holiday {
  date: Date;
  name: string;
  type: 'national' | 'company' | 'religious' | 'custom';
  recurring?: boolean;
  color?: string;
}

// Virtual Scrolling Configuration
export interface VirtualScrollConfig {
  enableRowVirtualization: boolean;
  enableTimelineVirtualization: boolean;
  bufferSize: number;
  itemHeight: number;
  overscan?: number;
}

// Drag and Drop State
export interface DragState {
  isDragging: boolean;
  dragType: 'move' | 'resize-start' | 'resize-end' | 'progress' | 'link';
  taskId: string;
  initialPosition: { x: number; y: number };
  currentPosition?: { x: number; y: number };
  initialDates: { start: Date; end: Date };
  initialProgress?: number;
  snapToGrid?: boolean;
  constraints?: {
    minDate?: Date;
    maxDate?: Date;
    minDuration?: number;
    maxDuration?: number;
  };
}

// Zoom Levels
export interface ZoomLevel {
  name: string;
  dayWidth: number;
  topTier: TimelineConfig['topTier'];
  bottomTier: TimelineConfig['bottomTier'];
  scale: number;
}

// Selection State
export interface SelectionState {
  selectedTasks: string[];
  selectedRows: number[];
  selectionRange?: {
    start: { row: number; col: number };
    end: { row: number; col: number };
  };
  focusedTask?: string;
}

// Gantt View State
export interface GanttViewState {
  zoomLevel: number;
  scrollPosition: { x: number; y: number };
  viewportSize: { width: number; height: number };
  splitterPosition: number; // percentage for grid/timeline split
  showCriticalPath: boolean;
  showBaseline: boolean;
  showProgress: boolean;
  showDependencies: boolean;
  autoSchedule: boolean;
  readOnly: boolean;
}

// Performance Metrics
export interface PerformanceMetrics {
  renderTime: number;
  taskCount: number;
  visibleTaskCount: number;
  memoryUsage?: number;
  fps?: number;
}

// Event Handlers
export type TaskEventHandler<T = void> = (task: GanttTask, event: MouseEvent | TouchEvent) => T;
export type DragEventHandler = (taskId: string, newDates: { start: Date; end: Date }) => void;
export type ResizeEventHandler = (taskId: string, newDates: { start: Date; end: Date }) => void;
export type ProgressEventHandler = (taskId: string, progress: number) => void;
export type SelectionEventHandler = (selectedTasks: string[]) => void;
export type ColumnResizeHandler = (columnField: string, newWidth: number) => void;

// Gantt Actions (for useReducer)
export type GanttAction =
  | { type: 'SET_TASKS'; payload: GanttTask[] }
  | { type: 'UPDATE_TASK'; payload: { id: string; updates: Partial<GanttTask> } }
  | { type: 'ADD_TASK'; payload: GanttTask }
  | { type: 'DELETE_TASK'; payload: string }
  | { type: 'SET_SELECTION'; payload: string[] }
  | { type: 'SET_DRAG_STATE'; payload: DragState | null }
  | { type: 'SET_ZOOM_LEVEL'; payload: number }
  | { type: 'SET_SCROLL_POSITION'; payload: { x: number; y: number } }
  | { type: 'SET_SPLITTER_POSITION'; payload: number }
  | { type: 'TOGGLE_TASK_EXPANSION'; payload: string }
  | { type: 'SET_VIEW_STATE'; payload: Partial<GanttViewState> }
  | { type: 'UPDATE_COLUMN_WIDTH'; payload: { field: string; width: number } };

// Main Gantt State
export interface GanttState {
  tasks: GanttTask[];
  columns: ColumnConfig[];
  timelineConfig: TimelineConfig;
  virtualScrollConfig: VirtualScrollConfig;
  dragState: DragState | null;
  selectionState: SelectionState;
  viewState: GanttViewState;
  zoomLevels: ZoomLevel[];
  performanceMetrics: PerformanceMetrics;
}

// Gantt Chart Props
export interface AdvancedGanttProps {
  // Data
  tasks: GanttTask[];
  columns?: ColumnConfig[];

  // Configuration
  timelineConfig?: Partial<TimelineConfig>;
  virtualScrollConfig?: Partial<VirtualScrollConfig>;
  zoomLevels?: ZoomLevel[];

  // Initial State
  initialViewState?: Partial<GanttViewState>;
  initialSelection?: string[];

  // Event Handlers
  onTaskUpdate?: (taskId: string, updates: Partial<GanttTask>) => void;
  onTaskCreate?: (task: Omit<GanttTask, 'id'>) => void;
  onTaskDelete?: (taskId: string) => void;
  onTaskMove?: DragEventHandler;
  onTaskResize?: ResizeEventHandler;
  onProgressChange?: ProgressEventHandler;
  onSelectionChange?: SelectionEventHandler;
  onColumnResize?: ColumnResizeHandler;
  onDependencyCreate?: (fromTaskId: string, toTaskId: string) => void;
  onDependencyDelete?: (fromTaskId: string, toTaskId: string) => void;

  // UI Customization
  className?: string;
  style?: React.CSSProperties;
  theme?: 'light' | 'dark' | 'auto';
  locale?: string;

  // Feature Flags
  enableDragDrop?: boolean;
  enableResize?: boolean;
  enableProgressEdit?: boolean;
  enableInlineEdit?: boolean;
  enableContextMenu?: boolean;
  enableTooltips?: boolean;
  enableExport?: boolean;
  enablePrint?: boolean;

  // Performance Options
  enableVirtualScrolling?: boolean;
  enableDebouncing?: boolean;
  debounceDelay?: number;
  maxVisibleTasks?: number;
}

// Context Menu Options
export interface ContextMenuOption {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
  separator?: boolean;
  children?: ContextMenuOption[];
  onClick?: (task?: GanttTask) => void;
}

// Export Options
export interface ExportOptions {
  format: 'png' | 'pdf' | 'svg' | 'json' | 'csv' | 'xlsx';
  includeColumns?: string[];
  dateRange?: { start: Date; end: Date };
  filename?: string;
  paperSize?: 'A4' | 'A3' | 'Letter' | 'Legal';
  orientation?: 'portrait' | 'landscape';
  scale?: number;
}

// Filter and Search
export interface FilterConfig {
  field: string;
  operator:
    | 'equals'
    | 'contains'
    | 'startsWith'
    | 'endsWith'
    | 'greaterThan'
    | 'lessThan'
    | 'between';
  value: any;
  logic?: 'and' | 'or';
}

export interface SearchConfig {
  query: string;
  fields: string[];
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
}

// Baseline and Critical Path
export interface TaskBaseline {
  taskId: string;
  baselineStart: Date;
  baselineEnd: Date;
  baselineDuration: number;
  baselineProgress: number;
  variance?: number; // days
}

export interface CriticalPath {
  taskIds: string[];
  totalDuration: number;
  slack: number; // days of buffer
}

// Undo/Redo
export interface HistoryState {
  past: GanttState[];
  present: GanttState;
  future: GanttState[];
  maxHistorySize: number;
}

// Keyboard Shortcuts
export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  action: string;
  description: string;
  handler: (event: KeyboardEvent) => void;
}

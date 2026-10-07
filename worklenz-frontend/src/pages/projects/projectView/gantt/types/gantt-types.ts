import type { UnifiedTimelineCalculator } from '../utils/unified-timeline-calculator';

export type GanttViewMode = 'day' | 'week' | 'month' | 'quarter' | 'year';

export type GanttGroupingMode = 'phase' | 'status' | 'priority';

// Phase-grouping display order: 'manual' is the drag-ordered sort_index from
// the backend (shared with Board/Task List); 'chronological' is a client-side,
// non-persisted sort by start_date, scoped to the Roadmap tab only.
export type PhaseSortMode = 'manual' | 'chronological';

export type DependencyType =
  | 'blocked_by'
  | 'finish_to_start'
  | 'start_to_start'
  | 'finish_to_finish'
  | 'start_to_finish';

export interface GanttTask {
  id: string;
  name: string;
  start_date: Date | null;
  end_date: Date | null;
  progress: number;
  dependencies?: string[];
  dependencyRecords?: GanttDependency[];
  dependencyType?: DependencyType;
  parent_id?: string | null;
  children?: GanttTask[];
  level?: number;
  expanded?: boolean;
  color?: string;
  assignees?: Array<{
    id?: string;
    team_member_id?: string;
    name?: string;
    assignee_name?: string;
    avatar_url?: string | null;
    color_code?: string;
  }>;
  priority?: string;
  status?: string;
  phase_id?: string | null;
  parent_status_id?: string | null;
  parent_priority?: string | null;
  is_milestone?: boolean;
  type?: 'task' | 'milestone' | 'phase' | 'add-task-button';
  // Add task row specific properties
  parent_phase_id?: string;
  // Subtasks support
  sub_tasks?: GanttTask[];
  sub_tasks_count?: number;
  show_sub_tasks?: boolean;
  // Optional aggregates for phase milestones (from backend)
  todo_progress?: number;
  doing_progress?: number;
  done_progress?: number;
  todo_count?: number;
  doing_count?: number;
  done_count?: number;
  total_tasks?: number;
}

export interface GanttPhase {
  id: string;
  name: string;
  color_code: string;
  start_date: Date | null;
  end_date: Date | null;
  sort_index: number;
  tasks?: GanttTask[];
  children?: GanttTask[];
  expanded?: boolean;
}

export interface GanttMilestone extends Omit<GanttTask, 'type'> {
  type: 'milestone';
  phase_id: string;
}

export interface GanttDependency {
  id: string;
  task_id: string;
  related_task_id: string;
  dependency_type: DependencyType;
}

export interface GanttContextType {
  tasks: GanttTask[];
  phases: GanttPhase[];
  viewMode: GanttViewMode;
  groupingMode: GanttGroupingMode;
  projectId: string;
  dateRange: { start: Date; end: Date };
  onRefresh: () => void;
  timelineCalculator?: UnifiedTimelineCalculator; // UnifiedTimelineCalculator instance
  highlightedDateRange?: { start: Date; end: Date } | null; // Date range to highlight in timeline
  setHighlightedDateRange?: (range: { start: Date; end: Date } | null) => void;
  // Whether the timeline's total width exceeds the available container width — computed
  // once alongside timelineCalculator so the header and grid can't independently disagree
  // on whether to scroll (see ProjectViewGantt.tsx's shouldScroll memo).
  shouldScroll?: boolean;
}

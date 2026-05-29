export type GanttViewMode = 'day' | 'week' | 'month' | 'quarter' | 'year';

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
  dependencyType?: DependencyType;
  parent_id?: string;
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
  phase_id?: string;
  is_milestone?: boolean;
  type?: 'task' | 'milestone' | 'phase' | 'add-task-button';
  // Add task row specific properties
  parent_phase_id?: string;
  // Optional aggregates for phase milestones (from backend)
  todo_progress?: number;
  doing_progress?: number;
  done_progress?: number;
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
  projectId: string;
  dateRange: { start: Date; end: Date };
  onRefresh: () => void;
  timelineCalculator?: any; // UnifiedTimelineCalculator instance
}

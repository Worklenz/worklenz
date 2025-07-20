export interface ProjectPhase {
  id: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  progress: number;
  color: string;
  status: 'not-started' | 'in-progress' | 'completed' | 'on-hold';
  tasks: PhaseTask[];
  milestones: PhaseMilestone[];
}

export interface PhaseTask {
  id: string;
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  progress: number;
  assigneeId?: string;
  assigneeName?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'todo' | 'in-progress' | 'done';
  dependencies?: string[];
}

export interface PhaseMilestone {
  id: string;
  name: string;
  description?: string;
  dueDate: Date;
  isCompleted: boolean;
  criticalPath: boolean;
}

export interface ProjectRoadmap {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  phases: ProjectPhase[];
  createdAt: Date;
  updatedAt: Date;
}

export interface GanttViewOptions {
  viewMode: 'day' | 'week' | 'month' | 'year';
  showTasks: boolean;
  showMilestones: boolean;
  groupByPhase: boolean;
}

export interface PhaseModalData extends ProjectPhase {
  taskCount: number;
  completedTaskCount: number;
  milestoneCount: number;
  completedMilestoneCount: number;
  teamMembers: string[];
}
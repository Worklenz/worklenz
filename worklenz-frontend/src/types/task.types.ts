import { MemberType } from './member.types';
import { ProjectType } from './project.types';
import { ITaskLabel } from './tasks/taskLabel.types';

export type TaskStatusType = 'doing' | 'todo' | 'done';
export type TaskPriorityType = 'low' | 'medium' | 'high';

export type SubTaskType = {
  subTaskId: string;
  subTask: string;
  subTaskMembers?: string[];
  subTaskStatus: TaskStatusType;
  subTaskDueDate?: Date;
};

export type ProgressModeType = 'manual' | 'weighted' | 'time' | 'default';

export type TaskType = {
  taskId: string;
  progress_mode?: ProgressModeType;
  task: string;
  description?: string | null;
  progress?: number;
  members?: MemberType[];
  labels?: ITaskLabel[];
  status: TaskStatusType | string;
  priority: TaskPriorityType | string;
  timeTracking?: number;
  estimation?: string;
  startDate?: Date | null;
  dueDate?: Date | null;
  completedDate?: Date | null;
  createdDate?: Date;
  lastUpdated?: Date;
  reporter?: string;
  phase?: string;
  subTasks?: TaskType[];
  project?: ProjectType;
};

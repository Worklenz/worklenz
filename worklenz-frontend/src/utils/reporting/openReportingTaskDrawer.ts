import { AppDispatch } from '@/app/store';
import { getProject, setProjectId } from '@/features/project/project.slice';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';
import {
  fetchTask,
  setSelectedTaskId,
  setShowTaskDrawer,
  setTaskFormViewModel,
} from '@/features/task-drawer/task-drawer.slice';
import { ITaskFormViewModel, ITaskViewModel } from '@/types/tasks/task.types';
import { ITaskPhase } from '@/types/tasks/taskPhase.types';

export interface ReportingTaskRow {
  id: string;
  name?: string;
  status?: string;
  status_id?: string;
  status_name?: string;
  status_color?: string;
  priority?: string;
  priority_id?: string;
  priority_name?: string;
  priority_color?: string;
  phase_id?: string;
  phase_name?: string;
  phase_color?: string;
  end_date?: string | null;
  completed_at?: string | null;
  total_minutes?: number;
  parent_task_id?: string | null;
  is_sub_task?: boolean;
  sub_tasks_count?: number;
  task_key?: string;
}

const buildSeedPhases = (task: ReportingTaskRow): ITaskPhase[] => {
  if (!task.phase_id || !task.phase_name) return [];

  return [
    {
      id: task.phase_id,
      name: task.phase_name,
      color_code: task.phase_color || '#1890ff',
      sort_index: 0,
    },
  ];
};

const buildTaskFormSeed = (task: ReportingTaskRow, projectId: string): ITaskFormViewModel => ({
  task: {
    id: task.id,
    name: task.name || '',
    project_id: projectId,
    status_id: task.status_id || task.status || '',
    status_name: task.status_name,
    status_color: task.status_color,
    priority_id: task.priority_id || task.priority,
    priority_name: task.priority_name,
    priority_color: task.priority_color,
    phase_id: task.phase_id || '',
    phase_name: task.phase_name,
    end_date: task.end_date || '',
    completed_at: task.completed_at || undefined,
    total_minutes: task.total_minutes,
    parent_task_id: task.parent_task_id ?? null,
    is_sub_task: task.is_sub_task,
    sub_tasks_count: task.sub_tasks_count,
    task_key: task.task_key,
  } as ITaskViewModel,
  priorities: [],
  projects: [],
  statuses: [],
  phases: buildSeedPhases(task),
  team_members: [],
  custom_columns: [],
});

export const openReportingTaskDrawer = (
  dispatch: AppDispatch,
  task: ReportingTaskRow,
  projectId: string
) => {
  if (!task?.id || !projectId) return;

  dispatch(setProjectId(projectId));
  dispatch(setTaskFormViewModel(buildTaskFormSeed(task, projectId)));
  dispatch(setSelectedTaskId(task.id));
  dispatch(fetchPhasesByProjectId(projectId));
  dispatch(getProject(projectId));
  dispatch(fetchTask({ taskId: task.id, projectId }));
  dispatch(setShowTaskDrawer(true));
};

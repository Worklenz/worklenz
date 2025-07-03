import { getCurrentGroupBoard } from '@/features/board/board-slice';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { IGroupByOption } from '@/types/tasks/taskList.types';
import { NavigateFunction } from 'react-router-dom';

const GROUP_BY_STATUS_VALUE = 'status';
const GROUP_BY_PRIORITY_VALUE = 'priority';
const GROUP_BY_PHASE_VALUE = 'phase';
const GROUP_BY_OPTIONS: IGroupByOption[] = [
  { label: 'Status', value: GROUP_BY_STATUS_VALUE },
  { label: 'Priority', value: GROUP_BY_PRIORITY_VALUE },
  { label: 'Phase', value: GROUP_BY_PHASE_VALUE },
];

class TaskListService {
  private readonly navigate: NavigateFunction;

  constructor(navigate: NavigateFunction) {
    this.navigate = navigate;
  }
}

// Hook for using AuthService in components
export const createTaskListService = (navigate: NavigateFunction): TaskListService => {
  return new TaskListService(navigate);
};

export const getGroupIdByGroupedColumn = (task: IProjectTask) => {
  const groupBy = getCurrentGroupBoard().value;
  if (groupBy === GROUP_BY_STATUS_VALUE) return task.status as string;

  if (groupBy === GROUP_BY_PRIORITY_VALUE) return task.priority as string;

  if (groupBy === GROUP_BY_PHASE_VALUE) return task.phase_id as string;

  return null;
};

import { ITeamMemberViewModel } from '../teamMembers/teamMembersGetResponse.types';
import { ITaskLabel } from './taskLabel.types';
import { ITaskPrioritiesGetResponse } from './taskPriority.types';

export interface ITaskListMemberFilter extends ITeamMemberViewModel {
  selected?: boolean;
}

export interface ITaskListLabelFilter extends ITaskLabel {
  selected?: boolean;
}

export interface ITaskListPriorityFilter extends ITaskPrioritiesGetResponse {
  selected?: boolean;
}

export interface ITaskListGroupChangeResponse {
  taskId?: string;
  isSubTask?: boolean;
}

export interface ITaskListSortableColumn {
  label?: string;
  key?: string;
  sort_order?: string;
  selected?: boolean;
}

export interface ITaskListEstimationChangeResponse {
  id: string;
  total_minutes: number;
  total_hours: number;
  parent_task: string;
  total_minutes_spent: number;
  total_time_string?: string;
}

export interface ILabelsChangeResponse {
  id: string;
  parent_task: string;
  is_new: boolean;
  new_label: ITaskLabel;
  all_labels: ITaskLabel[];
  labels: ITaskLabel[];
}

export interface IMembersFilterChange {
  selection: string;
  is_subtasks_included: boolean;
}

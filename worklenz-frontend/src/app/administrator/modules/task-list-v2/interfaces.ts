// TODO: Move to separate files later

import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";
import {ITaskPrioritiesGetResponse} from "@interfaces/api-models/task-priorities-get-response";
import {ITeamMemberViewModel} from "@interfaces/api-models/team-members-get-response";
import {ITaskLabel} from "@interfaces/task-label";
import {ITaskStatus} from "@interfaces/task-status";

export interface ISelectableTaskStatus extends ITaskStatus {
  selected?: boolean;
}

export interface ITaskListConfigV2 {
  id: string;
  field: string | null;
  order: string | null;
  search: string | null;
  statuses: string | null;
  members: string | null;
  projects: string | null;
  labels?: string | null;
  priorities?: string | null;
  archived?: boolean;
  count?: boolean;
  parent_task?: string;
  group?: string;
  isSubtasksInclude: boolean;
}

export interface ITaskListGroup {
  id: string;
  name: string;
  start_date?: string;
  end_date?: string;
  color_code: string;
  category_id?: string;
  old_category_id?: string;
  todo_progress?: number;
  doing_progress?: number;
  done_progress?: number;
  tasks: IProjectTask[];
  is_expanded?: boolean;
}

export interface ITaskListContextMenuEvent {
  event: MouseEvent,
  task: IProjectTask
}

export interface IGroupByOption {
  label: string;
  value: string;
}

export interface ITaskListPriorityFilter extends ITaskPrioritiesGetResponse {
  selected?: boolean;
}

export interface ITaskListLabelFilter extends ITaskLabel {
  selected?: boolean;
}

export interface ITaskListMemberFilter extends ITeamMemberViewModel {
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
  all_labels: ITaskLabel[],
  labels: ITaskLabel[];
}

export interface IMembersFilterChange {
  selection: string,
  is_subtasks_included: boolean
}

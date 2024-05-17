import {ITaskListGroup} from "../administrator/modules/task-list-v2/interfaces";

export interface IScheduleSingleDay {
  day: number;
  name: string;
  isWeekend: boolean;
  isToday: boolean;
}

export interface IScheduleSingleMonth {
  month: string;
  days: IScheduleSingleDay[]
}

export interface IScheduleDateCreateResponse {
  width: number;
  scroll_by: number;
  date_data: IScheduleSingleMonth[];
  chart_start: string;
  chart_end: string;
}

export interface IScheduleProject {
  id: string;
  name: string;
  color_code: string;
  indicator_offset?: number;
  indicator_width?: number;
  members: IScheduleProjectMember[];
  is_expanded: boolean;
}

export interface IScheduleProjectReload {
  project_id: string;
  expanded_members: string[];
  is_unassigned_expanded: boolean;
}

export interface IMemberUpdateResponse {
  project_allocation: IScheduleProject,
  member_allocations: IMemberAllocation[]
}

export interface IProjectUpdateResposne {
  project_allocation: IScheduleProject
}

export interface IMemberIndicatorContextMenuEvent {
  event: MouseEvent,
  projectId: string,
  teamMemberId: string,
  ids: string[]
}

export interface IMemberAllocation {
  ids: string[];
  indicator_offset: number;
  indicator_width: number;
  allocated_from: string;
  allocated_to: string;
}

export interface IScheduleProjectMember {
  project_member_id: string;
  is_project_member: boolean;
  pending_invitation: boolean;
  name: string;
  avatar_url?: string;
  color_code?: string;
  team_member_id: string;
  user_id: string;
  allocations: IMemberAllocation[]
}

export interface IScheduleMemberTask {
  task_id: string;
  task_name: string;
}

export interface IScheduleTasksConfig {
  id: string;
  members: string | null;
  archived?: boolean;
  count?: boolean;
  parent_task?: string;
  group?: string;
  isSubtasksInclude: boolean;
}

export interface IMemberTaskListGroup extends ITaskListGroup {
  isExpand: boolean
}

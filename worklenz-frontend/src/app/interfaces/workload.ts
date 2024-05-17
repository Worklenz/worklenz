import {ITaskListGroup} from "../administrator/modules/task-list-v2/interfaces";

export interface IWLTasksConfig {
  id: string;
  members: string | null;
  archived?: boolean;
  count?: boolean;
  parent_task?: string;
  group?: string;
  isSubtasksInclude: boolean;
  dateChecker: "" | "end_date_null" | "start_date_null" | "start_end_dates_null";
}

export interface IWLTaskListGroup extends ITaskListGroup {
  isExpand: boolean
}

export interface ISingleDay {
  day: number;
  name: string;
  isWeekend: boolean;
  isToday: boolean;
}

export interface ISingleMonth {
  month: string;
  days: ISingleDay[]
}

export interface IDateCreateResponse {
  width: number;
  scroll_by: number;
  date_data: ISingleMonth[] | [];
  chart_start: string;
  chart_end: string;
}

export interface IWLMemberTask {
  task_id: string;
  task_name: string;
  start_date: string;
  end_date: string;
  width: number;
  left: number;
}

export interface IWLMember {
  project_member_id: string;
  is_project_member: boolean;
  name: string;
  avatar_url?: string;
  color_code?: string;
  team_member_id: string;
  indicator_offset: number;
  indicator_width: number;
  tasks_start_date: string;
  tasks_end_date: string;
  tasks_stats: {
    total: number;
    null_start_dates: number;
    null_end_dates: number;
    null_start_end_dates: number;
    available_start_end_dates: number;
    null_start_dates_percentage: number;
    null_end_dates_percentage: number;
    null_start_end_dates_percentage: number;
    available_start_end_dates_percentage: number;
  },
  not_allocated: boolean;
  // tasks: IWLMemberTask[] | [];
  // isExpand: boolean;
}

export interface IDragReturn {
  finalLeft: number;
  dragDifference: number;
}

export interface IWLMemberOverviewResponse {
  by_status: IWLMemberOverview[];
  by_priority: IWLMemberOverview[];
  by_phase: IWLMemberOverview[];
  by_dates: IWLMemberOverview[];
}

export interface IWLMemberOverview {
  id: string;
  label: string;
  color_code: string;
  tasks_count: number
}

import {ITask} from '@interfaces/task';

export enum IGanttChartMargins {
  LEFT = 200,
  RIGHT = 100
}

export enum EGanttColumnWidth {
  DAYS = 50,
  WEEKS = 40,
  MONTHS = 30
}

export enum EResourceGanttColumn {
  WEEKS = 30,
  MONTHS = 15,
  QUARTERS = 10
}

export enum EGanttChartTypes {
  RESOURCE, PROJECT
}

export enum EGanttViewModes {
  DAYS, WEEKS, MONTHS
}

export enum EResourceGanttViewModes {
  WEEKS, MONTHS, QUARTERS
}

export interface IProjectMemberGantt {
  id?: string;
  team_member_id?: string;
  project_access_level_id?: string;
  job_title?: string;
  name?: string;
  access_level?: string;
  tasks?: ITask[];
}

export interface IGanttDateRange {
  isSunday?: boolean;
  isToday?: boolean;
  isWeekend?: boolean;
  isLastDayOfWeek?: boolean;
  isLastDayOfMonth?: boolean;
  date?: Date;
}

export interface IGanttWeekRange {
  max?: number;
  min?: number;
  month_name?: string;
  week_index?: number;
  days_of_week?: IGanttDateRange[];
}

export interface IGanttMonthRange {
  max?: number;
  min?: number;
  month_name?: string;
  month_index?: number;
  days_of_month?: IGanttDateRange[];
}

export interface IGanttChartTasks {
  [id: string]: ITask
}

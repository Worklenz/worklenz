import { Dayjs } from 'dayjs';

export interface Settings {
  workingDays: string[];
  workingHours: number;
}

export interface OneDate {
  day?: number;
  name?: string;
  isToday?: boolean;
  isWeekend?: boolean;
}

interface Dates {
  days?: OneDate[];
  month?: string;
  weeks?: any[];
}

export interface DateList {
  chart_end?: string;
  date_data?: Dates[];
  chart_start?: string;
}

interface DateUnion {
  start?: string;
  end?: string;
}

export interface Project {
  name?: string;
  id?: string;
  hours_per_day?: number;
  total_hours?: number;
  date_union?: DateUnion;
  indicator_offset?: number;
  indicator_width?: number;
  tasks?: any[];
}

export interface Member {
  id?: string;
  name?: string;
  projects?: Project[];
}

export interface Project {
  id?: string;
  projects?: Project[];
}

export interface ScheduleData {
  id?: string;
  project_id?: string;
  team_member_id?: string;
  seconds_per_day?: string;
  total_seconds?: string;
  allocated_from?: Dayjs | null;
  allocated_to?: Dayjs | null;
}

export type PickerType = 'week' | 'month';

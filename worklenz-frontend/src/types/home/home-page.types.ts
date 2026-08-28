import { IMyTask } from './my-tasks.types';
import type { Dayjs } from 'dayjs';

export interface IHomeTasksConfig {
  current_tab: string | null; // active tab in list view
  selected_date: Dayjs | null; // selected date in calendar view
  tasks_group_by: number; // tasks assigned to me / assigned by me
  current_view: number; // list view or calendar view
  is_calendar_view: boolean;
  time_zone: string;
  // Server-side pagination/filtering (My Tasks view) — all optional/additive.
  // Absent means the legacy full-fetch-then-client-filter behavior, which is
  // what TasksList.tsx / HomeContinueCard.tsx still rely on.
  index?: number;
  size?: number;
  status?: string[];
  priorityIds?: string[];
  projectIds?: string[];
  assigneeIds?: string[];
  search?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  overdueOnly?: boolean;
  noDueOnly?: boolean;
}

export interface IHomeTasksModel {
  tasks: IMyTask[];
  total: number;
  today: number;
  upcoming: number;
  overdue: number;
  no_due_date: number;
  in_progress: number;
}

export interface IHomeTaskFilterOptionProject {
  project_id: string;
  project_name: string;
}

export interface IHomeTaskFilterOptionStatus {
  name: string;
}

export interface IHomeTaskFilterOptionAssignee {
  team_member_id: string;
  name: string;
}

export interface IHomeTaskFilterOptions {
  projects: IHomeTaskFilterOptionProject[];
  statuses: IHomeTaskFilterOptionStatus[];
  assignees: IHomeTaskFilterOptionAssignee[];
}

export interface IPersonalTask {
  name: string;
  color_code: '#000';
  end_date?: string;
}

export interface IHomeCalendarTaskAssignee {
  team_member_id: string;
  name: string;
  avatar_url?: string | null;
}

export interface IHomeCalendarTask {
  id: string;
  name: string;
  project_id: string;
  status_id: string;
  end_date: string;
  project_name: string | null;
  project_color: string | null;
  client_id: string | null;
  client_name: string | null;
  priority_id: string | null;
  priority_name: string | null;
  priority_color: string | null;
  status_name: string | null;
  status_color: string | null;
  is_todo: boolean;
  is_doing: boolean;
  is_completed: boolean;
  assignees: IHomeCalendarTaskAssignee[];
}

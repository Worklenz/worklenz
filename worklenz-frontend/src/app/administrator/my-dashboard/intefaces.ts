import {IMyTask} from "@interfaces/my-tasks";

export interface IHomeTasksConfig {
  current_tab: string | null; // active tab in list view
  selected_date: Date | null; // selected date in calendar view
  tasks_group_by: number; // tasks assigned to me / assigned by me
  current_view: number; // list view or calendar view
  is_calendar_view: boolean;
  time_zone: string;
}

export interface IHomeTasksModel {
  tasks: IMyTask[];
  total: number;
  today: number;
  upcoming: number;
  overdue: number;
  no_due_date: number;
}

export interface IPersonalTask {
  name: string;
  color_code: '#000';
  end_date?: string;
}

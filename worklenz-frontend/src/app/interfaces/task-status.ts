import {ITaskStatusCategory} from "@interfaces/task-status-category";

export interface ITaskStatus {
  id?: string;
  name?: string;
  description?: string;
  order_index?: number;
  color_code?: string;
  team_id?: string;
  default_status?: boolean;
  date_created?: string;
  date_updated?: string;
}

export interface IKanbanTaskStatus extends ITaskStatus {
  category_id?: string;
}

export interface ICategorizedStatus {
  category_id: string;
  category_color: string;
  statuses: ITaskStatusCategory[]
}

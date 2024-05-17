import {Moment} from "moment/moment";
import {IProjectTask} from "@interfaces/api-models/project-tasks-view-model";

export interface IRoadmapConfigV2 {
  id: string;
  parent_task?: string;
  timezone: string;
  group?: string;
  isSubtasksInclude: boolean;
  expandedGroups: string[];
}


export interface ITaskDragResponse {
  task_id: string;
  task_width: number;
  task_offset: number;
  start_date: string;
  end_date: string;
  group_id: string;
}

export interface ITaskResizeResponse {
  id: string;
  parent_task: string | null;
  end_date: string;
  start_date: string;
  group_id: string;
}

export interface IDateVerificationResponse {
  task: IProjectTask,
  taskStartDate: string | null,
  taskEndDate: string | null,
  chartStartDate: Moment
}

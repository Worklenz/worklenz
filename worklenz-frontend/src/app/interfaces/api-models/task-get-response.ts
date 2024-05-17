import {ITask} from '@interfaces/task';
import {IGanttChartTasks, IGanttDateRange, IGanttMonthRange, IGanttWeekRange} from '@interfaces/gantt-chart';

export interface ITaskGetRequest extends ITask {
  start: string;
  end: string;
  progress: number;
  priority: string;
}

export interface ITaskByRangeGetRequest extends ITask {
  dates?: IGanttDateRange[],
  weeks?: IGanttWeekRange[],
  months?: IGanttMonthRange[],
  tasks?: IGanttChartTasks[]
}

export interface IProjectRoadmapGetRequest extends ITask {
  dates?: IGanttDateRange[],
  weeks?: IGanttWeekRange[],
  months?: IGanttMonthRange[],
  tasks?: ITask[]
}

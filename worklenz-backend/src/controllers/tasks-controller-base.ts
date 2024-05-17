import WorklenzControllerBase from "./worklenz-controller-base";
import {getColor} from "../shared/utils";
import {PriorityColorCodes, TASK_PRIORITY_COLOR_ALPHA, TASK_STATUS_COLOR_ALPHA} from "../shared/constants";
import moment from "moment/moment";

export const GroupBy = {
  STATUS: "status",
  PRIORITY: "priority",
  LABELS: "labels",
  PHASE: "phase"
};

export interface ITaskGroup {
  id?: string;
  name: string;
  start_date?: string;
  end_date?: string;
  color_code: string;
  category_id: string | null;
  old_category_id?: string;
  todo_progress?: number;
  doing_progress?: number;
  done_progress?: number;
  tasks: any[];
}

export default class TasksControllerBase extends WorklenzControllerBase {
  protected static calculateTaskCompleteRatio(totalCompleted: number, totalTasks: number) {
    if (totalCompleted === 0 && totalTasks === 0) return 0;
    const ratio = ((totalCompleted / totalTasks) * 100);
    return ratio == Infinity ? 100 : ratio.toFixed();
  }

  public static updateTaskViewModel(task: any) {
    task.progress = ~~(task.total_minutes_spent / task.total_minutes * 100);
    task.overdue = task.total_minutes < task.total_minutes_spent;

    task.time_spent = {hours: ~~(task.total_minutes_spent / 60), minutes: task.total_minutes_spent % 60};

    task.comments_count = Number(task.comments_count) ? +task.comments_count : 0;
    task.attachments_count = Number(task.attachments_count) ? +task.attachments_count : 0;

    if (typeof task.sub_tasks_count === "undefined") task.sub_tasks_count = "0";

    task.is_sub_task = !!task.parent_task_id;

    task.time_spent_string = `${task.time_spent.hours}h ${(task.time_spent.minutes)}m`;
    task.total_time_string = `${~~(task.total_minutes / 60)}h ${(task.total_minutes % 60)}m`;

    task.name_color = getColor(task.name);
    task.priority_color = PriorityColorCodes[task.priority_value] || PriorityColorCodes["0"];
    task.show_sub_tasks = false;

    if (task.phase_id) {
      task.phase_color = task.phase_color_code
        ? task.phase_color_code : getColor(task.phase_name) + TASK_PRIORITY_COLOR_ALPHA;
    }

    if (Array.isArray(task.assignees)) {
      for (const assignee of task.assignees) {
        assignee.color_code = getColor(assignee.name);
      }
    }

    task.names = TasksControllerBase.createTagList(task.assignees);

    task.all_labels = task.labels;
    task.labels = TasksControllerBase.createTagList(task.labels, 2);

    task.status_color = task.status_color + TASK_STATUS_COLOR_ALPHA;
    task.priority_color = task.priority_color + TASK_PRIORITY_COLOR_ALPHA;

    if (task.timer_start_time)
      task.timer_start_time = moment(task.timer_start_time).valueOf();

    const totalCompleted = +task.completed_sub_tasks + +task.parent_task_completed;
    const totalTasks = +task.sub_tasks_count + 1; // +1 for parent
    task.complete_ratio = TasksControllerBase.calculateTaskCompleteRatio(totalCompleted, totalTasks);
    task.completed_count = totalCompleted;
    task.total_tasks_count = totalTasks;

    task.width = 35;

    if (task.chart_start) {
      const fToday = moment().format("YYYY-MM-DD");
      task.offset_from = (moment(fToday).diff(task.chart_start, "days")) * 35;
    }

    return task;
  }
}

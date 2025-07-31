import { PriorityColorCodes, TASK_PRIORITY_COLOR_ALPHA, TASK_STATUS_COLOR_ALPHA } from "../../shared/constants";
import { getColor } from "../../shared/utils";
import WorklenzControllerBase from ".././worklenz-controller-base";

export const GroupBy = {
  STATUS: "status",
  PRIORITY: "priority",
  LABELS: "labels",
  PHASE: "phase"
};

export interface IScheduleTaskGroup {
  id?: string;
  name: string;
  color_code: string;
  category_id: string | null;
  old_category_id?: string;
  tasks: any[];
  isExpand: boolean;
}

export default class ScheduleTasksControllerBase extends WorklenzControllerBase {
  protected static calculateTaskCompleteRatio(totalCompleted: number, totalTasks: number) {
    if (totalCompleted === 0 && totalTasks === 0) return 0;
    const ratio = ((totalCompleted / totalTasks) * 100);
    return ratio == Infinity ? 100 : ratio.toFixed();
  }

  public static updateTaskViewModel(task: any) {
    task.progress = ~~(task.total_minutes_spent / task.total_minutes * 100);
    task.overdue = task.total_minutes < task.total_minutes_spent;

    if (typeof task.sub_tasks_count === "undefined") task.sub_tasks_count = "0";

    task.is_sub_task = !!task.parent_task_id;

    task.name_color = getColor(task.name);
    task.priority_color = PriorityColorCodes[task.priority_value] || PriorityColorCodes["0"];
    task.show_sub_tasks = false;

    if (task.phase_id) {
      task.phase_color = task.phase_name
        ? getColor(task.phase_name) + TASK_PRIORITY_COLOR_ALPHA
        : null;
    }

    if (Array.isArray(task.assignees)) {
      for (const assignee of task.assignees) {
        assignee.color_code = getColor(assignee.name);
      }
    }

    task.status_color = task.status_color + TASK_STATUS_COLOR_ALPHA;
    task.priority_color = task.priority_color + TASK_PRIORITY_COLOR_ALPHA;

    const totalCompleted = +task.completed_sub_tasks + +task.parent_task_completed;
    const totalTasks = +task.sub_tasks_count + 1; // +1 for parent
    task.complete_ratio = ScheduleTasksControllerBase.calculateTaskCompleteRatio(totalCompleted, totalTasks);
    task.completed_count = totalCompleted;
    task.total_tasks_count = totalTasks;

    return task;
  }
}

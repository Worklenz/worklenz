import WorklenzControllerBase from "../worklenz-controller-base";
import { getColor } from "../../shared/utils";
import { PriorityColorCodes, TASK_PRIORITY_COLOR_ALPHA, TASK_STATUS_COLOR_ALPHA } from "../../shared/constants";

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


export default class PtTasksControllerBase extends WorklenzControllerBase {

    public static updateTaskViewModel(task: any) {

        task.time_spent = {hours: ~~(task.total_minutes_spent / 60), minutes: task.total_minutes_spent % 60};

        if (typeof task.sub_tasks_count === "undefined") task.sub_tasks_count = "0";

        task.is_sub_task = !!task.parent_task_id;

        task.total_time_string = `${~~(task.total_minutes / 60)}h ${(task.total_minutes % 60)}m`;

        task.priority_color = PriorityColorCodes[task.priority_value] || PriorityColorCodes["0"];
        task.show_sub_tasks = false;

        if (task.phase_id) {
          task.phase_color = task.phase_color
            ? task.phase_color + TASK_PRIORITY_COLOR_ALPHA : getColor(task.phase_name) + TASK_PRIORITY_COLOR_ALPHA;
        }

        task.all_labels = task.labels;
        task.labels = PtTasksControllerBase.createTagList(task.labels, 2);

        task.status_color = task.status_color + TASK_STATUS_COLOR_ALPHA;
        task.priority_color = task.priority_color + TASK_PRIORITY_COLOR_ALPHA;

        return task;
      }

}

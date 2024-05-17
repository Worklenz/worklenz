import moment, { Moment } from "moment";
import WorklenzControllerBase from "../worklenz-controller-base";
import momentTime from "moment-timezone";

export const GroupBy = {
  STATUS: "status",
  PRIORITY: "priority",
  LABELS: "labels",
  PHASE: "phase"
};

export interface IRMTaskGroup {
  id?: string;
  name: string;
  color_code: string;
  category_id: string | null;
  old_category_id?: string;
  tasks: any[];
  is_expanded: boolean;
}

export default class RoadmapTasksControllerV2Base extends WorklenzControllerBase {

  public static updateTaskViewModel(task: any, globalStartDate: Moment, globalDateWidth: number , timeZone: string) {

    if (typeof task.sub_tasks_count === "undefined") task.sub_tasks_count = "0";

    task.is_sub_task = !!task.parent_task_id;

    task.show_sub_tasks = false;

    if (task.start_date)
      task.start_date = momentTime.tz(task.start_date, `${timeZone}`).format("YYYY-MM-DD");

    if (task.end_date)
      task.end_date = momentTime.tz(task.end_date, `${timeZone}`).format("YYYY-MM-DD");

    this.setTaskCss(task, globalStartDate, globalDateWidth);

    task.isVisible = true;

    return task;
  }

  private static setTaskCss(task: any, globalStartDate: Moment, globalDateWidth: number ) {
    let startDate = task.start_date ? moment(task.start_date).format("YYYY-MM-DD") : moment();
    let endDate = task.end_date ? moment(task.end_date).format("YYYY-MM-DD") : moment();

    if (!task.start_date) {
      startDate = moment(task.end_date).format("YYYY-MM-DD");
    }
    if (!task.end_date) {
      endDate = moment(task.start_date).format("YYYY-MM-DD");
    }
    if (!task.start_date && !task.end_date) {
      startDate = moment().format("YYYY-MM-DD");
      endDate = moment().format("YYYY-MM-DD");
    }

    const fStartDate = moment(startDate);
    const fEndDate = moment(endDate);
    const fGlobalStartDate = moment(globalStartDate).format("YYYY-MM-DD");

    const daysDifferenceFromStart = fStartDate.diff(fGlobalStartDate, "days");
    task.offset_from = daysDifferenceFromStart * globalDateWidth;

    if (moment(fStartDate).isSame(moment(fEndDate), "day")) {
      task.width = globalDateWidth;
    } else {
      const taskWidth = fEndDate.diff(fStartDate, "days");
      task.width = (taskWidth + 1) * globalDateWidth;
    }

    return task;
  }

}

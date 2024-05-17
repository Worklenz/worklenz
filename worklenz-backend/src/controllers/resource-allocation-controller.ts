import moment from "moment";

import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import {getDatesForResourceAllocation, getWeekRange} from "../shared/tasks-controller-utils";
import {getColor} from "../shared/utils";


export default class ResourceallocationController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async getProjectWiseResources(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {start, end} = req.query;

    const dates = await getDatesForResourceAllocation(start as string, end as string);
    const months = await getWeekRange(dates);

    const q = `SELECT get_project_wise_resources($1, $2, $3) as resources;`;
    const result = await db.query(q, [start, moment(dates.length && dates.at(-1)?.date).format("YYYY-MM-DD") || end, req.user?.team_id || null]);
    const [data] = result.rows;

    const scheduleData = JSON.parse(data.resources);

    for (const element of scheduleData) {
      for (const schedule of element.schedule) {
        const min = dates.findIndex((date) => moment(schedule.date_series).isSame(date.date, "days")) || 0;
        schedule.min = min + 1;
      }

      for (const task of element.unassigned_tasks) {
        const min = dates.findIndex((date) => moment(task.date_series).isSame(date.date, "days")) || 0;
        task.min = min + 1;
      }

      for (const member of element.project_members) {
        for (const task of member.tasks) {
          const min = dates.findIndex((date) => moment(task.date_series).isSame(date.date, "days")) || 0;
          task.min = min + 1;
        }
      }
    }

    return res.status(200).send(new ServerResponse(true, {projects: scheduleData, dates, months}));
  }

  @HandleExceptions()
  public static async getUserWiseResources(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {start, end} = req.query;

    const dates = await getDatesForResourceAllocation(start as string, end as string);
    const months = await getWeekRange(dates);

    const q = `SELECT get_team_wise_resources($1, $2, $3) as resources;`;
    const result = await db.query(q, [start, moment(dates.length && dates.at(-1)?.date).format("YYYY-MM-DD") || end, req.user?.team_id || null]);
    const [data] = result.rows;

    const scheduleData = JSON.parse(data.resources);

    const obj = [];

    for (const element of scheduleData) {
      element.color_code = getColor(element.name);
      for (const schedule of element.schedule) {
        const min = dates.findIndex((date) => moment(schedule.date_series).isSame(date.date, "days")) || 0;
        schedule.min = min + 1;
      }

      for (const member of element.project_members) {
        for (const task of member.tasks) {
          const min = dates.findIndex((date) => moment(task.date_series).isSame(date.date, "days")) || 0;
          task.min = min + 1;
        }
      }
    }

    return res.status(200).send(new ServerResponse(true, {projects: scheduleData, dates, months}));
  }
}

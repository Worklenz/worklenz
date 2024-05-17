import {ParsedQs} from "qs";

import db from "../../config/db";
import HandleExceptions from "../../decorators/handle-exceptions";
import {IWorkLenzRequest} from "../../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../../interfaces/worklenz-response";
import {ServerResponse} from "../../models/server-response";
import {TASK_PRIORITY_COLOR_ALPHA, TASK_STATUS_COLOR_ALPHA, UNMAPPED} from "../../shared/constants";
import {getColor} from "../../shared/utils";
import RoadmapTasksControllerV2Base, {GroupBy, IRMTaskGroup} from "./roadmap-tasks-contoller-v2-base";
import moment, {Moment} from "moment";
import momentTime from "moment-timezone";

export class TaskListGroup implements IRMTaskGroup {
  name: string;
  category_id: string | null;
  color_code: string;
  tasks: any[];
  is_expanded: boolean;

  constructor(group: any) {
    this.name = group.name;
    this.category_id = group.category_id || null;
    this.color_code = group.color_code + TASK_STATUS_COLOR_ALPHA;
    this.tasks = [];
    this.is_expanded = group.is_expanded;
  }
}

export default class RoadmapTasksControllerV2 extends RoadmapTasksControllerV2Base {

  private static GLOBAL_DATE_WIDTH = 35;
  private static GLOBAL_START_DATE = moment().format("YYYY-MM-DD");
  private static GLOBAL_END_DATE = moment().format("YYYY-MM-DD");

  private static async getFirstLastDates(projectId: string) {

    const q = `SELECT MIN(min_date) AS start_date, MAX(max_date) AS end_date
               FROM (SELECT MIN(start_date) AS min_date, MAX(start_date) AS max_date
                     FROM tasks
                     WHERE project_id = $1 AND tasks.archived IS FALSE
                     UNION
                     SELECT MIN(end_date) AS min_date, MAX(end_date) AS max_date
                     FROM tasks
                     WHERE project_id = $1 AND tasks.archived IS FALSE) AS date_union;`;

    const res = await db.query(q, [projectId]);
    return res.rows[0];
  }

  private static validateEndDate(endDate: Moment): boolean {
    return moment(endDate.format("YYYY-MM-DD")).isBefore(moment(), "day");
  }

  private static validateStartDate(startDate: Moment): boolean {
    return moment(startDate.format("YYYY-MM-DD")).isBefore(moment(), "day");
  }

  private static getScrollAmount(startDate: Moment) {
    const today = moment().format("YYYY-MM-DD");
    const daysDifference = moment(today).diff(startDate, "days");

    return (this.GLOBAL_DATE_WIDTH * daysDifference);
  }

  @HandleExceptions()
  public static async createDateRange(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {

    const dateRange = await this.getFirstLastDates(req.params.id as string);

    const today = new Date();

    let startDate = moment(today).clone().startOf("month");
    let endDate = moment(today).clone().endOf("month");

    if (dateRange.start_date)
      dateRange.start_date = momentTime.tz(dateRange.start_date, `${req.query.timeZone}`).format("YYYY-MM-DD");

    if (dateRange.end_date)
      dateRange.end_date = momentTime.tz(dateRange.end_date, `${req.query.timeZone}`).format("YYYY-MM-DD");

    if (dateRange.start_date && dateRange.end_date) {
      startDate = this.validateStartDate(moment(dateRange.start_date)) ? moment(dateRange.start_date).startOf("month") : moment(today).clone().startOf("month");
      endDate = this.validateEndDate(moment(dateRange.end_date)) ? moment(today).clone().endOf("month") : moment(dateRange.end_date).endOf("month");
    } else if (dateRange.start_date && !dateRange.end_date) {
      startDate = this.validateStartDate(moment(dateRange.start_date)) ? moment(dateRange.start_date).startOf("month") : moment(today).clone().startOf("month");
    } else if (!dateRange.start_date && dateRange.end_date) {
      endDate = this.validateEndDate(moment(dateRange.end_date)) ? moment(today).clone().endOf("month") : moment(dateRange.end_date).endOf("month");
    }

    const xMonthsBeforeStart = startDate.clone().subtract(2, "months");
    const xMonthsAfterEnd = endDate.clone().add(3, "months");

    this.GLOBAL_START_DATE = moment(xMonthsBeforeStart).format("YYYY-MM-DD");
    this.GLOBAL_END_DATE = moment(xMonthsAfterEnd).format("YYYY-MM-DD");

    const dateData = [];
    let days = -1;

    const currentDate = xMonthsBeforeStart.clone();

    while (currentDate.isBefore(xMonthsAfterEnd)) {
      const monthData = {
        month: currentDate.format("MMM YYYY"),
        weeks: [] as number[],
        days: [] as { day: number, name: string, isWeekend: boolean, isToday: boolean }[],
      };
      const daysInMonth = currentDate.daysInMonth();
      for (let day = 1; day <= daysInMonth; day++) {
        const dayOfMonth = currentDate.date();
        const dayName = currentDate.format("ddd");
        const isWeekend = [0, 6].includes(currentDate.day());
        const isToday = moment(moment(today).format("YYYY-MM-DD")).isSame(moment(currentDate).format("YYYY-MM-DD"));
        monthData.days.push({day: dayOfMonth, name: dayName, isWeekend, isToday});
        currentDate.add(1, "day");
        days++;
      }
      dateData.push(monthData);
    }

    const scrollBy = this.getScrollAmount(xMonthsBeforeStart);

    const result = {
      date_data: dateData,
      width: days + 1,
      scroll_by: scrollBy,
      chart_start: moment(this.GLOBAL_START_DATE).format("YYYY-MM-DD"),
      chart_end: moment(this.GLOBAL_END_DATE).format("YYYY-MM-DD")
    };

    return res.status(200).send(new ServerResponse(true, result));
  }

  private static isCountsOnly(query: ParsedQs) {
    return query.count === "true";
  }

  public static isTasksOnlyReq(query: ParsedQs) {
    return RoadmapTasksControllerV2.isCountsOnly(query) || query.parent_task;
  }


  private static getQuery(userId: string, options: ParsedQs) {
    const searchField = options.search ? "t.name" : "sort_order";
    const {searchQuery} = RoadmapTasksControllerV2.toPaginationOptions(options, searchField);

    const isSubTasks = !!options.parent_task;

    const archivedFilter = options.archived === "true" ? "archived IS TRUE" : "archived IS FALSE";

    let subTasksFilter;

    if (options.isSubtasksInclude === "true") {
      subTasksFilter = "";
    } else {
      subTasksFilter = isSubTasks ? "parent_task_id = $2" : "parent_task_id IS NULL";
    }

    const filters = [
      subTasksFilter,
      (isSubTasks ? "1 = 1" : archivedFilter),
    ].filter(i => !!i).join(" AND ");

    return `
      SELECT id,
             name,
             t.project_id AS project_id,
             t.parent_task_id,
             t.parent_task_id IS NOT NULL AS is_sub_task,
             (SELECT COUNT(*)
              FROM tasks
              WHERE parent_task_id = t.id)::INT AS sub_tasks_count,

             t.status_id AS status,
             t.archived,

             (SELECT phase_id FROM task_phase WHERE task_id = t.id) AS phase_id,

             (SELECT COALESCE(ROW_TO_JSON(r), '{}'::JSON)
              FROM (SELECT is_done, is_doing, is_todo
                    FROM sys_task_status_categories
                    WHERE id = (SELECT category_id FROM task_statuses WHERE id = t.status_id)) r) AS status_category,

             (CASE
                WHEN EXISTS(SELECT 1
                            FROM tasks_with_status_view
                            WHERE tasks_with_status_view.task_id = t.id
                              AND is_done IS TRUE) THEN 1
                ELSE 0 END) AS parent_task_completed,

             (SELECT COUNT(*)
              FROM tasks_with_status_view tt
              WHERE tt.parent_task_id = t.id
                AND tt.is_done IS TRUE)::INT
               AS completed_sub_tasks,

             (SELECT id FROM task_priorities WHERE id = t.priority_id) AS priority,
             (SELECT value FROM task_priorities WHERE id = t.priority_id) AS priority_value,
             start_date,
             end_date
      FROM tasks t
      WHERE ${filters} ${searchQuery} AND project_id = $1
      ORDER BY t.start_date ASC NULLS LAST`;
  }

  public static async getGroups(groupBy: string, projectId: string): Promise<IRMTaskGroup[]> {
    let q = "";
    let params: any[] = [];
    switch (groupBy) {
      case GroupBy.STATUS:
        q = `
          SELECT id,
                 name,
                 (SELECT color_code FROM sys_task_status_categories WHERE id = task_statuses.category_id),
                 category_id
          FROM task_statuses
          WHERE project_id = $1
          ORDER BY sort_order;
        `;
        params = [projectId];
        break;
      case GroupBy.PRIORITY:
        q = `SELECT id, name, color_code
             FROM task_priorities
             ORDER BY value DESC;`;
        break;
      case GroupBy.LABELS:
        q = `
          SELECT id, name, color_code
          FROM team_labels
          WHERE team_id = $2
            AND EXISTS(SELECT 1
                       FROM tasks
                       WHERE project_id = $1
                         AND EXISTS(SELECT 1 FROM task_labels WHERE task_id = tasks.id AND label_id = team_labels.id))
          ORDER BY name;
        `;
        break;
      case GroupBy.PHASE:
        q = `
          SELECT id, name, color_code, start_date, end_date
          FROM project_phases
          WHERE project_id = $1
          ORDER BY name;
        `;
        params = [projectId];
        break;

      default:
        break;
    }

    const result = await db.query(q, params);
    return result.rows;
  }

  @HandleExceptions()
  public static async getList(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const isSubTasks = !!req.query.parent_task;
    const groupBy = (req.query.group || GroupBy.STATUS) as string;

    const q = RoadmapTasksControllerV2.getQuery(req.user?.id as string, req.query);
    const params = isSubTasks ? [req.params.id || null, req.query.parent_task] : [req.params.id || null];

    const result = await db.query(q, params);
    const tasks = [...result.rows];

    const groups = await this.getGroups(groupBy, req.params.id);

    const map = groups.reduce((g: { [x: string]: IRMTaskGroup }, group) => {
      if (group.id)
        g[group.id] = new TaskListGroup(group);
      return g;
    }, {});

    this.updateMapByGroup(tasks, groupBy, map, req.query.expandedGroups as string, req.query.timezone as string);

    const updatedGroups = Object.keys(map).map(key => {
      const group = map[key];

      if (groupBy === GroupBy.PHASE)
        group.color_code = getColor(group.name) + TASK_PRIORITY_COLOR_ALPHA;

      return {
        id: key,
        ...group
      };
    });

    if (req.query.expandedGroups) {
      const expandedGroup = updatedGroups.find(g => g.id === req.query.expandedGroups);
      if (expandedGroup) expandedGroup.is_expanded = true;
    } else {
      updatedGroups[0].is_expanded = true;
    }

    return res.status(200).send(new ServerResponse(true, updatedGroups));
  }

  public static updateMapByGroup(tasks: any[], groupBy: string, map: {
    [p: string]: IRMTaskGroup
  }, expandedGroup: string, timeZone: string) {
    let index = 0;
    const unmapped = [];
    for (const task of tasks) {
      task.index = index++;
      RoadmapTasksControllerV2.updateTaskViewModel(task, moment(this.GLOBAL_START_DATE), this.GLOBAL_DATE_WIDTH, timeZone);
      if (groupBy === GroupBy.STATUS) {
        map[task.status]?.tasks.push(task);
      } else if (groupBy === GroupBy.PRIORITY) {
        map[task.priority]?.tasks.push(task);
      } else if (groupBy === GroupBy.PHASE && task.phase_id) {
        map[task.phase_id]?.tasks.push(task);
      } else {
        unmapped.push(task);
      }
    }

    if (unmapped.length) {
      map[UNMAPPED] = {
        name: UNMAPPED,
        category_id: null,
        color_code: "#f0f0f0",
        tasks: unmapped,
        is_expanded: false
      };
    }
  }


  @HandleExceptions()
  public static async getTasksOnly(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const isSubTasks = !!req.query.parent_task;
    const q = RoadmapTasksControllerV2.getQuery(req.user?.id as string, req.query);
    const params = isSubTasks ? [req.params.id || null, req.query.parent_task] : [req.params.id || null];
    const result = await db.query(q, params);

    let data: any[] = [];

    // if true, we only return the record count
    if (this.isCountsOnly(req.query)) {
      [data] = result.rows;
    } else { // else we return a flat list of tasks
      data = [...result.rows];
      for (const task of data) {
        RoadmapTasksControllerV2.updateTaskViewModel(task, moment(this.GLOBAL_START_DATE), this.GLOBAL_DATE_WIDTH, req.query.timeZone as string);
      }
    }

    return res.status(200).send(new ServerResponse(true, data));
  }

}

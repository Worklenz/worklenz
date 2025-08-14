import moment, { Moment } from "moment";
import momentTime from "moment-timezone";
import { ParsedQs } from "qs";
import db from "../../config/db";
import HandleExceptions from "../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { TASK_PRIORITY_COLOR_ALPHA, TASK_STATUS_COLOR_ALPHA, UNMAPPED } from "../../shared/constants";
import { getColor } from "../../shared/utils";
import WLTasksControllerBase, { GroupBy, IWLTaskGroup } from "./workload-gannt-base";

interface IWorkloadTask {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  width: number;
  left: number;
}

export class IWLTaskListGroup implements IWLTaskGroup {
  name: string;
  category_id: string | null;
  color_code: string;
  tasks: any[];
  isExpand: boolean;

  constructor(group: any) {
    this.name = group.name;
    this.category_id = group.category_id || null;
    this.color_code = group.color_code + TASK_STATUS_COLOR_ALPHA;
    this.tasks = [];
    this.isExpand = group.isExpand;
  }
}

export default class WorkloadGanntController extends WLTasksControllerBase {

  private static GLOBAL_DATE_WIDTH = 30;
  private static GLOBAL_START_DATE = moment().format("YYYY-MM-DD");
  private static GLOBAL_END_DATE = moment().format("YYYY-MM-DD");

  private static TASKS_START_DATE_NULL_FILTER = "start_date_null";
  private static TASKS_END_DATE_NULL_FILTER = "end_date_null";
  private static TASKS_START_END_DATES_NULL_FILTER = "start_end_dates_null";

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

  private static async getLogsFirstLastDates(projectId: string) {
    const q = `SELECT  MIN(twl.created_at - INTERVAL '1 second' * twl.time_spent) AS min_date,
                      MAX(twl.created_at - INTERVAL '1 second' * twl.time_spent) AS max_date
                    FROM task_work_log twl
                            INNER JOIN tasks t ON twl.task_id = t.id AND t.archived IS FALSE
                    WHERE t.project_id = $1`;
    const res = await db.query(q, [projectId]);
    return res.rows[0];
  }

  private static validateEndDate(endDate: Moment): boolean {
    return endDate.isBefore(moment(), "day");
  }

  private static validateStartDate(startDate: Moment): boolean {
    return startDate.isBefore(moment(), "day");
  }

  private static getScrollAmount(startDate: Moment) {
    const today = moment();
    const daysDifference = today.diff(startDate, "days");

    return (this.GLOBAL_DATE_WIDTH * daysDifference);
  }

  private static setTaskCss(task: IWorkloadTask) {
    let startDate = task.start_date ? moment(task.start_date) : moment();
    let endDate = task.end_date ? moment(task.end_date) : moment();

    if (!task.start_date) {
      startDate = moment(task.end_date);
    }
    if (!task.end_date) {
      endDate = moment(task.start_date);
    }
    if (!task.start_date && !task.end_date) {
      startDate = moment();
      endDate = moment();
    }

    const daysDifferenceFromStart = startDate.diff(this.GLOBAL_START_DATE, "days");
    task.left = daysDifferenceFromStart * this.GLOBAL_DATE_WIDTH;

    if (moment(startDate).isSame(moment(endDate), "day")) {
      task.width = this.GLOBAL_DATE_WIDTH;
    } else {
      const taskWidth = endDate.diff(startDate, "days");
      task.width = (taskWidth + 1) * this.GLOBAL_DATE_WIDTH;
    }

    return task;
  }

  private static setIndicator(startDate: string, endDate: string) {
    const daysFromStart = moment(startDate).diff(this.GLOBAL_START_DATE, "days");
    const indicatorOffset = daysFromStart * this.GLOBAL_DATE_WIDTH;

    const daysDifference = moment(endDate).diff(startDate, "days");
    const indicatorWidth = (daysDifference + 1) * this.GLOBAL_DATE_WIDTH;

    const body = {
      indicatorOffset,
      indicatorWidth
    };

    return body;

  }

  @HandleExceptions()
  public static async createDateRange(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {

    const dateRange = await this.getFirstLastDates(req.params.id as string);
    const logRange = await this.getLogsFirstLastDates(req.params.id as string);

    const today = new Date();

    let startDate = moment(today).clone().startOf("month");
    let endDate = moment(today).clone().endOf("month");

    this.setChartStartEnd(dateRange, logRange, req.query.timeZone as string);

    if (dateRange.start_date && dateRange.end_date) {
      startDate = this.validateStartDate(moment(dateRange.start_date)) ? moment(dateRange.start_date).startOf("month") : moment(today).clone().startOf("month");
      endDate = this.validateEndDate(moment(dateRange.end_date)) ? moment(today).clone().endOf("month") : moment(dateRange.end_date).endOf("month");
    } else if (dateRange.start_date && !dateRange.end_date) {
      startDate = this.validateStartDate(moment(dateRange.start_date)) ? moment(dateRange.start_date).startOf("month") : moment(today).clone().startOf("month");
    } else if (!dateRange.start_date && dateRange.end_date) {
      endDate = this.validateEndDate(moment(dateRange.end_date)) ? moment(today).clone().endOf("month") : moment(dateRange.end_date).endOf("month");
    }

    const xMonthsBeforeStart = startDate.clone().subtract(1, "months");
    const xMonthsAfterEnd = endDate.clone().add(1, "months");

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
        monthData.days.push({ day: dayOfMonth, name: dayName, isWeekend, isToday });
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

  private static async setChartStartEnd(dateRange: any, logsRange: any, timeZone: string) {

    if (dateRange.start_date)
      dateRange.start_date = momentTime.tz(dateRange.start_date, `${timeZone}`).format("YYYY-MM-DD");

    if (dateRange.end_date)
      dateRange.end_date = momentTime.tz(dateRange.end_date, `${timeZone}`).format("YYYY-MM-DD");

    if (logsRange.min_date)
      logsRange.min_date = momentTime.tz(logsRange.min_date, `${timeZone}`).format("YYYY-MM-DD");

    if (logsRange.max_date)
      logsRange.max_date = momentTime.tz(logsRange.max_date, `${timeZone}`).format("YYYY-MM-DD");

    if (moment(logsRange.min_date ).isBefore(dateRange.start_date))
      dateRange.start_date = logsRange.min_date;

    if (moment(logsRange.max_date ).isAfter(dateRange.endDate))
      dateRange.end_date = logsRange.max_date;

    return dateRange;
  }

  @HandleExceptions()
  public static async getMembers(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {

    const expandedMembers: string[] = req.body?.expanded_members || req.query?.expanded_members || [];

    const q = `SELECT pm.id AS project_member_id,
                      tmiv.team_member_id,
                      tmiv.user_id,
                      name AS name,
                      avatar_url,
                      TRUE AS project_member,
                      
                      -- Organization working settings
                      (SELECT working_hours FROM organizations WHERE id = (SELECT organization_id FROM teams WHERE id = (SELECT team_id FROM team_members WHERE id = tmiv.team_member_id))) AS org_working_hours,
                      (SELECT ROW_TO_JSON(wd) FROM (
                        SELECT monday, tuesday, wednesday, thursday, friday, saturday, sunday
                        FROM organization_working_days 
                        WHERE organization_id = (SELECT organization_id FROM teams WHERE id = (SELECT team_id FROM team_members WHERE id = tmiv.team_member_id))
                      ) wd) AS org_working_days,

                      (SELECT COALESCE(ROW_TO_JSON(rec), '{}'::JSON)
                      FROM (SELECT MIN(LEAST(start_date, end_date)) AS min_date,
                                    MAX(GREATEST(start_date, end_date)) AS max_date
                            FROM tasks
                                      INNER JOIN tasks_assignees ta ON tasks.id = ta.task_id
                            WHERE archived IS FALSE
                              AND project_id = $1
                              AND ta.team_member_id = tmiv.team_member_id) rec) AS duration,

                      (SELECT COALESCE(ROW_TO_JSON(rec), '{}'::JSON)
                      FROM (SELECT  MIN(twl.created_at - INTERVAL '1 second' * twl.time_spent) AS min_date,
                                    MAX(twl.created_at - INTERVAL '1 second' * twl.time_spent) AS max_date
                                  FROM task_work_log twl
                                          INNER JOIN tasks t ON twl.task_id = t.id AND t.archived IS FALSE
                                  WHERE t.project_id = $1
                                    AND twl.user_id = tmiv.user_id) rec) AS logs_date_union,

                      (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                      FROM (SELECT start_date,
                                    end_date
                            FROM tasks
                                      INNER JOIN tasks_assignees ta ON tasks.id = ta.task_id
                            WHERE archived IS FALSE
                              AND project_id = pm.project_id
                              AND ta.team_member_id = tmiv.team_member_id
                            ORDER BY start_date ASC) rec) AS tasks
              FROM project_members pm
                      INNER JOIN team_member_info_view tmiv ON pm.team_member_id = tmiv.team_member_id
              WHERE project_id = $1
              ORDER BY (SELECT MIN(LEAST(start_date, end_date))
                        FROM tasks t
                                  INNER JOIN tasks_assignees ta ON t.id = ta.task_id
                        WHERE t.archived IS FALSE
                          AND t.project_id = $1
                          AND ta.team_member_id = tmiv.team_member_id) ASC NULLS LAST`;

    const result = await db.query(q, [req.params.id]);

    for (const member of result.rows) {
      member.color_code = getColor(member.TaskName);
      
      // Set default working settings if organization data is not available
      member.org_working_hours = member.org_working_hours || 8;
      member.org_working_days = member.org_working_days || {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false
      };

      this.setMaxMinDate(member, req.query.timeZone as string);

      // if (member.duration[0].min_date)
      //   member.duration[0].min_date = momentTime.tz(member.duration[0].min_date, `${req.query.timeZone}`).format("YYYY-MM-DD");

      // if (member.duration[0].max_date)
      //   member.duration[0].max_date = momentTime.tz(member.duration[0].max_date, `${req.query.timeZone}`).format("YYYY-MM-DD");

      const fStartDate = member.duration.min_date ? moment(member.duration.min_date).format("YYYY-MM-DD") : moment().format("YYYY-MM-DD");
      const fEndDate = member.duration.max_date ? moment(member.duration.max_date).format("YYYY-MM-DD") : moment().format("YYYY-MM-DD");

      if (member.tasks.length > 0) {
        const styles = this.setIndicator(fStartDate, fEndDate);
        member.indicator_offset = styles.indicatorOffset;
        member.indicator_width = styles.indicatorWidth;
        member.not_allocated = false;
      } else {
        member.indicator_offset = 0;
        member.indicator_width = 0;
        member.not_allocated = true;
      }

      member.tasks_start_date = member.duration.min_date;
      member.tasks_end_date = member.duration.max_date;
      member.tasks_stats = await WorkloadGanntController.getMemberTasksStats(member.tasks);
    }

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  private static async setMaxMinDate(member: any, timeZone: string) {

    if (member.duration.min_date)
      member.duration.min_date = momentTime.tz(member.duration.min_date, `${timeZone}`).format("YYYY-MM-DD");

    if (member.duration.max_date)
      member.duration.max_date = momentTime.tz(member.duration.max_date, `${timeZone}`).format("YYYY-MM-DD");

    if (member.duration.min_date && member.duration.max_date && member.logs_date_union.min_date && member.logs_date_union.max_date) {

      const durationMin = momentTime.tz(member.duration.min_date, `${timeZone}`).format("YYYY-MM-DD");
      const durationMax = momentTime.tz(member.duration.max_date, `${timeZone}`).format("YYYY-MM-DD");
      const logMin = momentTime.tz(member.logs_date_union.min_date, `${timeZone}`).format("YYYY-MM-DD");
      const logMax = momentTime.tz(member.logs_date_union.max_date, `${timeZone}`).format("YYYY-MM-DD");

      if (moment(logMin).isBefore(durationMin)) {
        member.duration.min_date = logMin;
      }
      if (moment(logMax).isAfter(durationMax)) {
        member.duration.max_date = logMax;
      }

      return member;

    }

    if (!member.duration.min_date && !member.duration.max_date && member.logs_date_union.min_date && member.logs_date_union.max_date) {

      const logMin = momentTime.tz(member.logs_date_union.min_date, `${timeZone}`).format("YYYY-MM-DD");
      const logMax = momentTime.tz(member.logs_date_union.max_date, `${timeZone}`).format("YYYY-MM-DD");

      member.duration.min_date = logMin;
      member.duration.max_date = logMax;

      return member;
    }

    return member;

  }



  private static async getMemberTasksStats(tasks: { start_date: string | null, end_date: string | null }[]) {
    const tasksCount = tasks.length;
    let nullStartCount = 0;
    let nullEndCount = 0;
    let nullBothCount = 0;

    for (const task of tasks) {
      if ((!task.start_date || task.start_date.trim() === "") && (!task.end_date || task.end_date.trim() === "")) {
        nullBothCount++;
      } else if ((!task.start_date || task.start_date.trim() === "") && (task.end_date)) {
        nullStartCount++;
      } else if ((!task.end_date || task.end_date.trim() === "") && (task.start_date)) {
        nullEndCount++;
      }
    }

    const body = {
      total: tasksCount,
      null_start_dates: nullStartCount,
      null_end_dates: nullEndCount,
      null_start_end_dates: nullBothCount,
      null_start_dates_percentage: (nullStartCount / tasksCount) * 100,
      null_end_dates_percentage: (nullEndCount / tasksCount) * 100,
      null_start_end_dates_percentage: (nullBothCount / tasksCount) * 100,
      available_start_end_dates_percentage: ((tasksCount - (nullStartCount + nullEndCount + nullBothCount)) / tasksCount) * 100
    };
    return body;
  }

  // ********************************************

  private static isCountsOnly(query: ParsedQs) {
    return query.count === "true";
  }

  public static isTasksOnlyReq(query: ParsedQs) {
    return WorkloadGanntController.isCountsOnly(query) || query.parent_task;
  }

  private static flatString(text: string) {
    return (text || "").split(" ").map(s => `'${s}'`).join(",");
  }

  private static getFilterByDatesWhereClosure(text: string) {
    let closure = "";
    switch (text.trim()) {
      case "":
        closure = ``;
        break;
      case WorkloadGanntController.TASKS_START_DATE_NULL_FILTER:
        closure = `start_date IS NULL AND end_date IS NOT NULL`;
        break;
      case WorkloadGanntController.TASKS_END_DATE_NULL_FILTER:
        closure = `start_date IS NOT NULL AND end_date IS NULL`;
        break;
      case WorkloadGanntController.TASKS_START_END_DATES_NULL_FILTER:
        closure = `start_date IS NULL AND end_date IS NULL`;
        break;
    }
    return closure;
  }

  private static getFilterByMembersWhereClosure(text: string) {
    return text
      ? `id IN (SELECT task_id FROM tasks_assignees WHERE team_member_id IN (${this.flatString(text)}))`
      : "";
  }

  private static getStatusesQuery(filterBy: string) {
    return filterBy === "member"
      ? `, (SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
      FROM (SELECT task_statuses.id, task_statuses.name, stsc.color_code
          FROM task_statuses
              INNER JOIN sys_task_status_categories stsc ON task_statuses.category_id = stsc.id
          WHERE project_id = t.project_id
          ORDER BY task_statuses.name) rec) AS statuses`
      : "";
  }

  public static async getTaskCompleteRatio(taskId: string): Promise<{
    ratio: number;
    total_completed: number;
    total_tasks: number;
  } | null> {
    try {
      const result = await db.query("SELECT get_task_complete_ratio($1) AS info;", [taskId]);
      const [data] = result.rows;
      data.info.ratio = +data.info.ratio.toFixed();
      return data.info;
    } catch (error) {
      return null;
    }
  }

  private static getQuery(userId: string, options: ParsedQs) {
    const searchField = options.search ? "t.name" : "sort_order";
    const { searchQuery, sortField } = WorkloadGanntController.toPaginationOptions(options, searchField);

    const isSubTasks = !!options.parent_task;

    const sortFields = sortField.replace(/ascend/g, "ASC").replace(/descend/g, "DESC") || "sort_order";
    // Filter tasks by its members
    const membersFilter = WorkloadGanntController.getFilterByMembersWhereClosure(options.members as string);
    // Returns statuses of each task as a json array if filterBy === "member"
    const statusesQuery = WorkloadGanntController.getStatusesQuery(options.filterBy as string);

    const archivedFilter = options.archived === "true" ? "archived IS TRUE" : "archived IS FALSE";

    const datesFilter = WorkloadGanntController.getFilterByDatesWhereClosure(options.dateChecker as string);


    let subTasksFilter;

    if (options.isSubtasksInclude === "true") {
      subTasksFilter = "";
    } else {
      subTasksFilter = isSubTasks ? "parent_task_id = $2" : "parent_task_id IS NULL";
    }

    const filters = [
      subTasksFilter,
      (isSubTasks ? "1 = 1" : archivedFilter),
      membersFilter,
      datesFilter
    ].filter(i => !!i).join(" AND ");

    return `
      SELECT id,
             name,
             t.project_id AS project_id,
             t.parent_task_id,
             t.parent_task_id IS NOT NULL AS is_sub_task,
             (SELECT name FROM tasks WHERE id = t.parent_task_id) AS parent_task_name,
             (SELECT COUNT(*)
              FROM tasks
              WHERE parent_task_id = t.id)::INT AS sub_tasks_count,

             t.status_id AS status,
             t.archived,
             t.sort_order,

             (SELECT phase_id FROM task_phase WHERE task_id = t.id) AS phase_id,
             (SELECT name
              FROM project_phases
              WHERE id = (SELECT phase_id FROM task_phase WHERE task_id = t.id)) AS phase_name,


             (SELECT color_code
              FROM sys_task_status_categories
              WHERE id = (SELECT category_id FROM task_statuses WHERE id = t.status_id)) AS status_color,

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
             (SELECT get_task_assignees(t.id)) AS assignees,
             (SELECT COUNT(*)
              FROM tasks_with_status_view tt
              WHERE tt.parent_task_id = t.id
                AND tt.is_done IS TRUE)::INT
               AS completed_sub_tasks,

             (SELECT id FROM task_priorities WHERE id = t.priority_id) AS priority,
             (SELECT value FROM task_priorities WHERE id = t.priority_id) AS priority_value,
             total_minutes,
             start_date,
             end_date ${statusesQuery}
      FROM tasks t
      WHERE ${filters} ${searchQuery} AND project_id = $1
      ORDER BY end_date DESC NULLS LAST
    `;
  }

  public static async getGroups(groupBy: string, projectId: string): Promise<IWLTaskGroup[]> {
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
    for (const row of result.rows) {
      row.isExpand = true;
    }
    return result.rows;
  }

  @HandleExceptions()
  public static async getList(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const isSubTasks = !!req.query.parent_task;
    const groupBy = (req.query.group || GroupBy.STATUS) as string;

    const q = WorkloadGanntController.getQuery(req.user?.id as string, req.query);
    const params = isSubTasks ? [req.params.id || null, req.query.parent_task] : [req.params.id || null];

    const result = await db.query(q, params);
    const tasks = [...result.rows];

    const groups = await this.getGroups(groupBy, req.params.id);
    const map = groups.reduce((g: { [x: string]: IWLTaskGroup }, group) => {
      if (group.id)
        g[group.id] = new IWLTaskListGroup(group);
      return g;
    }, {});

    this.updateMapByGroup(tasks, groupBy, map);

    const updatedGroups = Object.keys(map).map(key => {
      const group = map[key];

      if (groupBy === GroupBy.PHASE)
        group.color_code = getColor(group.name) + TASK_PRIORITY_COLOR_ALPHA;

      return {
        id: key,
        ...group
      };
    });

    return res.status(200).send(new ServerResponse(true, updatedGroups));
  }

  public static updateMapByGroup(tasks: any[], groupBy: string, map: { [p: string]: IWLTaskGroup }) {
    let index = 0;
    const unmapped = [];
    for (const task of tasks) {
      task.index = index++;
      WorkloadGanntController.updateTaskViewModel(task);
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
        isExpand: true
      };
    }
  }


  @HandleExceptions()
  public static async getTasksOnly(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const isSubTasks = !!req.query.parent_task;
    const q = WorkloadGanntController.getQuery(req.user?.id as string, req.query);
    const params = isSubTasks ? [req.params.id || null, req.query.parent_task] : [req.params.id || null];
    const result = await db.query(q, params);

    let data: any[] = [];

    // if true, we only return the record count
    if (this.isCountsOnly(req.query)) {
      [data] = result.rows;
    } else { // else we return a flat list of tasks
      data = [...result.rows];
      for (const task of data) {
        WorkloadGanntController.updateTaskViewModel(task);
      }
    }

    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async getMemberOverview(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {

    const projectId = req.params.id;
    const teamMemberId = req.query.team_member_id;

    const getCountByStatus = await WorkloadGanntController.getTasksCountsByStatus(projectId, teamMemberId as string);
    const getCountByPriority = await WorkloadGanntController.getTasksCountsByPriority(projectId, teamMemberId as string);
    const getCountByPhase = await WorkloadGanntController.getTasksCountsByPhase(projectId, teamMemberId as string);
    const getCountByDates = await WorkloadGanntController.getTasksCountsByDates(projectId, teamMemberId as string);
    const data = {
      by_status: getCountByStatus,
      by_priority: getCountByPriority,
      by_phase: getCountByPhase,
      by_dates: getCountByDates
    };
    return res.status(200).send(new ServerResponse(true, data));
  }

  private static async getTasksCountsByStatus(projectId: string, teamMemberId: string) {
    const q = `SELECT ts.id,
                      ts.name AS label,
                      (SELECT color_code FROM sys_task_status_categories WHERE id = ts.category_id) AS color_code,
                      (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                      FROM (SELECT COUNT(*)
                            FROM tasks t
                            WHERE t.project_id = $1
                              AND t.archived IS FALSE
                              AND t.id IN (SELECT task_id
                                            FROM tasks_assignees
                                            WHERE team_member_id = $2)
                              AND t.status_id = ts.id) rec) AS counts
                  FROM task_statuses ts
                  WHERE project_id = $1`;
    const res = await db.query(q, [projectId, teamMemberId]);
    for (const row of res.rows) {
      row.tasks_count = row.counts[0].count;
    }
    return res.rows;
  }

  private static async getTasksCountsByPriority(projectId: string, teamMemberId: string) {
    const q = `SELECT tp.id,
                      tp.name AS label,
                      tp.color_code,
                      (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                      FROM (SELECT COUNT(*)
                            FROM tasks t
                            WHERE t.project_id = $1
                              AND t.archived IS FALSE
                              AND t.id IN (SELECT task_id
                                            FROM tasks_assignees
                                            WHERE team_member_id = $2)
                              AND t.priority_id = tp.id) rec) AS counts
                  FROM task_priorities tp`;
    const res = await db.query(q, [projectId, teamMemberId]);
    for (const row of res.rows) {
      row.tasks_count = row.counts[0].count;
    }
    return res.rows;
  }

  private static async getTasksCountsByPhase(projectId: string, teamMemberId: string) {
    const q = `SELECT pp.id,
                      pp.name AS label,
                      pp.color_code AS color_code,
                      COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON) AS counts
                FROM project_phases pp
                  LEFT JOIN (SELECT pp.id AS phase_id,
                                    COUNT(ta.task_id) AS task_count
                             FROM project_phases pp
                                    LEFT JOIN task_phase tp ON pp.id = tp.phase_id
                                    LEFT JOIN tasks t ON tp.task_id = t.id
                                    LEFT JOIN tasks_assignees ta ON t.id = ta.task_id AND ta.team_member_id = $2
                             WHERE pp.project_id = $1
                             GROUP BY pp.id ) rec ON pp.id = rec.phase_id
                WHERE pp.project_id = $1
                GROUP BY pp.id`;
    const res = await db.query(q, [projectId, teamMemberId]);
    for (const row of res.rows) {
      row.tasks_count = row.counts[0].task_count;
      row.color_code = getColor(row.label) + TASK_PRIORITY_COLOR_ALPHA;
    }
    return res.rows;
  }

  private static async getTasksCountsByDates(projectId: string, teamMemberId: string) {
    const q = `SELECT JSON_BUILD_OBJECT(
                'having_start_end_date', (SELECT COUNT(*)
                                            FROM tasks
                                            WHERE project_id = $1
                                              AND archived IS FALSE
                                              AND id IN (SELECT task_id
                                                        FROM tasks_assignees
                                                        WHERE team_member_id = $2)
                                              AND end_date IS NOT NULL AND start_date IS NOT NULL),
                  'no_end_date', (SELECT COUNT(*)
                                  FROM tasks
                                  WHERE project_id = $1
                                    AND archived IS FALSE
                                    AND id IN (SELECT task_id
                                              FROM tasks_assignees
                                              WHERE team_member_id = $2)
                                    AND end_date IS NULL AND start_date IS NOT NULL),
                  'no_start_date', (SELECT COUNT(*)
                                    FROM tasks
                                    WHERE project_id = $1
                                      AND archived IS FALSE
                                      AND id IN (SELECT task_id
                                                  FROM tasks_assignees
                                                  WHERE team_member_id = $2)
                                      AND end_date IS NOT NULL AND start_date IS NULL),
                  'no_start_end_dates', (SELECT COUNT(*)
                                        FROM tasks
                                        WHERE project_id = $1
                                          AND archived IS FALSE
                                          AND id IN (SELECT task_id
                                                      FROM tasks_assignees
                                                      WHERE team_member_id = $2)
                                          AND end_date IS NULL AND start_date IS NULL)) AS counts`;
    const res = await db.query(q, [projectId, teamMemberId]);
    const data = [
      {
        id: "",
        label: "Having start & end date",
        color_code: "#f0f0f0",
        tasks_count: res.rows[0].counts.having_start_end_date
      },
      {
        id: "",
        label: "Without end date",
        color_code: "#F9A0A0BF",
        tasks_count: res.rows[0].counts.no_end_date
      },
      {
        id: "",
        label: "Without start date",
        color_code: "#F8A9A98C",
        tasks_count: res.rows[0].counts.no_start_date
      },
      {
        id: "",
        label: "Without start & end date",
        color_code: "#F7A7A7E5",
        tasks_count: res.rows[0].counts.no_start_end_dates
      },
    ];
    return data;
  }

  // @HandleExceptions()
  // public static async getTasksByTeamMeberId(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
  //   const memberTasks = await this.getMemberTasks(req.params.id, req.body.team_member_id);
  //   return res.status(200).send(new ServerResponse(true, memberTasks));
  // }

  // private static async getMemberTasks(projectId: string, teamMemberId: string) {
  //   const q = `
  //             SELECT id AS task_id,
  //               name AS task_name,
  //               start_date AS start_date,
  //               end_date AS end_date
  //             FROM tasks
  //                     INNER JOIN tasks_assignees ta ON tasks.id = ta.task_id
  //             WHERE archived IS FALSE
  //               AND project_id = $1
  //               AND ta.team_member_id = $2
  //             ORDER BY start_date ASC`;
  //   const result = await db.query(q, [projectId, teamMemberId]);

  //   for (const task of result.rows) {
  //     this.setTaskCss(task);
  //   }

  //   return result.rows;

  // }

}

import db from "../../config/db";
import { ParsedQs } from "qs";
import HandleExceptions from "../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { SqlHelper } from "../../shared/sql-helpers";
import { TASK_PRIORITY_COLOR_ALPHA, TASK_STATUS_COLOR_ALPHA, UNMAPPED } from "../../shared/constants";
import { getColor } from "../../shared/utils";
import moment, { Moment } from "moment";
import momentTime from "moment-timezone";
import ScheduleTasksControllerBase, { GroupBy, IScheduleTaskGroup } from "./schedule-controller-base";

interface IDateUnions {
  date_union: {
    start_date: string | null;
    end_date: string | null;
  },
  logs_date_union: {
    start_date: string | null;
    end_date: string | null;
  },
  allocated_date_union: {
    start_date: string | null;
    end_date: string | null;
  }
}

interface IDatesPair {
  start_date: string | null,
  end_date: string | null
}

export class IScheduleTaskListGroup implements IScheduleTaskGroup {
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

export default class ScheduleControllerV2 extends ScheduleTasksControllerBase {

  private static GLOBAL_DATE_WIDTH = 35;
  private static GLOBAL_START_DATE = moment().format("YYYY-MM-DD");
  private static GLOBAL_END_DATE = moment().format("YYYY-MM-DD");

  // Migrate data
  @HandleExceptions()
  public static async migrate(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const getDataq = `SELECT p.id,
    (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
     FROM (SELECT tmiv.team_member_id,
                  tmiv.user_id,

                  LEAST(
                          (SELECT MIN(LEAST(start_date, end_date)) AS start_date
                           FROM tasks
                                    INNER JOIN tasks_assignees ta ON tasks.id = ta.task_id
                           WHERE archived IS FALSE
                             AND project_id = p.id
                             AND ta.team_member_id = tmiv.team_member_id),
                          (SELECT MIN(twl.created_at - INTERVAL '1 second' * twl.time_spent) AS ll_start_date
                           FROM task_work_log twl
                                    INNER JOIN tasks t ON twl.task_id = t.id AND t.archived IS FALSE
                           WHERE t.project_id = p.id
                             AND twl.user_id = tmiv.user_id)
                      ) AS lowest_date,

                  GREATEST(
                          (SELECT MAX(GREATEST(start_date, end_date)) AS end_date
                           FROM tasks
                                    INNER JOIN tasks_assignees ta ON tasks.id = ta.task_id
                           WHERE archived IS FALSE
                             AND project_id = p.id
                             AND ta.team_member_id = tmiv.team_member_id),
                          (SELECT MAX(twl.created_at - INTERVAL '1 second' * twl.time_spent) AS ll_end_date
                           FROM task_work_log twl
                                    INNER JOIN tasks t ON twl.task_id = t.id AND t.archived IS FALSE
                           WHERE t.project_id = p.id
                             AND twl.user_id = tmiv.user_id)
                      ) AS greatest_date

           FROM project_members pm
                    INNER JOIN team_member_info_view tmiv
                               ON pm.team_member_id = tmiv.team_member_id
           WHERE project_id = p.id) rec) AS members

FROM projects p
WHERE team_id IS NOT NULL
AND p.id NOT IN (SELECT project_id FROM archived_projects)`;

    const projectMembersResults = await db.query(getDataq);

    const projectMemberData = projectMembersResults.rows;

    const arrayToInsert = [];

    for (const data of projectMemberData) {
      if (data.members.length) {
        for (const member of data.members) {

          const body = {
            project_id: data.id,
            team_member_id: member.team_member_id,
            allocated_from: member.lowest_date ? member.lowest_date : null,
            allocated_to: member.greatest_date ? member.greatest_date : null
          };

          if (body.allocated_from && body.allocated_to) arrayToInsert.push(body);

        }
      }
    }

    const insertArray = JSON.stringify(arrayToInsert);

    const insertFunctionCall = `SELECT migrate_member_allocations($1)`;
    await db.query(insertFunctionCall, [insertArray]);

    return res.status(200).send(new ServerResponse(true, ""));
  }


  private static async getFirstLastDates(teamId: string, userId: string) {
    const q = `WITH all_member_dates AS (
                    -- Get dates from project_member_allocations
                    SELECT allocated_from AS date_value, allocated_to AS date_value_2
                    FROM project_member_allocations
                    WHERE project_id IN (SELECT id FROM projects WHERE team_id = $1)
                    
                    UNION
                    
                    -- Get dates from task assignments
                    SELECT t.start_date AS date_value, t.end_date AS date_value_2
                    FROM tasks t
                    INNER JOIN tasks_assignees ta ON t.id = ta.task_id
                    INNER JOIN project_members pm ON ta.project_member_id = pm.id
                    WHERE t.project_id IN (SELECT id FROM projects WHERE team_id = $1)
                      AND t.project_id NOT IN (SELECT project_id FROM archived_projects WHERE user_id = $2)
                      AND t.archived IS FALSE
                      AND t.start_date IS NOT NULL
                      AND t.end_date IS NOT NULL
                  )
                  SELECT MIN(LEAST(date_value, date_value_2)) AS start_date,
                        MAX(GREATEST(date_value, date_value_2)) AS end_date,
                        (SELECT COALESCE(ROW_TO_JSON(rec), '{}'::JSON)
                        FROM (SELECT MIN(min_date) AS start_date, MAX(max_date) AS end_date
                              FROM (SELECT MIN(start_date) AS min_date, MAX(start_date) AS max_date
                                    FROM tasks
                                    WHERE project_id IN (SELECT id FROM projects WHERE team_id = $1)
                                      AND project_id NOT IN
                                          (SELECT project_id
                                            FROM archived_projects
                                            WHERE user_id = $2)
                                      AND tasks.archived IS FALSE
                                    UNION
                                    SELECT MIN(end_date) AS min_date, MAX(end_date) AS max_date
                                    FROM tasks
                                    WHERE project_id IN (SELECT id FROM projects WHERE team_id = $1)
                                      AND project_id NOT IN
                                          (SELECT project_id
                                            FROM archived_projects
                                            WHERE user_id = $2)
                                      AND tasks.archived IS FALSE) AS dates) rec) AS date_union,
                        (SELECT COALESCE(ROW_TO_JSON(rec), '{}'::JSON)
                        FROM (SELECT MIN(twl.created_at - INTERVAL '1 second' * twl.time_spent) AS start_date,
                                      MAX(twl.created_at - INTERVAL '1 second' * twl.time_spent) AS end_date
                              FROM task_work_log twl
                                        INNER JOIN tasks t ON twl.task_id = t.id AND t.archived IS FALSE
                              WHERE t.project_id IN (SELECT id FROM projects WHERE team_id = $1)
                                AND project_id NOT IN
                                    (SELECT project_id
                                      FROM archived_projects
                                      WHERE user_id = $2)) rec) AS logs_date_union
                    FROM all_member_dates`;

    const res = await db.query(q, [teamId, userId]);
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

  private static setAllocationIndicator(item: any) {
    if (moment(item.allocated_from).isValid() && moment(item.allocated_to).isValid()) {
      const daysFromStart = moment(item.allocated_from).diff(this.GLOBAL_START_DATE, "days");
      const indicatorOffset = daysFromStart * this.GLOBAL_DATE_WIDTH;

      const daysDifference = moment(item.allocated_to).diff(item.allocated_from, "days");
      const indicatorWidth = (daysDifference + 1) * this.GLOBAL_DATE_WIDTH;

      return { indicatorOffset, indicatorWidth };
    }

    return null;

  }

  private static setIndicatorWithLogIndicator(item: any) {

    const daysFromStart = moment(item.start_date).diff(this.GLOBAL_START_DATE, "days");
    const indicatorOffset = daysFromStart * this.GLOBAL_DATE_WIDTH;

    const daysDifference = moment(item.end_date).diff(item.start_date, "days");
    const indicatorWidth = (daysDifference + 1) * this.GLOBAL_DATE_WIDTH;

    let logIndicatorOffset = 0;
    let logIndicatorWidth = 0;

    if (item.logs_date_union && item.logs_date_union.start_date && item.logs_date_union.end_date) {
      const daysFromIndicatorStart = moment(item.logs_date_union.start_date).diff(item.start_date, "days");
      logIndicatorOffset = daysFromIndicatorStart * this.GLOBAL_DATE_WIDTH;

      const daysDifferenceFromIndicator = moment(item.logs_date_union.end_date).diff(item.logs_date_union.start_date, "days");
      logIndicatorWidth = (daysDifferenceFromIndicator + 1) * this.GLOBAL_DATE_WIDTH;
    }

    const body = {
      indicatorOffset,
      indicatorWidth,
      logIndicatorOffset,
      logIndicatorWidth
    };

    return body;

  }

  private static async setChartStartEnd(dateRange: IDatesPair, logsRange: IDatesPair, allocatedRange: IDatesPair, timeZone: string) {

    const datesToCheck = [];

    const body = {
      date_union: {
        start_date: dateRange.start_date ? momentTime.tz(dateRange.start_date, `${timeZone}`).format("YYYY-MM-DD") : null,
        end_date: dateRange.end_date ? momentTime.tz(dateRange.end_date, `${timeZone}`).format("YYYY-MM-DD") : null,
      },
      logs_date_union: {
        start_date: logsRange.start_date ? momentTime.tz(logsRange.start_date, `${timeZone}`).format("YYYY-MM-DD") : null,
        end_date: logsRange.end_date ? momentTime.tz(logsRange.end_date, `${timeZone}`).format("YYYY-MM-DD") : null,
      },
      allocated_date_union: {
        start_date: allocatedRange.start_date ? momentTime.tz(allocatedRange.start_date, `${timeZone}`).format("YYYY-MM-DD") : null,
        end_date: allocatedRange.end_date ? momentTime.tz(allocatedRange.end_date, `${timeZone}`).format("YYYY-MM-DD") : null,
      }
    };

    for (const dateKey in body) {
      if (body[dateKey as keyof IDateUnions] && body[dateKey as keyof IDateUnions].start_date) {
        datesToCheck.push(moment(body[dateKey as keyof IDateUnions].start_date));
      }
      if (body[dateKey as keyof IDateUnions] && body[dateKey as keyof IDateUnions].end_date) {
        datesToCheck.push(moment(body[dateKey as keyof IDateUnions].end_date));
      }
    }

    const validDateToCheck = datesToCheck.filter((date) => date.isValid());

    dateRange.start_date = moment.min(validDateToCheck).format("YYYY-MM-DD");
    dateRange.end_date = moment.max(validDateToCheck).format("YYYY-MM-DD");

    return dateRange;
  }

  private static async mainDateValidator(dateRange: any) {
    const today = new Date();
    let startDate = moment(today).clone().startOf("year");
    let endDate = moment(today).clone().endOf("year").add(1, "year");

    if (dateRange.start_date && dateRange.end_date) {
      startDate = this.validateStartDate(moment(dateRange.start_date)) ? moment(dateRange.start_date).startOf("year") : moment(today).clone().startOf("year");
      endDate = this.validateEndDate(moment(dateRange.end_date)) ? moment(today).clone().endOf("year") : moment(dateRange.end_date).endOf("year");
    } else if (dateRange.start_date && !dateRange.end_date) {
      startDate = this.validateStartDate(moment(dateRange.start_date)) ? moment(dateRange.start_date).startOf("year") : moment(today).clone().startOf("year");
    } else if (!dateRange.start_date && dateRange.end_date) {
      endDate = this.validateEndDate(moment(dateRange.end_date)) ? moment(today).clone().endOf("year") : moment(dateRange.end_date).endOf("year");
    }
    return { startDate, endDate, today };
  }

  private static async createDateColumns(xMonthsBeforeStart: Moment, xMonthsAfterEnd: Moment, today: Date) {
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

    return { dateData, days };

  }

  @HandleExceptions()
  public static async createDateRange(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {

    const dates = await this.getFirstLastDates(req.params.id as string, req.user?.id as string);

    const dateRange = dates.date_union;
    const logsRange = dates.logs_date_union;
    const allocatedRange = { start_date: dates.start_date, end_date: dates.end_date };

    await this.setChartStartEnd(dateRange, logsRange, allocatedRange, req.query.timeZone as string);

    const { startDate, endDate, today } = await this.mainDateValidator(dateRange);

    const xMonthsBeforeStart = startDate.clone().subtract(3, "months");
    const xMonthsAfterEnd = endDate.clone().add(2, "year");

    this.GLOBAL_START_DATE = moment(xMonthsBeforeStart).format("YYYY-MM-DD");
    this.GLOBAL_END_DATE = moment(xMonthsAfterEnd).format("YYYY-MM-DD");

    const { dateData, days } = await this.createDateColumns(xMonthsBeforeStart, xMonthsAfterEnd, today);

    const scrollBy = await this.getScrollAmount(xMonthsBeforeStart);

    const result = {
      date_data: dateData,
      width: days + 1,
      scroll_by: scrollBy,
      chart_start: moment(this.GLOBAL_START_DATE).format("YYYY-MM-DD"),
      chart_end: moment(this.GLOBAL_END_DATE).format("YYYY-MM-DD")
    };

    return res.status(200).send(new ServerResponse(true, result));
  }

  private static async getProjectsQuery(teamId: string, userId: string) {
    const q = `SELECT p.id,
                      p.name,

                      (SELECT COALESCE(ROW_TO_JSON(rec), '{}'::JSON)
                      FROM (SELECT MIN(min_date) AS start_date, MAX(max_date) AS end_date
                            FROM (
                                  -- Dates from project_member_allocations
                                  SELECT MIN(allocated_from) AS min_date, MAX(allocated_from) AS max_date
                                  FROM project_member_allocations
                                  WHERE project_id = p.id
                                  UNION
                                  SELECT MIN(allocated_to) AS min_date, MAX(allocated_to) AS max_date
                                  FROM project_member_allocations
                                  WHERE project_id = p.id
                                  UNION
                                  -- Dates from task assignments
                                  SELECT MIN(t.start_date) AS min_date, MAX(t.start_date) AS max_date
                                  FROM tasks t
                                  WHERE t.project_id = p.id
                                    AND t.archived IS FALSE
                                    AND t.start_date IS NOT NULL
                                  UNION
                                  SELECT MIN(t.end_date) AS min_date, MAX(t.end_date) AS max_date
                                  FROM tasks t
                                  WHERE t.project_id = p.id
                                    AND t.archived IS FALSE
                                    AND t.end_date IS NOT NULL
                                ) AS dates) rec) AS date_union,

                      (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                      FROM (SELECT pm.id AS project_member_id,
                                    tmiv.team_member_id,
                                    tmiv.user_id,
                                    name AS name,
                                    avatar_url,
                                    TRUE AS project_member,

                                    EXISTS(SELECT email
                                      FROM email_invitations
                                      WHERE team_member_id = tmiv.team_member_id
                                        AND email_invitations.team_id = $1) AS pending_invitation,

                                    (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                                    FROM (SELECT
                                      pma.id,
                                      pma.allocated_from,
                                      pma.allocated_to
                                          FROM project_member_allocations pma
                                          WHERE pma.team_member_id = tmiv.team_member_id
                                            AND pma.project_id = p.id) rec)
                                        AS allocations

                            FROM project_members pm
                                      INNER JOIN team_member_info_view tmiv
                                                ON pm.team_member_id = tmiv.team_member_id
                            WHERE project_id = p.id
                            ORDER BY NAME ASC) rec) AS members

                  FROM projects p
                  WHERE team_id = $1
                  AND p.id NOT IN
                    (SELECT project_id FROM archived_projects WHERE user_id = $2)
                  ORDER BY p.name`;

    const result = await db.query(q, [teamId, userId]);
    return result;
  }

  @HandleExceptions()
  public static async getProjects(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const userId = req.user?.id as string;
    const teamId = req.params.id as string;
    const timeZone = req.query.timeZone as string;

    const result = await this.getProjectsQuery(teamId, userId);

    for (const project of result.rows) {

      const { lowestDate, highestDate } = await this.setIndicatorDates(project, timeZone);

      project.allocated_from = lowestDate ? moment(lowestDate).format("YYYY-MM-DD") : null;
      project.allocated_to = highestDate ? moment(highestDate).format("YYYY-MM-DD") : null;

      const styles = this.setAllocationIndicator(project);

      project.indicator_offset = styles?.indicatorOffset && project.members.length ? styles.indicatorOffset : 0;
      project.indicator_width = styles?.indicatorWidth && project.members.length ? styles.indicatorWidth : 0;

      project.color_code = getColor(project.name);

      for (const member of project.members) {

        const mergedAllocation = await this.mergeAllocations(member.allocations);

        member.allocations = mergedAllocation;

        for (const allocation of member.allocations) {

          allocation.allocated_from = allocation.allocated_from ? momentTime.tz(allocation.allocated_from, `${timeZone}`).format("YYYY-MM-DD") : null;
          allocation.allocated_to = allocation.allocated_to ? momentTime.tz(allocation.allocated_to, `${timeZone}`).format("YYYY-MM-DD") : null;

          const styles = this.setAllocationIndicator(allocation);

          allocation.indicator_offset = styles?.indicatorOffset ? styles?.indicatorOffset : 0;
          allocation.indicator_width = styles?.indicatorWidth ? styles?.indicatorWidth : 0;

        }

        member.color_code = getColor(member.name);

      }

    }

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getSingleProjectIndicator(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {

    const projectId = req.params.id as string;
    const teamMemberId = req.query.team_member_id as string;
    const timeZone = req.query.timeZone as string;
    const projectIndicatorRefresh = req.query.isProjectRefresh;

    const q = `SELECT id,
                      allocated_from,
                      allocated_to,
                      (SELECT COALESCE(ROW_TO_JSON(rec), '{}'::JSON)
                      FROM (SELECT MIN(min_date) AS start_date, MAX(max_date) AS end_date
                            FROM (
                                  -- Dates from project_member_allocations
                                  SELECT MIN(allocated_from) AS min_date, MAX(allocated_from) AS max_date
                                  FROM project_member_allocations
                                  WHERE project_id = $1
                                  UNION
                                  SELECT MIN(allocated_to) AS min_date, MAX(allocated_to) AS max_date
                                  FROM project_member_allocations
                                  WHERE project_id = $1
                                  UNION
                                  -- Dates from task assignments
                                  SELECT MIN(t.start_date) AS min_date, MAX(t.start_date) AS max_date
                                  FROM tasks t
                                  WHERE t.project_id = $1
                                    AND t.archived IS FALSE
                                    AND t.start_date IS NOT NULL
                                  UNION
                                  SELECT MIN(t.end_date) AS min_date, MAX(t.end_date) AS max_date
                                  FROM tasks t
                                  WHERE t.project_id = $1
                                    AND t.archived IS FALSE
                                    AND t.end_date IS NOT NULL
                                ) AS dates) rec) AS date_union
               FROM project_member_allocations
               WHERE team_member_id = $2
                     AND project_id = $1`;

    const result = await db.query(q, [projectId, teamMemberId]);

    const body = {
      project_allocation: { start_date: null, end_date: null, indicator_offset: null, indicator_width: null },
      member_allocations: [{}]
    };

    if (result.rows.length) {

      const mergedAllocation = await this.mergeAllocations(result.rows);

      result.rows = mergedAllocation;

      for (const allocation of result.rows) {

        allocation.allocated_from = allocation.allocated_from ? momentTime.tz(allocation.allocated_from, `${timeZone}`).format("YYYY-MM-DD") : null;
        allocation.allocated_to = allocation.allocated_to ? momentTime.tz(allocation.allocated_to, `${timeZone}`).format("YYYY-MM-DD") : null;

        const styles = this.setAllocationIndicator(allocation);

        allocation.indicator_offset = styles?.indicatorOffset ? styles?.indicatorOffset : 0;
        allocation.indicator_width = styles?.indicatorWidth ? styles?.indicatorWidth : 0;

      }

      body.member_allocations = result.rows;

    }
    const qP = `SELECT id,
                        allocated_from,
                        allocated_to,
                        (SELECT COALESCE(ROW_TO_JSON(rec), '{}'::JSON)
                        FROM (SELECT MIN(min_date) AS start_date, MAX(max_date) AS end_date
                              FROM (
                                    -- Dates from project_member_allocations
                                    SELECT MIN(allocated_from) AS min_date, MAX(allocated_from) AS max_date
                                    FROM project_member_allocations
                                    WHERE project_id = $1
                                    UNION
                                    SELECT MIN(allocated_to) AS min_date, MAX(allocated_to) AS max_date
                                    FROM project_member_allocations
                                    WHERE project_id = $1
                                    UNION
                                    -- Dates from task assignments
                                    SELECT MIN(t.start_date) AS min_date, MAX(t.start_date) AS max_date
                                    FROM tasks t
                                    WHERE t.project_id = $1
                                      AND t.archived IS FALSE
                                      AND t.start_date IS NOT NULL
                                    UNION
                                    SELECT MIN(t.end_date) AS min_date, MAX(t.end_date) AS max_date
                                    FROM tasks t
                                    WHERE t.project_id = $1
                                      AND t.archived IS FALSE
                                      AND t.end_date IS NOT NULL
                                  ) AS dates) rec) AS date_union
                  FROM project_member_allocations
                  WHERE project_id = $1`;

    const resultP = await db.query(qP, [projectId]);

    if (resultP.rows.length) {
      const project = resultP.rows[0];

      const { lowestDate, highestDate } = await this.setIndicatorDates(project, timeZone);

      if (lowestDate) project.start_date = lowestDate;
      if (highestDate) project.end_date = highestDate;

      project.start_date = project.start_date ? moment(project.start_date).format("YYYY-MM-DD") : moment().format("YYYY-MM-DD");
      project.end_date = project.end_date ? moment(project.end_date).format("YYYY-MM-DD") : moment().format("YYYY-MM-DD");

      const styles = this.setIndicatorWithLogIndicator(project);

      project.indicator_offset = styles.indicatorOffset;
      project.indicator_width = styles.indicatorWidth;

      body.project_allocation = project;

    }

    return res.status(200).send(new ServerResponse(true, body));
  }

  @HandleExceptions()
  public static async getSingleProjectMember(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {

    const projectId = req.params.id as string;
    const teamMemberId = req.query.team_member_id as string;
    const timeZone = req.query.timeZone as string;
    const projectIndicatorRefresh = req.query.isProjectRefresh;

    const q = `SELECT id,
                      allocated_from,
                      allocated_to,
                      (SELECT COALESCE(ROW_TO_JSON(rec), '{}'::JSON)
                      FROM (SELECT MIN(min_date) AS start_date, MAX(max_date) AS end_date
                            FROM (
                                  -- Dates from project_member_allocations
                                  SELECT MIN(allocated_from) AS min_date, MAX(allocated_from) AS max_date
                                  FROM project_member_allocations
                                  WHERE project_id = $1
                                  UNION
                                  SELECT MIN(allocated_to) AS min_date, MAX(allocated_to) AS max_date
                                  FROM project_member_allocations
                                  WHERE project_id = $1
                                  UNION
                                  -- Dates from task assignments
                                  SELECT MIN(t.start_date) AS min_date, MAX(t.start_date) AS max_date
                                  FROM tasks t
                                  WHERE t.project_id = $1
                                    AND t.archived IS FALSE
                                    AND t.start_date IS NOT NULL
                                  UNION
                                  SELECT MIN(t.end_date) AS min_date, MAX(t.end_date) AS max_date
                                  FROM tasks t
                                  WHERE t.project_id = $1
                                    AND t.archived IS FALSE
                                    AND t.end_date IS NOT NULL
                                ) AS dates) rec) AS date_union
               FROM project_member_allocations
               WHERE team_member_id = $2
                     AND project_id = $1`;

    const result = await db.query(q, [projectId, teamMemberId]);

    const body = {
      project_allocation: { start_date: null, end_date: null, indicator_offset: null, indicator_width: null },
      member_allocations: [{}]
    };

    if (result.rows.length) {
      const project = result.rows[0];

      const { lowestDate, highestDate } = await this.setIndicatorDates(project, timeZone);

      if (lowestDate) project.start_date = lowestDate;
      if (highestDate) project.end_date = highestDate;

      project.start_date = project.start_date ? moment(project.start_date).format("YYYY-MM-DD") : moment().format("YYYY-MM-DD");
      project.end_date = project.end_date ? moment(project.end_date).format("YYYY-MM-DD") : moment().format("YYYY-MM-DD");

      const styles = this.setIndicatorWithLogIndicator(project);

      project.indicator_offset = styles.indicatorOffset;
      project.indicator_width = styles.indicatorWidth;

      const mergedAllocation = await this.mergeAllocations(result.rows);

      result.rows = mergedAllocation;

      for (const allocation of result.rows) {

        allocation.allocated_from = allocation.allocated_from ? momentTime.tz(allocation.allocated_from, `${timeZone}`).format("YYYY-MM-DD") : null;
        allocation.allocated_to = allocation.allocated_to ? momentTime.tz(allocation.allocated_to, `${timeZone}`).format("YYYY-MM-DD") : null;

        const styles = this.setAllocationIndicator(allocation);

        allocation.indicator_offset = styles?.indicatorOffset ? styles?.indicatorOffset : 0;
        allocation.indicator_width = styles?.indicatorWidth ? styles?.indicatorWidth : 0;

      }

      body.member_allocations = result.rows;
      body.project_allocation = project;

    }

    return res.status(200).send(new ServerResponse(true, body));

  }

  private static async mergeAllocations(allocations: { id: string | null, allocated_from: string | null, allocated_to: string | null, indicator_offset: number, indicator_width: number }[]) {

    if (!allocations.length) return [];

    allocations.sort((a, b) => moment(a.allocated_from).diff(moment(b.allocated_from)));

    const mergedRanges = [];

    let currentRange = { ...allocations[0], ids: [allocations[0].id] };

    for (let i = 1; i < allocations.length; i++) {
      const nextRange = allocations[i];

      if (moment(currentRange.allocated_to).isSameOrAfter(nextRange.allocated_from)) {
        currentRange.allocated_to = moment.max(moment(currentRange.allocated_to), moment(nextRange.allocated_to)).toISOString();
        currentRange.ids.push(nextRange.id);
      } else {
        mergedRanges.push({ ...currentRange });
        currentRange = { ...nextRange, ids: [nextRange.id] };
      }
    }

    mergedRanges.push({ ...currentRange });

    return mergedRanges;

  }


  private static async setIndicatorDates(item: any, timeZone: string) {
    const datesToCheck = [];

    item.date_union.start_date = item.date_union.start_date ? momentTime.tz(item.date_union.start_date, `${timeZone}`).format("YYYY-MM-DD") : null;
    item.date_union.end_date = item.date_union.end_date ? momentTime.tz(item.date_union.end_date, `${timeZone}`).format("YYYY-MM-DD") : null;

    for (const dateKey in item) {
      if (item[dateKey as keyof IDateUnions] && item[dateKey as keyof IDateUnions].start_date) {
        datesToCheck.push(moment(item[dateKey as keyof IDateUnions].start_date));
      }
      if (item[dateKey as keyof IDateUnions] && item[dateKey as keyof IDateUnions].end_date) {
        datesToCheck.push(moment(item[dateKey as keyof IDateUnions].end_date));
      }
    }

    const validDateToCheck = datesToCheck.filter((date) => date.isValid());

    const lowestDate = validDateToCheck.length ? moment.min(validDateToCheck).format("YYYY-MM-DD") : null;
    const highestDate = validDateToCheck.length ? moment.max(validDateToCheck).format("YYYY-MM-DD") : null;


    return {
      lowestDate,
      highestDate
    };

  }

  @HandleExceptions()
  public static async deleteMemberAllocations(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    // Use parameterized queries for DELETE statement
    const ids = Array.isArray(req.body.ids) 
      ? req.body.ids 
      : typeof req.body.ids === 'string' 
        ? req.body.ids.split(",").filter((id: string) => id.trim())
        : [];
    
    if (ids.length === 0) {
      return res.status(400).send(new ServerResponse(false, null, "No IDs provided"));
    }
    
    const { clause, params } = SqlHelper.buildInClause(ids, 1);
    const q = `DELETE FROM project_member_allocations WHERE id IN (${clause})`;
    await db.query(q, params);
    return res.status(200).send(new ServerResponse(true, []));
  }

  // ********************************************

  private static isCountsOnly(query: ParsedQs) {
    return query.count === "true";
  }

  public static isTasksOnlyReq(query: ParsedQs) {
    return ScheduleControllerV2.isCountsOnly(query) || query.parent_task;
  }

  private static getFilterByMembersWhereClosure(text: string, paramOffset: number): { clause: string; params: string[] } {
    if (!text) return { clause: "", params: [] };
    const memberIds = text.split(" ").filter(id => id.trim());
    const { clause } = SqlHelper.buildInClause(memberIds, paramOffset);
    const fullClause = `id IN (SELECT task_id FROM tasks_assignees WHERE team_member_id IN (${clause}))`;
    return {
      clause: fullClause,
      params: memberIds
    };
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

  private static getQuery(userId: string, projectId: string, options: ParsedQs): { query: string; params: any[] } {
    const searchField = options.search ? "t.name" : "sort_order";
    const { searchQuery, sortField } = ScheduleControllerV2.toPaginationOptions(options, searchField);

    const isSubTasks = !!options.parent_task;

    // Start with projectId as $1
    const queryParams: any[] = [projectId];
    let paramOffset = 2; // Next param will be $2

    // Add parent_task_id if this is subtasks query
    if (isSubTasks && options.parent_task) {
      queryParams.push(options.parent_task as string);
      paramOffset++;
    }

    const sortFields = sortField.replace(/ascend/g, "ASC").replace(/descend/g, "DESC") || "sort_order";
    const membersResult = ScheduleControllerV2.getFilterByMembersWhereClosure(options.members as string, paramOffset);
    if (membersResult.params.length > 0) {
      queryParams.push(...membersResult.params);
      paramOffset += membersResult.params.length;
    }
    const membersFilter = membersResult.clause;
    const statusesQuery = ScheduleControllerV2.getStatusesQuery(options.filterBy as string);

    const archivedFilter = options.archived === "true" ? "archived IS TRUE" : "archived IS FALSE";

    // Date range filtering
    let dateRangeFilter = "";
    if (options.startDate && options.endDate) {
      // Filter tasks that overlap with the selected date range
      // A task overlaps if: task.start_date <= range.endDate AND task.end_date >= range.startDate
      dateRangeFilter = `(
        (start_date IS NOT NULL AND end_date IS NOT NULL) AND
        (start_date <= $${paramOffset} AND end_date >= $${paramOffset + 1})
      )`;
      queryParams.push(options.endDate as string);
      queryParams.push(options.startDate as string);
      paramOffset += 2;
    }

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
      dateRangeFilter
    ].filter(i => !!i).join(" AND ");

    // Build member-specific time spent query
    let timeSpentQuery = "(SELECT ROUND(SUM(time_spent) / 60.0, 2) FROM task_work_log WHERE task_id = t.id) AS total_minutes_spent";
    
    // If specific members are selected, filter time logs by those members
    if (options.members && typeof options.members === 'string') {
      const memberIds = options.members.split(" ").filter(id => id.trim());
      if (memberIds.length > 0) {
        // Create placeholders for member IDs in the time spent query
        const memberPlaceholders = memberIds.map((_, index) => `$${paramOffset + index}`).join(', ');
        timeSpentQuery = `(SELECT ROUND(SUM(twl.time_spent) / 60.0, 2)
                         FROM task_work_log twl 
                         INNER JOIN team_members tm ON twl.user_id = tm.user_id 
                         WHERE twl.task_id = t.id 
                         AND tm.id IN (${memberPlaceholders})) AS total_minutes_spent`;
        
        // Add member IDs to query params
        queryParams.push(...memberIds);
        paramOffset += memberIds.length;
      }
    }

    const query = `
      SELECT id,
             name,
             CONCAT((SELECT key FROM projects WHERE id = t.project_id), '-', task_no) AS task_key,
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
             ${timeSpentQuery},
             start_date,
             end_date ${statusesQuery}
      FROM tasks t
      WHERE ${filters} ${searchQuery} AND project_id = $1
      ORDER BY end_date DESC NULLS LAST
    `;

    return { query, params: queryParams };
  }

  public static async getGroups(groupBy: string, projectId: string): Promise<IScheduleTaskGroup[]> {
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
          ORDER BY sort_order
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

    const { query: q, params } = ScheduleControllerV2.getQuery(req.user?.id as string, req.params.id, req.query);
    
    const result = await db.query(q, params);
    const tasks = [...result.rows];

    // Get groups metadata from database
    const groups = await this.getGroups(groupBy, req.params.id);

    // Transform tasks with necessary preprocessing
    const transformedTasks = tasks.map((task, index) => {
      task.index = index;
      ScheduleControllerV2.updateTaskViewModel(task);
      return task;
    });

    // Initialize grouped response structure
    const groupedResponse: Record<string, any> = {};

    // Initialize groups from database data
    groups.forEach((group) => {
      if (!group.id) return;
      
      const groupKey = group.id;
      
      groupedResponse[groupKey] = {
        id: group.id,
        name: group.name,
        category_id: group.category_id || null,
        color_code: group.color_code + TASK_STATUS_COLOR_ALPHA,
        tasks: [],
        isExpand: true,
        // Additional metadata (safely access optional properties)
        start_date: (group as any).start_date || null,
        end_date: (group as any).end_date || null,
      };
    });

    // Distribute tasks into groups
    const unmappedTasks: any[] = [];

    transformedTasks.forEach((task) => {
      let taskAssigned = false;

      if (groupBy === GroupBy.STATUS) {
        if (task.status && groupedResponse[task.status]) {
          groupedResponse[task.status].tasks.push(task);
          taskAssigned = true;
        }
      } else if (groupBy === GroupBy.PRIORITY) {
        if (task.priority && groupedResponse[task.priority]) {
          groupedResponse[task.priority].tasks.push(task);
          taskAssigned = true;
        }
      } else if (groupBy === GroupBy.PHASE) {
        if (task.phase_id && groupedResponse[task.phase_id]) {
          groupedResponse[task.phase_id].tasks.push(task);
          taskAssigned = true;
        }
      }

      if (!taskAssigned) {
        unmappedTasks.push(task);
      }
    });

    // Add unmapped group if there are tasks without proper assignment
    if (unmappedTasks.length > 0) {
      groupedResponse[UNMAPPED] = {
        id: UNMAPPED,
        name: UNMAPPED,
        category_id: null,
        color_code: "#f0f0f0",
        tasks: unmappedTasks,
        isExpand: true,
        start_date: null,
        end_date: null,
      };
    }

    // Apply color adjustments for phase grouping
    Object.values(groupedResponse).forEach((group: any) => {
      if (groupBy === GroupBy.PHASE && group.id !== UNMAPPED) {
        group.color_code = getColor(group.name) + TASK_PRIORITY_COLOR_ALPHA;
      }
    });

    // Convert to array format, maintaining database order
    // Include ALL groups, even those without tasks
    const responseGroups = groups
      .filter((group) => group.id) // Filter out groups without id
      .map((group) => groupedResponse[group.id!]); // Use non-null assertion since we filtered

    // Add unmapped group to the end if it exists
    if (groupedResponse[UNMAPPED]) {
      responseGroups.push(groupedResponse[UNMAPPED]);
    }

    // Return structured response similar to getTasksV3
    return res.status(200).send(new ServerResponse(true, {
      groups: responseGroups,
      allTasks: transformedTasks,
      grouping: groupBy,
      totalTasks: transformedTasks.length,
    }));
  }

  public static updateMapByGroup(tasks: any[], groupBy: string, map: { [p: string]: IScheduleTaskGroup }) {
    let index = 0;
    const unmapped = [];
    for (const task of tasks) {
      task.index = index++;
      ScheduleControllerV2.updateTaskViewModel(task);
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
    const { query: q, params } = ScheduleControllerV2.getQuery(req.user?.id as string, req.params.id, req.query);
    const result = await db.query(q, params);

    let data: any[] = [];

    // if true, we only return the record count
    if (this.isCountsOnly(req.query)) {
      [data] = result.rows;
    } else { // else we return a flat list of tasks
      data = [...result.rows];
      for (const task of data) {
        ScheduleControllerV2.updateTaskViewModel(task);
      }
    }

    return res.status(200).send(new ServerResponse(true, data));
  }


}

import moment from "moment-timezone";
import db from "../config/db";
import HandleExceptions from "../decorators/handle-exceptions";
import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import momentTime from "moment-timezone";

interface ITask {
  id: string,
  name: string,
  project_id: string,
  parent_task_id: string | null,
  is_sub_task: boolean,
  parent_task_name: string | null,
  status_id: string,
  start_date: string | null,
  end_date: string | null,
  created_at: string | null,
  team_id: string,
  project_name: string,
  project_color: string | null,
  status: string,
  status_color: string | null,
  is_task: boolean,
  done: boolean,
  updated_at: string | null,
  project_statuses: [{
      id: string,
      name: string | null,
      color_code: string | null,
    }]
}

export default class HomePageController extends WorklenzControllerBase {

  private static readonly GROUP_BY_ASSIGNED_TO_ME = "0";
  private static readonly GROUP_BY_ASSIGN_BY_ME = "1";
  private static readonly ALL_TAB = "All";
  private static readonly TODAY_TAB = "Today";
  private static readonly UPCOMING_TAB = "Upcoming";
  private static readonly OVERDUE_TAB = "Overdue";
  private static readonly NO_DUE_DATE_TAB = "NoDueDate";

  private static isValidGroup(groupBy: string) {
    return groupBy === this.GROUP_BY_ASSIGNED_TO_ME
      || groupBy === this.GROUP_BY_ASSIGN_BY_ME;
  }

  private static isValidView(currentView: string) {
    return currentView === this.ALL_TAB
      || currentView === this.TODAY_TAB
      || currentView === this.UPCOMING_TAB
      || currentView === this.OVERDUE_TAB
      || currentView === this.NO_DUE_DATE_TAB;
  }

  @HandleExceptions()
  public static async createPersonalTask(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `INSERT INTO personal_todo_list (name, color_code, user_id, index)
               VALUES ($1, $2, $3, ((SELECT index FROM personal_todo_list ORDER BY index DESC LIMIT 1) + 1))
               RETURNING id, name`;
    const result = await db.query(q, [req.body.name, req.body.color_code, req.user?.id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  private static getTasksByGroupClosure(groupBy: string) {
    switch (groupBy) {
      case this.GROUP_BY_ASSIGN_BY_ME:
        return `AND t.id IN (
                    SELECT task_id
                    FROM tasks_assignees
                    WHERE assigned_by = $2 AND team_id = $1)`;

      case this.GROUP_BY_ASSIGNED_TO_ME:
      default:
        return `AND t.id IN (
                    SELECT task_id
                    FROM tasks_assignees
                    WHERE team_member_id = (SELECT id FROM team_members WHERE user_id = $2 AND team_id = $1))`;
    }
  }

  private static getTasksByTabClosure(text: string) {
    switch (text) {
      case this.TODAY_TAB:
        return `AND t.end_date::DATE = CURRENT_DATE::DATE`;
      case this.UPCOMING_TAB:
        return `AND t.end_date::DATE > CURRENT_DATE::DATE`;
      case this.OVERDUE_TAB:
        return `AND t.end_date::DATE < CURRENT_DATE::DATE`;
      case this.NO_DUE_DATE_TAB:
        return `AND t.end_date IS NULL`;
      case this.ALL_TAB:
      default:
        return "";
    }
  }

  private static async getTasksResult(groupByClosure: string, currentTabClosure: string, teamId: string, userId: string) {
    const q = `
      SELECT t.id,
             t.name,
             t.project_id,
             t.parent_task_id,
             t.parent_task_id IS NOT NULL AS is_sub_task,
             (SELECT name FROM tasks WHERE id = t.parent_task_id) AS parent_task_name,
             t.status_id,
             t.start_date,
             t.end_date,
             t.created_at,
             p.team_id,
             p.name AS project_name,
             p.color_code AS project_color,
             (SELECT name FROM task_statuses WHERE id = t.status_id) AS status,
             (SELECT color_code
              FROM sys_task_status_categories
              WHERE id = (SELECT category_id FROM task_statuses WHERE id = t.status_id)) AS status_color,
             TRUE AS is_task,
             FALSE AS done,
             t.updated_at,
             (SELECT ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(r)))
              FROM (SELECT task_statuses.id AS id,
                           task_statuses.name AS name,
                           (SELECT color_code
                            FROM sys_task_status_categories
                            WHERE id = task_statuses.category_id)
                    FROM task_statuses
                    WHERE task_statuses.project_id = t.project_id) r) AS project_statuses
      FROM tasks t
             JOIN projects p ON t.project_id = p.id
      WHERE t.archived IS FALSE
        AND t.status_id NOT IN (SELECT id
                                FROM task_statuses
                                WHERE category_id NOT IN (SELECT id
                                                          FROM sys_task_status_categories
                                                          WHERE is_done IS FALSE))
        AND NOT EXISTS(SELECT project_id
                       FROM archived_projects
                       WHERE project_id = p.id
                         AND user_id = $2)
        ${groupByClosure}
      ORDER BY t.end_date ASC`;

    const result = await db.query(q, [teamId, userId]);
    return result.rows;
  }

  private static async getCountsResult(groupByClosure: string, teamId: string, userId: string) {
    const q = `SELECT COUNT(*) AS total,
                      COUNT(CASE WHEN t.end_date::DATE = CURRENT_DATE::DATE THEN 1 END) AS today,
                      COUNT(CASE WHEN t.end_date::DATE > CURRENT_DATE::DATE THEN 1 END) AS upcoming,
                      COUNT(CASE WHEN t.end_date::DATE < CURRENT_DATE::DATE THEN 1 END) AS overdue,
                      COUNT(CASE WHEN t.end_date::DATE IS NULL THEN 1 END) AS no_due_date
               FROM tasks t
                      JOIN projects p ON t.project_id = p.id
               WHERE t.archived IS FALSE
                 AND t.status_id NOT IN (SELECT id
                                         FROM task_statuses
                                         WHERE category_id NOT IN (SELECT id
                                                                   FROM sys_task_status_categories
                                                                   WHERE is_done IS FALSE))
                 AND NOT EXISTS(SELECT project_id
                                FROM archived_projects
                                WHERE project_id = p.id
                                  AND user_id = $3)
                 ${groupByClosure}`;

    const result = await db.query(q, [teamId, userId, userId]);
    const [row] = result.rows;
    return row;
  }

  @HandleExceptions()
  public static async getTasks(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;
    const timeZone = req.query.time_zone as string;
    const today = new Date();

    const currentGroup = this.isValidGroup(req.query.group_by as string) ? req.query.group_by : this.GROUP_BY_ASSIGNED_TO_ME;
    const currentTab = this.isValidView(req.query.current_tab as string) ? req.query.current_tab : this.ALL_TAB;

    const groupByClosure = this.getTasksByGroupClosure(currentGroup as string);
    let currentTabClosure = this.getTasksByTabClosure(currentTab as string);

    const isCalendarView = req.query.is_calendar_view;

    let result = await this.getTasksResult(groupByClosure, currentTabClosure, teamId as string, userId as string);

    const counts = await this.getCountsByGroup(result, timeZone, today);

    if (isCalendarView == "true") {
      currentTabClosure = `AND t.end_date::DATE = '${req.query.selected_date}'`;
      result = await this.groupBySingleDate(result, timeZone, req.query.selected_date as string);
    } else {
      result = await this.groupByDate(currentTab as string,result, timeZone, today);
    }

    // const counts = await this.getCountsResult(groupByClosure, teamId as string, userId as string);

    const data = {
      tasks: result,
      total: counts.total,
      today: counts.today,
      upcoming: counts.upcoming,
      overdue: counts.overdue,
      no_due_date: counts.no_due_date,
    };

    return res.status(200).send(new ServerResponse(true, data));
  }

  private static async groupByDate(currentTab: string,tasks: any[], timeZone: string, today: Date) {
    const formatToday = moment(today).format("YYYY-MM-DD");

    const tasksReturn = [];

    if (currentTab === this.ALL_TAB) {
      for (const task of tasks) {
        tasksReturn.push(task);
      }
    }

    if (currentTab === this.NO_DUE_DATE_TAB) {
      for (const task of tasks) {
        if (!task.end_date) {
          tasksReturn.push(task);
        }
      }
    }

    if (currentTab === this.TODAY_TAB) {
      for (const task of tasks) {
        if (task.end_date) {
          const taskEndDate = momentTime.tz(task.end_date, `${timeZone}`).format("YYYY-MM-DD");
          if (moment(taskEndDate).isSame(formatToday)) {
            tasksReturn.push(task);
          }
        }
      }
    }

    if (currentTab === this.UPCOMING_TAB) {
      for (const task of tasks) {
        if (task.end_date) {
          const taskEndDate = momentTime.tz(task.end_date, `${timeZone}`).format("YYYY-MM-DD");
          if (moment(taskEndDate).isAfter(formatToday)) {
            tasksReturn.push(task);
          }
        }
      }
    }

    if (currentTab === this.OVERDUE_TAB) {
      for (const task of tasks) {
        if (task.end_date) {
          const taskEndDate = momentTime.tz(task.end_date, `${timeZone}`).format("YYYY-MM-DD");
          if (moment(taskEndDate).isBefore(formatToday)) {
            tasksReturn.push(task);
          }
         }
      }
    }

    return tasksReturn;
  }

  private static async groupBySingleDate(tasks: any, timeZone: string, selectedDate: string) {
    const formatSelectedDate = moment(selectedDate).format("YYYY-MM-DD");

    const tasksReturn = [];

    for (const task of tasks) {
      if (task.end_date) {
        const taskEndDate = momentTime.tz(task.end_date, `${timeZone}`).format("YYYY-MM-DD");
        if (moment(taskEndDate).isSame(formatSelectedDate)) {
          tasksReturn.push(task);
        }
       }
    }

    return tasksReturn;

  }

  private static async getCountsByGroup(tasks: any[], timeZone: string, today_: Date) {
    let no_due_date = 0;
    let today = 0;
    let upcoming = 0;
    let overdue = 0;

    const total = tasks.length;

    const formatToday = moment(today_).format("YYYY-MM-DD");

    for (const task of tasks) {
      if (!task.end_date) {
        no_due_date = no_due_date + 1;
      }
      if (task.end_date) {
        const taskEndDate = momentTime.tz(task.end_date, `${timeZone}`).format("YYYY-MM-DD");
        if (moment(taskEndDate).isSame(formatToday)) {
          today = today + 1;
        }
        if (moment(taskEndDate).isAfter(formatToday)) {
          upcoming = upcoming + 1;
        }
        if (moment(taskEndDate).isBefore(formatToday)) {
          overdue = overdue + 1;
        }
      }
    }

    return {
      total,
      today,
      upcoming,
      overdue,
      no_due_date
    };

  }

  @HandleExceptions()
  public static async getPersonalTasks(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const user_id = req.user?.id;
    const q = `SELECT ptl.id,
                      ptl.name,
                      ptl.created_at,
                      FALSE AS is_task,
                      ptl.done,
                      ptl.updated_at
               FROM personal_todo_list ptl
               WHERE ptl.user_id = $1
                 AND done IS FALSE
               ORDER BY ptl.updated_at DESC`;
    const results = await db.query(q, [user_id]);
    return res.status(200).send(new ServerResponse(true, results.rows));
  }

  @HandleExceptions()
  public static async getProjects(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {

    const team_id = req.user?.team_id;
    const user_id = req.user?.id;

    const current_view = req.query.view;

    const isFavorites = current_view === "1" ? ` AND EXISTS(SELECT user_id FROM favorite_projects WHERE user_id = $2 AND project_id = projects.id)` : "";
    const isArchived = req.query.filter === "2"
      ? ` AND EXISTS(SELECT user_id FROM archived_projects WHERE user_id = $2 AND project_id = projects.id)`
      : ` AND NOT EXISTS(SELECT user_id FROM archived_projects WHERE user_id = $2 AND project_id = projects.id)`;

    const q = `SELECT id,
                      name,
                      EXISTS(SELECT user_id
                             FROM favorite_projects
                             WHERE user_id = $2
                               AND project_id = projects.id) AS favorite,
                      EXISTS(SELECT user_id
                             FROM archived_projects
                             WHERE user_id = $2
                               AND project_id = projects.id) AS archived,
                      color_code,
                      (SELECT COUNT(*)
                       FROM tasks
                       WHERE archived IS FALSE
                         AND project_id = projects.id) AS all_tasks_count,
                      (SELECT COUNT(*)
                       FROM tasks
                       WHERE archived IS FALSE
                         AND project_id = projects.id
                         AND status_id IN (SELECT id
                                           FROM task_statuses
                                           WHERE project_id = projects.id
                                             AND category_id IN
                                                 (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE))) AS completed_tasks_count,
                      (SELECT COUNT(*)
                       FROM project_members
                       WHERE project_id = projects.id) AS members_count,
                      (SELECT get_project_members(projects.id)) AS names,
                      (SELECT CASE
                                WHEN ((SELECT MAX(updated_at)
                                       FROM tasks
                                       WHERE archived IS FALSE
                                         AND project_id = projects.id) >
                                      updated_at)
                                  THEN (SELECT MAX(updated_at)
                                        FROM tasks
                                        WHERE archived IS FALSE
                                          AND project_id = projects.id)
                                ELSE updated_at END) AS updated_at
               FROM projects
               WHERE team_id = $1 ${isArchived} ${isFavorites} AND is_member_of_project(projects.id , $2
                   , $1)
               ORDER BY updated_at DESC`;

    const result = await db.query(q, [team_id, user_id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getProjectsByTeam(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const team_id = req.user?.team_id;
    const user_id = req.user?.id;
    const q = `
      SELECT id, name, color_code
      FROM projects
      WHERE team_id = $1
        AND is_member_of_project(projects.id, $2, $1)
    `;
    const result = await db.query(q, [team_id, user_id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async updatePersonalTask(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      UPDATE personal_todo_list
      SET done = TRUE
      WHERE id = $1
      RETURNING id
    `;
    await db.query(q, [req.body.id]);
    return res.status(200).send(new ServerResponse(true, req.body.id));
  }
}

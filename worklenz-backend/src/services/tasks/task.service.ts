import moment from "moment-timezone";
import momentTime from "moment-timezone";
import database from "../../config/db";
import { 
    TODAY_TAB, 
    UPCOMING_TAB, 
    OVERDUE_TAB, 
    NO_DUE_DATE_TAB, 
    ALL_TAB, 
    GROUP_BY_ASSIGN_BY_ME, 
    GROUP_BY_ASSIGNED_TO_ME 
} from "../../shared/constants";

export class TaskService {

    public static getTasksByGroupClosure(groupBy: string) {
        switch (groupBy) {
            case GROUP_BY_ASSIGN_BY_ME:
                return `AND t.id IN (
                          SELECT task_id
                          FROM tasks_assignees
                          WHERE assigned_by = $2 AND team_id = $1)`;

            case GROUP_BY_ASSIGNED_TO_ME:
            default:
                return `AND t.id IN (
                          SELECT task_id
                          FROM tasks_assignees
                          WHERE team_member_id = (SELECT id FROM team_members WHERE user_id = $2 AND team_id = $1))`;
        }
    }

    public static getTasksByTabClosure(text: string) {
        switch (text) {
            case TODAY_TAB:
                return `AND t.end_date::DATE = CURRENT_DATE::DATE`;
            case UPCOMING_TAB:
                return `AND t.end_date::DATE > CURRENT_DATE::DATE`;
            case OVERDUE_TAB:
                return `AND t.end_date::DATE < CURRENT_DATE::DATE`;
            case NO_DUE_DATE_TAB:
                return `AND t.end_date IS NULL`;
            case ALL_TAB:
            default:
                return "";
        }
    }

    public static async getTasksGroupByDate(currentTab: string, tasks: any[], timeZone: string, today: Date) {
        const formatToday = moment(today).format("YYYY-MM-DD");

        const tasksReturn = [];

        if (currentTab === ALL_TAB) {
            for (const task of tasks) {
                tasksReturn.push(task);
            }
        }

        if (currentTab === NO_DUE_DATE_TAB) {
            for (const task of tasks) {
                if (!task.end_date) {
                    tasksReturn.push(task);
                }
            }
        }

        if (currentTab === TODAY_TAB) {
            for (const task of tasks) {
                if (task.end_date) {
                    const taskEndDate = momentTime.tz(task.end_date, `${timeZone}`).format("YYYY-MM-DD");
                    if (moment(taskEndDate).isSame(formatToday)) {
                        tasksReturn.push(task);
                    }
                }
            }
        }

        if (currentTab === UPCOMING_TAB) {
            for (const task of tasks) {
                if (task.end_date) {
                    const taskEndDate = momentTime.tz(task.end_date, `${timeZone}`).format("YYYY-MM-DD");
                    if (moment(taskEndDate).isAfter(formatToday)) {
                        tasksReturn.push(task);
                    }
                }
            }
        }

        if (currentTab === OVERDUE_TAB) {
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

    public static async createPersonalTask(data: object) {
        const query = `INSERT INTO personal_todo_list (name, color_code, user_id, index)
                   VALUES ($1, $2, $3, ((SELECT index FROM personal_todo_list ORDER BY index DESC LIMIT 1) + 1))
                   RETURNING id, name`;
        return await database.query(query, [data.name, data.color_code, data.user_id]);
    }

    public static async getPersonalTasks(user_id: string) {
        const query = `SELECT ptl.id,
                          ptl.name,
                          ptl.created_at,
                          FALSE AS is_task,
                          ptl.done,
                          ptl.updated_at
                   FROM personal_todo_list ptl
                   WHERE ptl.user_id = $1
                     AND done IS FALSE
                   ORDER BY ptl.updated_at DESC`;
        return await database.query(query, [user_id]);
    }

    public static async getTaskCountsByGroup(tasks: any[], timeZone: string, today_: Date) {
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

    public static async getTaskGroupBySingleDate(tasks: any, timeZone: string, selectedDate: string) {
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

    public static async getTaskCountsResult(groupByClosure: string, teamId: string, userId: string) {
        const query = `SELECT COUNT(*) AS total,
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
                     ${groupByClosure}`;

        return await database.query(query, [teamId, userId]);
    }

    public static async getTasksResult(groupByClosure: string, currentTabClosure: string, teamId: string, userId: string) {
        const query = `
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
                 (SELECT id FROM task_statuses WHERE id = t.status_id) AS status,
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
            ${groupByClosure}
          ORDER BY t.end_date ASC`;

        return await database.query(query, [teamId, userId]);
    }

    public static async updatePersonalTask(id: string) {
        const query = `
          UPDATE personal_todo_list
          SET done = TRUE
          WHERE id = $1
          RETURNING id
        `;
        return await database.query(query, [id]);
    }

    public static isValidGroup(groupBy: string) {
        return groupBy === GROUP_BY_ASSIGNED_TO_ME
            || groupBy === GROUP_BY_ASSIGN_BY_ME;
    }

    public static isValidView(currentView: string) {
        return currentView === ALL_TAB
            || currentView === TODAY_TAB
            || currentView === UPCOMING_TAB
            || currentView === OVERDUE_TAB
            || currentView === NO_DUE_DATE_TAB;
    }

}
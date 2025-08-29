import moment from "moment";
import db from "../config/db";
import HandleExceptions from "../decorators/handle-exceptions";
import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";
import {ServerResponse} from "../models/server-response";
import {LOG_DESCRIPTIONS} from "../shared/constants";
import {getColor} from "../shared/utils";
import {generateProjectKey} from "../utils/generate-project-key";
import WorklenzControllerBase from "./worklenz-controller-base";
import { NotificationsService } from "../services/notifications/notifications.service";
import { IPassportSession } from "../interfaces/passport-session";
import { SocketEvents } from "../socket.io/events";
import { IO } from "../shared/io";
import { getCurrentProjectsCount, getFreePlanSettings } from "../shared/paddle-utils";

export default class ProjectsController extends WorklenzControllerBase {

  private static async getAllKeysByTeamId(teamId?: string) {
    if (!teamId) return [];
    try {
      const result = await db.query("SELECT key FROM projects WHERE team_id = $1;", [teamId]);
      return result.rows.map((project: any) => project.key).filter((key: any) => !!key);
    } catch (error) {
      return [];
    }
  }

  private static async notifyProjecManagertUpdates(projectId: string, user: IPassportSession, projectManagerTeamMemberId: string | null) {

    if (projectManagerTeamMemberId) {
      const q = `SELECT (SELECT user_id FROM team_member_info_view WHERE team_member_id = $2) AS user_id,
                        (SELECT socket_id FROM users WHERE id = (SELECT user_id FROM team_member_info_view WHERE team_member_id = $2)) AS socket_id,
                        (SELECT name FROM projects WHERE id = $1) AS project_name
                  FROM project_members pm WHERE project_id = $1
                                          AND project_access_level_id = (SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER')`;

      const result = await db.query(q, [projectId, projectManagerTeamMemberId]);
      const [data] = result.rows;

      if (projectManagerTeamMemberId !== user.team_member_id) {
        void NotificationsService.createNotification({
          userId: data.user_id,
          teamId: user?.team_id as string,
          socketId: data.socket_id,
          message: `You're assigned as the <b> Project Manager </b> of the <b> ${data.project_name} </b>.`,
          taskId: null,
          projectId: projectId as string
        });
      }
    }

    IO.getSocketById(user.socket_id as string)
    ?.to(projectId)
    .emit(SocketEvents.PROJECT_DATA_CHANGE.toString(), {user_id: user.id});

  }

  @HandleExceptions({
    raisedExceptions: {
      "PROJECT_EXISTS_ERROR": `A project with the name "{0}" already exists. Please choose a different name.`
    }
  })
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    if (req.user?.subscription_status === "free" && req.user?.owner_id) {
      const limits = await getFreePlanSettings();
      const projectsCount = await getCurrentProjectsCount(req.user.owner_id);
      const projectsLimit = parseInt(limits.projects_limit);

      if (parseInt(projectsCount) >= projectsLimit) {
        return res.status(200).send(new ServerResponse(false, [], `Sorry, the free plan cannot have more than ${projectsLimit} projects.`));
      }
    }

    const q = `SELECT create_project($1) AS project`;

    req.body.team_id = req.user?.team_id || null;
    req.body.user_id = req.user?.id || null;

    req.body.folder_id = req.body.folder_id || null;
    req.body.category_id = req.body.category_id?.trim() || null;
    req.body.client_name = req.body.client_name?.trim() || null;
    req.body.project_created_log = LOG_DESCRIPTIONS.PROJECT_CREATED;
    req.body.project_member_added_log = LOG_DESCRIPTIONS.PROJECT_MEMBER_ADDED;
    req.body.project_manager_id = req.body.project_manager ? req.body.project_manager.id : null;

    const keys = await this.getAllKeysByTeamId(req.user?.team_id as string);
    req.body.key = generateProjectKey(req.body.name, keys) || null;

    const result = await db.query(q, [JSON.stringify(req.body)]);
    const [data] = result.rows;

    return res.status(200).send(new ServerResponse(true, data.project || {}));
  }

  @HandleExceptions()
  public static async updatePinnedView(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const projectId = req.body.project_id;
    const teamMemberId = req.user?.team_member_id;
    const defaultView = req.body.default_view;

    const  q = `UPDATE project_members SET default_view = $1 WHERE project_id = $2 AND team_member_id = $3`;
    const result =  await db.query(q, [defaultView, projectId, teamMemberId]);
    const [data] = result.rows;

    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async getMyProjectsToTasks(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT id, name, color_code
               FROM projects
               WHERE team_id = $1
                 AND is_member_of_project(projects.id, $2, $1)`;
    const result = await db.query(q, [req.user?.team_id, req.user?.id || null]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getMyProjects(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {searchQuery, size, offset} = this.toPaginationOptions(req.query, "name");

    const isFavorites = req.query.filter === "1" ? ` AND EXISTS(SELECT user_id FROM favorite_projects WHERE user_id = '${req.user?.id}' AND project_id = projects.id)` : "";

    const isArchived = req.query.filter === "2"
      ? ` AND EXISTS(SELECT user_id FROM archived_projects WHERE user_id = '${req.user?.id}' AND project_id = projects.id)`
      : ` AND NOT EXISTS(SELECT user_id FROM archived_projects WHERE user_id = '${req.user?.id}' AND project_id = projects.id)`;
    const q = `
      SELECT ROW_TO_JSON(rec) AS projects
      FROM (SELECT COUNT(*) AS total,
                   (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
                    FROM (SELECT id,
                                 name,
                                 EXISTS(SELECT user_id
                                        FROM favorite_projects
                                        WHERE user_id = '${req.user?.id}'
                                          AND project_id = projects.id) AS favorite,
                                 EXISTS(SELECT user_id
                                        FROM archived_projects
                                        WHERE user_id = '${req.user?.id}'
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
                          WHERE team_id = $1 ${isArchived} ${isFavorites} ${searchQuery}
                            AND is_member_of_project(projects.id
                              , '${req.user?.id}'
                              , $1)
                          ORDER BY updated_at DESC
                          LIMIT $2 OFFSET $3) t) AS data
            FROM projects
            WHERE team_id = $1 ${isArchived} ${isFavorites} ${searchQuery}
              AND is_member_of_project(projects.id
                , '${req.user?.id}'
                , $1)) rec;
    `;
    const result = await db.query(q, [req.user?.team_id || null, size, offset]);
    const [data] = result.rows;
    const projects = Array.isArray(data?.projects.data) ? data?.projects.data : [];
    for (const project of projects) {
      project.progress = project.all_tasks_count > 0
        ? ((project.completed_tasks_count / project.all_tasks_count) * 100).toFixed(0) : 0;

    }
    return res.status(200).send(new ServerResponse(true, data?.projects || this.paginatedDatasetDefaultStruct));
  }

  private static flatString(text: string) {
    return (text || "").split(" ").map(s => `'${s}'`).join(",");
  }

  private static getFilterByCategoryWhereClosure(text: string) {
    return text ? `AND category_id IN (${this.flatString(text)})` : "";
  }

  private static getFilterByStatusWhereClosure(text: string) {
    return text ? `AND status_id IN (${this.flatString(text)})` : "";
  }

  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {searchQuery, sortField, sortOrder, size, offset} = this.toPaginationOptions(req.query, "name");

    const filterByMember = !req.user?.owner && !req.user?.is_admin ?
      ` AND is_member_of_project(projects.id, '${req.user?.id}', $1) ` : "";

    const isFavorites = req.query.filter === "1" ? ` AND EXISTS(SELECT user_id FROM favorite_projects WHERE user_id = '${req.user?.id}' AND project_id = projects.id)` : "";
    const isArchived = req.query.filter === "2"
      ? ` AND EXISTS(SELECT user_id FROM archived_projects WHERE user_id = '${req.user?.id}' AND project_id = projects.id)`
      : ` AND NOT EXISTS(SELECT user_id FROM archived_projects WHERE user_id = '${req.user?.id}' AND project_id = projects.id)`;
    const categories = this.getFilterByCategoryWhereClosure(req.query.categories as string);
    const statuses = this.getFilterByStatusWhereClosure(req.query.statuses as string);

    const q = `
      SELECT ROW_TO_JSON(rec) AS projects
      FROM (SELECT COUNT(*) AS total,
                   (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
                    FROM (SELECT id,
                                 name,
                                 (SELECT name FROM sys_project_statuses WHERE id = status_id) AS status,
                                 (SELECT color_code FROM sys_project_statuses WHERE id = status_id) AS status_color,
                                 (SELECT icon FROM sys_project_statuses WHERE id = status_id) AS status_icon,
                                 EXISTS(SELECT user_id
                                        FROM favorite_projects
                                        WHERE user_id = '${req.user?.id}'
                                          AND project_id = projects.id) AS favorite,
                                 EXISTS(SELECT user_id
                                        FROM archived_projects
                                        WHERE user_id = '${req.user?.id}'
                                          AND project_id = projects.id) AS archived,
                                 color_code,
                                 start_date,
                                 end_date,
                                 category_id,
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
                                 (SELECT name FROM clients WHERE id = projects.client_id) AS client_name,
                                 (SELECT name FROM users WHERE id = projects.owner_id) AS project_owner,
                                 (SELECT name FROM project_categories WHERE id = projects.category_id) AS category_name,
                                 (SELECT color_code
                                  FROM project_categories
                                  WHERE id = projects.category_id) AS category_color,

                                  ((SELECT team_member_id as team_member_id
                                    FROM project_members
                                    WHERE project_id = projects.id
                                      AND project_access_level_id = (SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER'))) AS project_manager_team_member_id,

                                  (SELECT default_view
                                    FROM project_members prm
                                    WHERE prm.project_id = projects.id
                                      AND team_member_id = '${req.user?.team_member_id}') AS team_member_default_view,

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
                          WHERE team_id = $1 ${categories} ${statuses} ${isArchived} ${isFavorites} ${filterByMember} ${searchQuery}
                          ORDER BY ${sortField} ${sortOrder}
                          LIMIT $2 OFFSET $3) t) AS data
            FROM projects
            WHERE team_id = $1 ${categories} ${statuses} ${isArchived} ${isFavorites} ${filterByMember} ${searchQuery}) rec;
    `;
    const result = await db.query(q, [req.user?.team_id || null, size, offset]);
    const [data] = result.rows;

    for (const project of data?.projects.data || []) {
      project.progress = project.all_tasks_count > 0
        ? ((project.completed_tasks_count / project.all_tasks_count) * 100).toFixed(0) : 0;

      project.updated_at_string = moment(project.updated_at).fromNow();

      project.names = this.createTagList(project?.names);
      project.names.map((a: any) => a.color_code = getColor(a.name));

     if (project.project_manager_team_member_id) {
        project.project_manager = {
          id : project.project_manager_team_member_id
        };
     }

    }

    return res.status(200).send(new ServerResponse(true, data?.projects || this.paginatedDatasetDefaultStruct));
  }

  @HandleExceptions()
  public static async getMembersByProjectId(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {sortField, sortOrder, size, offset} = this.toPaginationOptions(req.query, "name");
    const search = (req.query.search || "").toString().trim();

    let searchFilter = "";
    const params = [req.params.id, req.user?.team_id ?? null, size, offset];
    if (search) {
      searchFilter = `
        AND (
          (SELECT name FROM team_member_info_view WHERE team_member_info_view.team_member_id = tm.id) ILIKE '%' || $5 || '%'
          OR (SELECT email FROM team_member_info_view WHERE team_member_info_view.team_member_id = tm.id) ILIKE '%' || $5 || '%'
        )
      `;
      params.push(search);
    }

    const q = `
      WITH filtered_members AS (
        SELECT project_members.id,
               team_member_id,
               (SELECT name FROM team_member_info_view WHERE team_member_info_view.team_member_id = tm.id) AS name,
               (SELECT email FROM team_member_info_view WHERE team_member_info_view.team_member_id = tm.id) AS email,
               u.avatar_url,
               (SELECT COUNT(*) FROM tasks WHERE archived IS FALSE AND project_id = project_members.project_id AND id IN (SELECT task_id FROM tasks_assignees WHERE tasks_assignees.project_member_id = project_members.id)) AS all_tasks_count,
               (SELECT COUNT(*) FROM tasks WHERE archived IS FALSE AND project_id = project_members.project_id AND id IN (SELECT task_id FROM tasks_assignees WHERE tasks_assignees.project_member_id = project_members.id) AND status_id IN (SELECT id FROM task_statuses WHERE category_id = (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE))) AS completed_tasks_count,
               EXISTS(SELECT email FROM email_invitations WHERE team_member_id = project_members.team_member_id AND email_invitations.team_id = $2) AS pending_invitation,
               (SELECT project_access_levels.name FROM project_access_levels WHERE project_access_levels.id = project_members.project_access_level_id) AS access,
               (SELECT name FROM job_titles WHERE id = tm.job_title_id) AS job_title
        FROM project_members
        INNER JOIN team_members tm ON project_members.team_member_id = tm.id
        LEFT JOIN users u ON tm.user_id = u.id
        WHERE project_id = $1
        ${search ? searchFilter : ""}
      )
      SELECT
        (SELECT COUNT(*) FROM filtered_members) AS total,
        (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
           FROM (
             SELECT * FROM filtered_members
             ORDER BY ${sortField} ${sortOrder}
             LIMIT $3 OFFSET $4
           ) t
        ) AS data
    `;

    const result = await db.query(q, params);
    const [data] = result.rows;

    for (const member of data?.data || []) {
      member.progress = member.all_tasks_count > 0
        ? ((member.completed_tasks_count / member.all_tasks_count) * 100).toFixed(0) : 0;
    }

    return res.status(200).send(new ServerResponse(true, data || this.paginatedDatasetDefaultStruct));
  }

  @HandleExceptions()
  public static async getById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT projects.id,
             projects.name,
             projects.color_code,
             projects.notes,
             projects.key,
             projects.start_date,
             projects.end_date,
             projects.status_id,
             projects.health_id,
             projects.created_at,
             projects.updated_at,
             projects.folder_id,
             projects.phase_label,
             projects.category_id,
             projects.currency,
             projects.budget,
             (projects.estimated_man_days) AS man_days,
             (projects.estimated_working_days) AS working_days,
             (projects.hours_per_day) AS hours_per_day,
             (SELECT name FROM project_categories WHERE id = projects.category_id) AS category_name,
             (SELECT color_code
              FROM project_categories
              WHERE id = projects.category_id) AS category_color,
             (EXISTS(SELECT 1 FROM project_subscribers WHERE project_id = $1 AND user_id = $3)) AS subscribed,
             (SELECT name FROM users WHERE id = projects.owner_id) AS project_owner,
             sps.name AS status,
             sps.color_code AS status_color,
             sps.icon AS status_icon,
             (SELECT name FROM clients WHERE id = projects.client_id) AS client_name,
             projects.use_manual_progress,
             projects.use_weighted_progress,
             projects.use_time_progress,

             (SELECT COALESCE(ROW_TO_JSON(pm), '{}'::JSON)
                    FROM (SELECT team_member_id AS id,
                                (SELECT COALESCE(ROW_TO_JSON(pmi), '{}'::JSON)
                                  FROM (SELECT name,
                                              email,
                                              avatar_url
                                        FROM team_member_info_view tmiv
                                        WHERE tmiv.team_member_id = pm.team_member_id
                                          AND tmiv.team_id = (SELECT team_id FROM projects WHERE id = $1)) pmi) AS project_manager_info,
                                EXISTS(SELECT email
                                        FROM email_invitations
                                        WHERE team_member_id = pm.team_member_id
                                          AND email_invitations.team_id = (SELECT team_id
                                                                          FROM team_member_info_view
                                                                          WHERE team_member_id = pm.team_member_id)) AS pending_invitation,
                                (SELECT active FROM team_members WHERE id = pm.team_member_id)
                          FROM project_members pm
                          WHERE project_id = $1
                            AND project_access_level_id = (SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER')) pm) AS project_manager
      FROM projects
             LEFT JOIN sys_project_statuses sps ON projects.status_id = sps.id
      WHERE projects.id = $1
        AND team_id = $2;
    `;
    const result = await db.query(q, [req.params.id, req.user?.team_id ?? null, req.user?.id ?? null]);
    const [data] = result.rows;

    if (data && data.project_manager) {
      data.project_manager.name = data.project_manager.project_manager_info.name;
      data.project_manager.email = data.project_manager.project_manager_info.email;
      data.project_manager.avatar_url = data.project_manager.project_manager_info.avatar_url;
      data.project_manager.color_code = getColor(data.project_manager.name);
    }

    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions({
    raisedExceptions: {
      "PROJECT_EXISTS_ERROR": `Project with "{0}" name already exists. Please choose a different project name.`
    }
  })
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT update_project($1) AS project;`;

    const key = req.body.key?.toString().trim().toUpperCase();

    if (!key)
      return res.status(200).send(new ServerResponse(false, null, "The project key cannot be empty."));

    if (key.length > 5)
      return res.status(200).send(new ServerResponse(false, null, "The project key length cannot exceed 5 characters."));

    req.body.id = req.params.id;
    req.body.team_id = req.user?.team_id || null;
    req.body.user_id = req.user?.id || null;
    req.body.folder_id = req.body.folder_id || null;
    req.body.category_id = req.body.category_id || null;
    req.body.client_name = req.body.client_name?.trim() || null;
    req.body.project_created_log = LOG_DESCRIPTIONS.PROJECT_UPDATED;
    req.body.project_member_added_log = LOG_DESCRIPTIONS.PROJECT_MEMBER_ADDED;
    req.body.project_member_removed_log = LOG_DESCRIPTIONS.PROJECT_MEMBER_REMOVED;
    req.body.team_member_id = req.body.project_manager ? req.body.project_manager.id : null;

    const result = await db.query(q, [JSON.stringify(req.body)]);
    const [data] = result.rows;

    this.notifyProjecManagertUpdates(req.params.id, req.user as IPassportSession, req.body.project_manager ? req.body.project_manager.id : null);

    return res.status(200).send(new ServerResponse(true, data.project));
  }

  @HandleExceptions()
  public static async deleteById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `DELETE
               FROM projects
               WHERE id = $1
                 AND team_id = $2`;
    const result = await db.query(q, [req.params.id, req.user?.team_id || null]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getOverview(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT (SELECT COUNT(id)
              FROM tasks
              WHERE archived IS FALSE
                AND project_id = $1
                AND status_id IN
                    (SELECT id
                     FROM task_statuses
                     WHERE category_id =
                           (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE))) AS done_task_count,

             (SELECT COUNT(id)
              FROM tasks
              WHERE archived IS FALSE
                AND project_id = $1
                AND status_id IN
                    (SELECT id
                     FROM task_statuses
                     WHERE category_id IN
                           (SELECT id
                            FROM sys_task_status_categories
                            WHERE is_doing IS TRUE
                               OR is_todo IS TRUE))) AS pending_task_count
      FROM projects
      WHERE id = $1
        AND team_id = $2;
    `;
    const result = await db.query(q, [req.params.id, req.user?.team_id || null]);
    const [data] = result.rows;

    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async getOverviewMembers(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {archived} = req.query;
    const q = `
      SELECT team_member_id AS id,
             FALSE AS active,
             (SELECT COUNT(*)
              FROM tasks
              WHERE archived IS FALSE
                AND project_id = $1
                AND CASE
                      WHEN ($2 IS TRUE) THEN project_id IS NOT NULL
                      ELSE archived IS FALSE END) AS project_task_count,
             (SELECT COUNT(*)
              FROM tasks_assignees
                     INNER JOIN tasks t ON tasks_assignees.task_id = t.id
              WHERE CASE
                      WHEN ($2 IS TRUE) THEN t.project_id IS NOT NULL
                      ELSE archived IS FALSE END
                AND project_member_id = project_members.id) AS task_count,
             (SELECT COUNT(*)
              FROM tasks_assignees
                     INNER JOIN tasks t ON tasks_assignees.task_id = t.id
                     INNER JOIN task_statuses ts ON t.status_id = ts.id
              WHERE CASE
                      WHEN ($2 IS TRUE) THEN t.project_id IS NOT NULL
                      ELSE archived IS FALSE END
                AND project_member_id = project_members.id
                AND ts.category_id IN
                    (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE)) AS done_task_count,

             (SELECT COUNT(*)
              FROM tasks_assignees
                     INNER JOIN tasks t ON tasks_assignees.task_id = t.id
                     INNER JOIN task_statuses ts ON t.status_id = ts.id
              WHERE CASE
                      WHEN ($2 IS TRUE) THEN t.project_id IS NOT NULL
                      ELSE archived IS FALSE END
                AND project_member_id = project_members.id
                AND end_date::DATE < CURRENT_DATE::DATE
                AND t.status_id NOT IN (SELECT id
                                        FROM task_statuses
                                        WHERE category_id NOT IN
                                              (SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE))) AS overdue_task_count,
             (SELECT COUNT(*)
              FROM tasks_assignees
                     INNER JOIN tasks t ON tasks_assignees.task_id = t.id
                     INNER JOIN task_statuses ts ON t.status_id = ts.id
              WHERE CASE
                      WHEN ($2 IS TRUE) THEN t.project_id IS NOT NULL
                      ELSE archived IS FALSE END
                AND project_member_id = project_members.id
                AND ts.category_id IN
                    (SELECT id
                     FROM sys_task_status_categories
                     WHERE is_doing IS TRUE
                        OR is_todo IS TRUE)) AS pending_task_count,
             (SELECT name FROM team_member_info_view WHERE team_member_info_view.team_member_id = tm.id),
             u.avatar_url,
             (SELECT team_member_info_view.email
              FROM team_member_info_view
              WHERE team_member_info_view.team_member_id = tm.id),
             (SELECT name FROM job_titles WHERE id = tm.job_title_id) AS job_title
      FROM project_members
             INNER JOIN team_members tm ON project_members.team_member_id = tm.id
             LEFT JOIN users u ON tm.user_id = u.id
      WHERE project_id = $1;
    `;
    const result = await db.query(q, [req.params.id, archived === "true"]);

    for (const item of result.rows) {
      item.progress =
        item.task_count > 0
          ? ((item.done_task_count / item.task_count) * 100).toFixed(0)
          : 0;
      item.contribution =
        item.project_task_count > 0
          ? ((item.task_count / item.project_task_count) * 100).toFixed(0)
          : 0;
      item.tasks = [];
    }

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getAllTasks(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {searchQuery, size, offset} = this.toPaginationOptions(req.query, ["tasks.name"]);
    const filterByMember = !req.user?.owner && !req.user?.is_admin ?
      ` AND is_member_of_project(p.id, '${req.user?.id}', $1) ` : "";

    const isDueSoon = req.query.filter == "1";

    const dueSoon = isDueSoon ? "AND tasks.end_date IS NOT NULL" : "";
    const orderBy = isDueSoon ? "tasks.end_date DESC" : "p.name";
    const assignedToMe = req.query.filter == "2" ? `
      AND tasks.id IN (SELECT task_id
        FROM tasks_assignees
        WHERE team_member_id = (SELECT id
                                FROM team_members
                                WHERE user_id = '${req.user?.id}'
                                  AND team_id = $1))
      ` : "";

    const q = `
      SELECT ROW_TO_JSON(rec) AS projects
      FROM (SELECT COUNT(*) AS total,
                   (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
                    FROM (SELECT tasks.id,
                                 tasks.name,
                                 p.team_id,
                                 p.name AS project_name,
                                 tasks.start_date,
                                 tasks.end_date,
                                 p.id AS project_id,
                                 p.color_code AS project_color,
                                 (SELECT name FROM task_statuses WHERE id = tasks.status_id) AS status,
                                 (SELECT color_code
                                  FROM sys_task_status_categories
                                  WHERE id = (SELECT category_id FROM task_statuses WHERE id = tasks.status_id)) AS status_color,
                                 (SELECT get_task_assignees(tasks.id)) AS names
                          FROM tasks
                                 INNER JOIN projects p ON tasks.project_id = p.id
                          WHERE tasks.archived IS FALSE
                            AND p.team_id = $1 ${filterByMember} ${dueSoon} ${searchQuery} ${assignedToMe}
                          ORDER BY ${orderBy}
                          LIMIT $2 OFFSET $3) t) AS data
            FROM tasks
                   INNER JOIN projects p ON tasks.project_id = p.id
            WHERE tasks.archived IS FALSE
              AND p.team_id = $1 ${filterByMember} ${dueSoon} ${searchQuery} ${assignedToMe}) rec;
    `;
    const result = await db.query(q, [req.user?.team_id || null, size, offset]);
    const [data] = result.rows;

    for (const project of data?.projects.data || []) {
      project.progress = project.all_tasks_count > 0
        ? ((project.completed_tasks_count / project.all_tasks_count) * 100).toFixed(0) : 0;

      project.names = this.createTagList(project?.names);
      project.names.map((a: any) => a.color_code = getColor(a.name));
    }

    return res.status(200).send(new ServerResponse(true, data.projects || this.paginatedDatasetDefaultStruct));
  }

  @HandleExceptions()
  public static async getAllProjects(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT id AS value, name AS text
               FROM projects
               WHERE team_id = $1
               ORDER BY name;`;
    const result = await db.query(q, [req.user?.team_id || null]);
    return res.status(200).send(new ServerResponse(true, result.rows || []));
  }

  @HandleExceptions()
  public static async toggleFavorite(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT toggle_favorite_project($1, $2);`;
    const result = await db.query(q, [req.user?.id, req.params.id]);
    return res.status(200).send(new ServerResponse(true, result.rows || []));
  }

  @HandleExceptions()
  public static async toggleArchive(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT toggle_archive_project($1, $2);`;
    const result = await db.query(q, [req.user?.id, req.params.id]);
    return res.status(200).send(new ServerResponse(true, result.rows || []));
  }

  @HandleExceptions()
  public static async toggleArchiveAll(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT toggle_archive_all_projects($1);`;
    const result = await db.query(q, [req.params.id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data.toggle_archive_all_projects || []));
  }

  public static async getProjectManager(projectId: string) {
    const q =  `SELECT team_member_id FROM project_members WHERE project_id = $1 AND project_access_level_id = (SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER')`;
    const result = await db.query(q, [projectId]);
    return result.rows || [];
  }

  public static async updateExistPhaseColors() {
    const q = `SELECT id, name FROM project_phases`;
    const phases = await db.query(q);

    phases.rows.forEach((phase) => {
      phase.color_code = getColor(phase.name);
    });

    const body = {
      phases: phases.rows
    };

    const q2 = `SELECT update_existing_phase_colors($1)`;
    await db.query(q2, [JSON.stringify(body)]);

  }

  public static async updateExistSortOrder() {
    const q = `SELECT id, project_id FROM project_phases ORDER BY name`;
    const phases = await db.query(q);

    const sortNumbers: any = {};

    phases.rows.forEach(phase => {
        const projectId = phase.project_id;

        if (!sortNumbers[projectId]) {
            sortNumbers[projectId] = 0;
        }

        phase.sort_number = sortNumbers[projectId]++;
    });

    const body = {
      phases: phases.rows
    };

    const q2 = `SELECT update_existing_phase_sort_order($1)`;
    await db.query(q2, [JSON.stringify(body)]);
    // return phases;

  }

  @HandleExceptions()
  public static async getGrouped(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    // Use qualified field name for projects to avoid ambiguity
    const {searchQuery, sortField, sortOrder, size, offset} = this.toPaginationOptions(req.query, ["projects.name"]);
    const groupBy = req.query.groupBy as string || "category";

    const filterByMember = !req.user?.owner && !req.user?.is_admin ?
      ` AND is_member_of_project(projects.id, '${req.user?.id}', $1) ` : "";

    const isFavorites = req.query.filter === "1" ? ` AND EXISTS(SELECT user_id FROM favorite_projects WHERE user_id = '${req.user?.id}' AND project_id = projects.id)` : "";
    const isArchived = req.query.filter === "2"
      ? ` AND EXISTS(SELECT user_id FROM archived_projects WHERE user_id = '${req.user?.id}' AND project_id = projects.id)`
      : ` AND NOT EXISTS(SELECT user_id FROM archived_projects WHERE user_id = '${req.user?.id}' AND project_id = projects.id)`;
    const categories = this.getFilterByCategoryWhereClosure(req.query.categories as string);
    const statuses = this.getFilterByStatusWhereClosure(req.query.statuses as string);

    // Determine grouping field and join based on groupBy parameter
    let groupField = "";
    let groupName = "";
    let groupColor = "";
    let groupJoin = "";
    let groupByFields = "";
    let groupOrderBy = "";

    switch (groupBy) {
      case "client":
        groupField = "COALESCE(projects.client_id::text, 'no-client')";
        groupName = "COALESCE(clients.name, 'No Client')";
        groupColor = "'#688'";
        groupJoin = "LEFT JOIN clients ON projects.client_id = clients.id";
        groupByFields = "projects.client_id, clients.name";
        groupOrderBy = "COALESCE(clients.name, 'No Client')";
        break;
      case "status":
        groupField = "COALESCE(projects.status_id::text, 'no-status')";
        groupName = "COALESCE(sys_project_statuses.name, 'No Status')";
        groupColor = "COALESCE(sys_project_statuses.color_code, '#888')";
        groupJoin = "LEFT JOIN sys_project_statuses ON projects.status_id = sys_project_statuses.id";
        groupByFields = "projects.status_id, sys_project_statuses.name, sys_project_statuses.color_code";
        groupOrderBy = "COALESCE(sys_project_statuses.name, 'No Status')";
        break;
      case "category":
      default:
        groupField = "COALESCE(projects.category_id::text, 'uncategorized')";
        groupName = "COALESCE(project_categories.name, 'Uncategorized')";
        groupColor = "COALESCE(project_categories.color_code, '#888')";
        groupJoin = "LEFT JOIN project_categories ON projects.category_id = project_categories.id";
        groupByFields = "projects.category_id, project_categories.name, project_categories.color_code";
        groupOrderBy = "COALESCE(project_categories.name, 'Uncategorized')";
    }

    // Ensure sortField is properly qualified for the inner project query
    let qualifiedSortField = sortField;
    if (Array.isArray(sortField)) {
      qualifiedSortField = sortField[0]; // Take the first field if it's an array
    }
    // Replace "projects." with "p2." for the inner query
    const innerSortField = qualifiedSortField.replace("projects.", "p2.");

    const q = `
      SELECT ROW_TO_JSON(rec) AS groups
      FROM (
        SELECT COUNT(DISTINCT ${groupField}) AS total_groups,
               (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(group_data))), '[]'::JSON)
                FROM (
                  SELECT ${groupField} AS group_key,
                         ${groupName} AS group_name,
                         ${groupColor} AS group_color,
                         COUNT(*) AS project_count,
                         (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(project_data))), '[]'::JSON)
                          FROM (
                            SELECT p2.id,
                                   p2.name,
                                   (SELECT sys_project_statuses.name FROM sys_project_statuses WHERE sys_project_statuses.id = p2.status_id) AS status,
                                   (SELECT sys_project_statuses.color_code FROM sys_project_statuses WHERE sys_project_statuses.id = p2.status_id) AS status_color,
                                   (SELECT sys_project_statuses.icon FROM sys_project_statuses WHERE sys_project_statuses.id = p2.status_id) AS status_icon,
                                   EXISTS(SELECT user_id
                                          FROM favorite_projects
                                          WHERE user_id = '${req.user?.id}'
                                            AND project_id = p2.id) AS favorite,
                                   EXISTS(SELECT user_id
                                          FROM archived_projects
                                          WHERE user_id = '${req.user?.id}'
                                            AND project_id = p2.id) AS archived,
                                   p2.color_code,
                                   p2.start_date,
                                   p2.end_date,
                                   p2.category_id,
                                   (SELECT COUNT(*)
                                    FROM tasks
                                    WHERE archived IS FALSE
                                      AND project_id = p2.id) AS all_tasks_count,
                                   (SELECT COUNT(*)
                                    FROM tasks
                                    WHERE archived IS FALSE
                                      AND project_id = p2.id
                                      AND status_id IN (SELECT task_statuses.id
                                                        FROM task_statuses
                                                        WHERE task_statuses.project_id = p2.id
                                                          AND task_statuses.category_id IN
                                                              (SELECT sys_task_status_categories.id FROM sys_task_status_categories WHERE sys_task_status_categories.is_done IS TRUE))) AS completed_tasks_count,
                                   (SELECT COUNT(*)
                                    FROM project_members
                                    WHERE project_members.project_id = p2.id) AS members_count,
                                   (SELECT get_project_members(p2.id)) AS names,
                                   (SELECT clients.name FROM clients WHERE clients.id = p2.client_id) AS client_name,
                                   (SELECT users.name FROM users WHERE users.id = p2.owner_id) AS project_owner,
                                   (SELECT project_categories.name FROM project_categories WHERE project_categories.id = p2.category_id) AS category_name,
                                   (SELECT project_categories.color_code
                                    FROM project_categories
                                    WHERE project_categories.id = p2.category_id) AS category_color,
                                   ((SELECT project_members.team_member_id as team_member_id
                                      FROM project_members
                                      WHERE project_members.project_id = p2.id
                                        AND project_members.project_access_level_id = (SELECT project_access_levels.id FROM project_access_levels WHERE project_access_levels.key = 'PROJECT_MANAGER'))) AS project_manager_team_member_id,
                                   (SELECT project_members.default_view
                                      FROM project_members
                                      WHERE project_members.project_id = p2.id
                                        AND project_members.team_member_id = '${req.user?.team_member_id}') AS team_member_default_view,
                                   (SELECT CASE
                                             WHEN ((SELECT MAX(tasks.updated_at)
                                                    FROM tasks
                                                    WHERE tasks.archived IS FALSE
                                                      AND tasks.project_id = p2.id) >
                                                   p2.updated_at)
                                               THEN (SELECT MAX(tasks.updated_at)
                                                     FROM tasks
                                                     WHERE tasks.archived IS FALSE
                                                       AND tasks.project_id = p2.id)
                                             ELSE p2.updated_at END) AS updated_at
                            FROM projects p2
                            ${groupJoin.replace("projects.", "p2.")}
                            WHERE p2.team_id = $1
                              AND ${groupField.replace("projects.", "p2.")} = ${groupField}
                              ${categories.replace("projects.", "p2.")}
                              ${statuses.replace("projects.", "p2.")}
                              ${isArchived.replace("projects.", "p2.")}
                              ${isFavorites.replace("projects.", "p2.")}
                              ${filterByMember.replace("projects.", "p2.")}
                              ${searchQuery.replace("projects.", "p2.")}
                            ORDER BY ${innerSortField} ${sortOrder}
                          ) project_data
                         ) AS projects
                  FROM projects
                  ${groupJoin}
                  WHERE projects.team_id = $1 ${categories} ${statuses} ${isArchived} ${isFavorites} ${filterByMember} ${searchQuery}
                  GROUP BY ${groupByFields}
                  ORDER BY ${groupOrderBy}
                  LIMIT $2 OFFSET $3
                ) group_data
               ) AS data
        FROM projects
        ${groupJoin}
        WHERE projects.team_id = $1 ${categories} ${statuses} ${isArchived} ${isFavorites} ${filterByMember} ${searchQuery}
      ) rec;
    `;

    const result = await db.query(q, [req.user?.team_id || null, size, offset]);
    const [data] = result.rows;

    // Process the grouped data
    for (const group of data?.groups.data || []) {
      for (const project of group.projects || []) {
        project.progress = project.all_tasks_count > 0
          ? ((project.completed_tasks_count / project.all_tasks_count) * 100).toFixed(0) : 0;

        project.updated_at_string = moment(project.updated_at).fromNow();

        project.names = this.createTagList(project?.names);
        project.names.map((a: any) => a.color_code = getColor(a.name));

        if (project.project_manager_team_member_id) {
          project.project_manager = {
            id: project.project_manager_team_member_id
          };
        }
      }
    }

    return res.status(200).send(new ServerResponse(true, data?.groups || { total_groups: 0, data: [] }));
  }

}

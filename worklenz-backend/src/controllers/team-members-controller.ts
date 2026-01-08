import moment from "moment";
import Excel from "exceljs";
import crypto from "crypto";

import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import db from "../config/db";
import { IPassportSession } from "../interfaces/passport-session";
import { ServerResponse } from "../models/server-response";
import { SqlHelper } from "../shared/sql-helpers";
import { sendInvitationEmail } from "../shared/email-templates";
import { IO } from "../shared/io";
import { SocketEvents } from "../socket.io/events";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { formatDuration, getColor } from "../shared/utils";
import { statusExclude, TEAM_MEMBER_TREE_MAP_COLOR_ALPHA, TRIAL_MEMBER_LIMIT } from "../shared/constants";
import { checkTeamSubscriptionStatus } from "../shared/paddle-utils";
import { updateUsers } from "../shared/paddle-requests";
import { NotificationsService } from "../services/notifications/notifications.service";

export default class TeamMembersController extends WorklenzControllerBase {

  public static async checkIfUserAlreadyExists(owner_id: string, email: string) {
    if (!owner_id) throw new Error("Owner not found.");

    const q = `SELECT EXISTS(SELECT tmi.team_member_id
              FROM team_member_info_view AS tmi
                       JOIN teams AS t ON tmi.team_id = t.id
              WHERE tmi.email = $1::TEXT
                AND t.user_id = $2::UUID);`;
    const result = await db.query(q, [email, owner_id]);

    const [data] = result.rows;
    return data.exists;
  }

  public static async checkIfUserActiveInOtherTeams(owner_id: string, email: string) {
    if (!owner_id) throw new Error("Owner not found.");

    const q = `SELECT EXISTS(SELECT tmi.team_member_id
              FROM team_member_info_view AS tmi
                       JOIN teams AS t ON tmi.team_id = t.id
                       JOIN team_members AS tm ON tmi.team_member_id = tm.id
              WHERE tmi.email = $1::TEXT
              AND t.user_id = $2::UUID AND tm.active = true);`;
    const result = await db.query(q, [email, owner_id]);

    const [data] = result.rows;
    return data.exists;
  }

  public static async createOrInviteMembers<T>(body: T, user: IPassportSession): Promise<Array<{
    name?: string;
    email?: string;
    is_new?: string;
    team_member_id?: string;
    team_member_user_id?: string;
  }>> {
    const q = `SELECT create_team_member($1) AS new_members;`;
    const result = await db.query(q, [JSON.stringify(body)]);

    const [data] = result.rows;
    const newMembers = data?.new_members || [];


    const projectId = (body as any)?.project_id;

    NotificationsService.sendTeamMembersInvitations(newMembers, user, projectId || "");

    return newMembers;
  }

  @HandleExceptions({
    raisedExceptions: {
      "ERROR_EMAIL_INVITATION_EXISTS": `Team member with email "{0}" already exists.`
    }
  })
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    req.body.team_id = req.user?.team_id || null;

    if (!req.user?.team_id) {
      return res.status(200).send(new ServerResponse(false, "Required fields are missing."));
    }

    /**
   * Checks the subscription status of the team.
   * @type {Object} subscriptionData - Object containing subscription information
   */
    const subscriptionData = await checkTeamSubscriptionStatus(req.user?.team_id);

    let incrementBy = 0;

    // Handle self-hosted subscriptions differently
    if (subscriptionData.subscription_type === 'SELF_HOSTED') {
      // Check if users exist and add them if they don't
      await Promise.all(req.body.emails.map(async (email: string) => {
        const trimmedEmail = email.trim();
        const userExists = await this.checkIfUserAlreadyExists(req.user?.owner_id as string, trimmedEmail);
        if (!userExists) {
          incrementBy = incrementBy + 1;
        }
      }));

      // Create or invite new members
      const newMembers = await this.createOrInviteMembers(req.body, req.user);
      return res.status(200).send(new ServerResponse(true, newMembers, `Your teammates will get an email that gives them access to your team.`).withTitle("Invitations sent"));
    }

    /**
   * Iterates through each email in the request body and checks if the user already exists.
   * If the user doesn't exist, increments the counter.
   * @param {string} email - Email address to check
   */
    await Promise.all(req.body.emails.map(async (email: string) => {
      const trimmedEmail = email.trim();

      const userExists = await this.checkIfUserAlreadyExists(req.user?.owner_id as string, trimmedEmail);
      const isUserActive = await this.checkIfUserActiveInOtherTeams(req.user?.owner_id as string, trimmedEmail);

      if (!userExists || !isUserActive) {
        incrementBy = incrementBy + 1;
      }
    }));

    /**
   * Checks subscription details and updates the user count if applicable.
   * Sends a response if there is an issue with the subscription.
   */
    // Check Business plan limits first - Business plans override AppSumo lifetime limits
    if (!subscriptionData.is_credit && !subscriptionData.is_custom && subscriptionData.subscription_status === "active") {
      const updatedCount = parseInt(subscriptionData.current_count) + incrementBy;
      const effectiveUserLimit = subscriptionData.effective_user_limit || subscriptionData.quantity || 25;
      const requiredSeats = updatedCount - effectiveUserLimit;
      if (updatedCount > effectiveUserLimit) {
        const obj = {
          seats_enough: false,
          required_count: requiredSeats,
          current_seat_amount: effectiveUserLimit
        };
        return res.status(200).send(new ServerResponse(false, obj, "Insufficient seats available. Please upgrade your subscription to add more team members."));
      }
    }

    /**
   * Checks various conditions to determine if the maximum number of lifetime users is exceeded.
   * Only applies to users who are still on AppSumo lifetime deals (not upgraded to Business plans)
   */
    if (
      incrementBy > 0
      && subscriptionData.is_ltd
      && subscriptionData.current_count
      && subscriptionData.subscription_type !== 'ANNUAL_BUSINESS'
      && ((parseInt(subscriptionData.current_count) + req.body.emails.length) > parseInt(subscriptionData.ltd_users))) {
      return res.status(200).send(new ServerResponse(false, null, "Cannot exceed the maximum number of life time users."));
    }

    if (
      subscriptionData.is_ltd
      && subscriptionData.current_count
      && subscriptionData.subscription_type !== 'ANNUAL_BUSINESS'
      && ((parseInt(subscriptionData.current_count) + incrementBy) > parseInt(subscriptionData.ltd_users))) {
      return res.status(200).send(new ServerResponse(false, null, "Cannot exceed the maximum number of life time users."));
    }

    /**
   * Checks trial user team member limit
   */
    if (subscriptionData.subscription_status === "trialing") {
      const currentTrialMembers = parseInt(subscriptionData.current_count) || 0;

      if (currentTrialMembers + incrementBy > TRIAL_MEMBER_LIMIT) {
        return res.status(200).send(new ServerResponse(false, null, `Trial users cannot exceed ${TRIAL_MEMBER_LIMIT} team members. Please upgrade to add more members.`));
      }
    }

    /**
   * Checks if the subscription status is in the exclusion list.
   * Sends a response if the status is excluded.
   */
    if (statusExclude.includes(subscriptionData.subscription_status)) {
      return res.status(200).send(new ServerResponse(false, null, "Unable to add user! Please check your subscription status."));
    }

    /**
   * Creates or invites new members based on the request body and user information.
   * Sends a response with the result.
   */
    const newMembers = await this.createOrInviteMembers(req.body, req.user);
    return res.status(200).send(new ServerResponse(true, newMembers, `Your teammates will get an email that gives them access to your team.`).withTitle("Invitations sent"));
  }

  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    req.query.field = ["is_owner", "active", "u.name", "u.email"];
    req.query.order = "descend";

    // Helper function to check for encoded components
    function containsEncodedComponents(x: string) {
      return decodeURI(x) !== decodeURIComponent(x);
    }

    // Decode search parameter if it contains encoded components
    if (req.query.search && typeof req.query.search === 'string') {
      if (containsEncodedComponents(req.query.search)) {
        req.query.search = decodeURIComponent(req.query.search);
      }
    }

    const {
      searchQuery,
      sortField,
      sortOrder,
      size,
      offset
    } = this.toPaginationOptions(req.query, ["u.name", "u.email"], true);

    const paginate = req.query.all === "false" ? `LIMIT ${size} OFFSET ${offset}` : "";

    const q = `
      SELECT COUNT(*) AS total,
             (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
              FROM (SELECT team_members.id,
                           (SELECT name
                            FROM team_member_info_view
                            WHERE team_member_info_view.team_member_id = team_members.id),
                           u.avatar_url,
                           (u.socket_id IS NOT NULL) AS is_online,
                           (SELECT COUNT(*)
                            FROM project_members
                            WHERE team_member_id = team_members.id) AS projects_count,
                           (SELECT name FROM job_titles WHERE id = team_members.job_title_id) AS job_title,
                           (SELECT name FROM roles WHERE id = team_members.role_id) AS role_name,
                           EXISTS(SELECT id
                                  FROM roles
                                  WHERE id = team_members.role_id
                                    AND admin_role IS TRUE) AS is_admin,
                           (CASE
                              WHEN user_id = (SELECT user_id FROM teams WHERE id = $1) THEN TRUE
                              ELSE FALSE END) AS is_owner,
                           (SELECT email
                            FROM team_member_info_view
                            WHERE team_member_info_view.team_member_id = team_members.id) AS email,
                           EXISTS(SELECT email
                                  FROM email_invitations
                                  WHERE team_member_id = team_members.id
                                    AND email_invitations.team_id = team_members.team_id) AS pending_invitation,
                           team_members.reports_to_member_id,
                           (SELECT name FROM team_member_info_view 
                            WHERE team_member_info_view.team_member_id = team_members.reports_to_member_id) AS current_team_lead_name,
                            active
                    FROM team_members
                           LEFT JOIN users u ON team_members.user_id = u.id
                    WHERE ${searchQuery} team_id = $1
                    ORDER BY ${sortField} ${sortOrder} ${paginate}) t) AS data
      FROM team_members
             LEFT JOIN users u ON team_members.user_id = u.id
      WHERE ${searchQuery} team_id = $1
    `;
    const result = await db.query(q, [req.user?.team_id || null]);
    const [members] = result.rows;

    members.data?.map((a: any) => {
      a.color_code = getColor(a.name);
      return a;
    });

    return res.status(200).send(new ServerResponse(true, members || this.paginatedDatasetDefaultStruct));
  }

  @HandleExceptions()
  public static async getAllMembers(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT get_team_members($1, $2) AS members;`;
    const result = await db.query(q, [req.user?.team_id || null, req.query.project || null]);

    const [data] = result.rows;
    const members = data?.members || [];

    for (const member of members) {
      member.color_code = getColor(member.name);
      member.usage = +member.usage;
    }

    return res.status(200).send(new ServerResponse(true, members));
  }

  @HandleExceptions()
  public static async getById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT id,
             created_at,
             updated_at,
             (SELECT name FROM team_member_info_view WHERE team_member_info_view.team_member_id = team_members.id),
             (SELECT avatar_url FROM users WHERE id = team_members.user_id),
             EXISTS(SELECT email
                    FROM email_invitations
                    WHERE team_member_id = team_members.id
                      AND email_invitations.team_id = team_members.team_id) AS pending_invitation,
             (SELECT name FROM job_titles WHERE id = team_members.job_title_id) AS job_title,
             COALESCE(
               (SELECT email FROM users WHERE id = team_members.user_id),
               (SELECT email
                FROM email_invitations
                WHERE email_invitations.team_member_id = team_members.id
                  AND email_invitations.team_id = team_members.team_id
                LIMIT 1)
               ) AS email,
             EXISTS(SELECT id FROM roles WHERE id = team_members.role_id AND admin_role IS TRUE) AS is_admin
      FROM team_members
      WHERE id = $1
        AND team_id = $2;
    `;
    const result = await db.query(q, [req.params.id, req.user?.team_id || null]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async getTeamMembersByProject(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT project_members.id,
             team_member_id,
             project_access_level_id,
             (SELECT name
              FROM project_access_levels
              WHERE id = project_access_level_id) AS project_access_level_name,
             (SELECT name FROM team_member_info_view WHERE team_member_info_view.team_member_id = tm.id),
             u.avatar_url,
             (SELECT team_member_info_view.email
              FROM team_member_info_view
              WHERE team_member_info_view.team_member_id = tm.id)
      FROM project_members
             INNER JOIN team_members tm ON project_members.team_member_id = tm.id
             LEFT JOIN users u ON tm.user_id = u.id
      WHERE project_id = $1
      ORDER BY project_members.created_at DESC;
    `;
    const result = await db.query(q, [req.params.id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    req.body.id = req.params.id;
    req.body.team_id = req.user?.team_id || null;
    req.body.is_admin = !!req.body.is_admin;

    const q = `SELECT update_team_member($1) AS team_member;`;
    const result = await db.query(q, [JSON.stringify(req.body)]);

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async resend_invitation(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    req.body.team_id = req.user?.team_id || null;

    const q = `SELECT resend_team_invitation($1) AS invitation;`;
    const result = await db.query(q, [JSON.stringify(req.body)]);
    const [data] = result.rows;

    if (!data?.invitation || !data?.invitation.email)
      return res.status(200).send(new ServerResponse(false, null, "Resend failed! Please try again."));

    const member = data.invitation;

    sendInvitationEmail(
      !member.is_new,
      req.user as IPassportSession,
      !member.is_new ? member.name : member.team_member_id,
      member.email,
      member.team_member_user_id,
      member.name || member.email?.split("@")[0]
    );

    if (member.team_member_id) {
      NotificationsService.sendInvitation(
        req.user?.id as string,
        req.user?.name as string,
        req.user?.team_name as string,
        req.user?.team_id as string,
        member.team_member_id
      );
    }

    member.id = member.team_member_id;

    return res.status(200).send(new ServerResponse(true, null, "Invitation resent"));
  }

  @HandleExceptions()
  public static async deleteById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { id } = req.params;

    if (!id || !req.user?.team_id) return res.status(200).send(new ServerResponse(false, "Required fields are missing."));

    // check subscription status
    const subscriptionData = await checkTeamSubscriptionStatus(req.user?.team_id);
    if (statusExclude.includes(subscriptionData.subscription_status)) {
      return res.status(200).send(new ServerResponse(false, "Please check your subscription status."));
    }

    const q = `SELECT remove_team_member($1, $2, $3) AS member;`;
    const result = await db.query(q, [id, req.user?.id, req.user?.team_id]);
    const [data] = result.rows;

    const message = `You have been removed from <b>${req.user?.team_name}</b> by <b>${req.user?.name}</b>`;

    // if (subscriptionData.status === "trialing") break;
    // if (!subscriptionData.is_credit && !subscriptionData.is_custom) {
    //   if (subscriptionData.subscription_status === "active" && subscriptionData.quantity > 0) {
    //     const obj = await getActiveTeamMemberCount(req.user?.owner_id ?? "");
    //     // const activeObj = await getActiveTeamMemberCount(req.user?.owner_id ?? "");

    //     const userActiveInOtherTeams = await this.checkIfUserActiveInOtherTeams(req.user?.owner_id as string, req.query?.email as string);

    //     if (!userActiveInOtherTeams) {
    //       const response = await updateUsers(subscriptionData.subscription_id, obj.user_count);
    //       if (!response.body.subscription_id) return res.status(200).send(new ServerResponse(false, response.message || "Please check your subscription."));
    //     }
    //   }
    // }

    NotificationsService.sendNotification({
      receiver_socket_id: data.socket_id,
      message,
      team: data.team,
      team_id: id
    });

    IO.emitByUserId(data.member.id, req.user?.id || null, SocketEvents.TEAM_MEMBER_REMOVED, {
      teamId: id,
      message
    });
    return res.status(200).send(new ServerResponse(true, result.rows));

  }

  @HandleExceptions()
  public static async getOverview(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT (SELECT name FROM projects WHERE id = project_members.project_id) AS name,
             (SELECT COUNT(*) FROM tasks_assignees WHERE project_member_id = project_members.id) AS assigned_task_count,

             (SELECT COUNT(*)
              FROM tasks_assignees
                     INNER JOIN tasks t ON tasks_assignees.task_id = t.id
                     INNER JOIN task_statuses ts ON t.status_id = ts.id
              WHERE t.archived IS FALSE
                AND project_member_id = project_members.id
                AND ts.category_id IN
                    (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE)) AS done_task_count,

             (SELECT COUNT(*)
              FROM tasks_assignees
                     INNER JOIN tasks t ON tasks_assignees.task_id = t.id
                     INNER JOIN task_statuses ts ON t.status_id = ts.id
              WHERE t.archived IS FALSE
                AND project_member_id = project_members.id
                AND ts.category_id IN
                    (SELECT id
                     FROM sys_task_status_categories
                     WHERE is_doing IS TRUE
                        OR is_todo IS TRUE)) AS pending_task_count

      FROM project_members
      WHERE team_member_id = $1;
    `;

    const result = await db.query(q, [req.params.id]);

    for (const object of result.rows) {
      object.progress =
        object.assigned_task_count > 0
          ? (
            (object.done_task_count / object.assigned_task_count) *
            100
          ).toFixed(0)
          : 0;
    }
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getOverviewChart(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
        SELECT(SELECT COUNT(*)
              FROM tasks_assignees
                        INNER JOIN tasks t ON tasks_assignees.task_id = t.id
                        INNER JOIN task_statuses ts ON t.status_id = ts.id
              WHERE t.archived IS FALSE AND project_member_id IN
                    (SELECT id FROM project_members WHERE team_member_id = $1)
                AND ts.category_id IN (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE)) AS done_count,

              (SELECT COUNT(*)
              FROM tasks_assignees
                        INNER JOIN tasks t ON tasks_assignees.task_id = t.id
                        INNER JOIN task_statuses ts ON t.status_id = ts.id
              WHERE t.archived IS FALSE AND project_member_id IN
                    (SELECT id FROM project_members WHERE team_member_id = $1)
                AND ts.category_id IN
                    (SELECT id FROM sys_task_status_categories WHERE is_doing IS TRUE OR is_todo IS TRUE)) AS pending_count;
      `;
    const result = await db.query(q, [req.params.id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async getTeamMembersTreeMap(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { selected, team, archived } = req.query;

    let q = "";

    if (selected === "time") {
      q = `SELECT ROW_TO_JSON(rec) AS team_members
           FROM (SELECT COUNT(*) AS total,
                        (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
                         FROM (SELECT team_members.id,
                                      (SELECT COUNT(*)
                                       FROM project_members
                                       WHERE team_member_id = team_members.id
                                         AND CASE
                                               WHEN ($3 IS TRUE) THEN project_id IS NOT NULL
                                               ELSE project_id NOT IN (SELECT project_id
                                                                       FROM archived_projects
                                                                       WHERE archived_projects.project_id = project_members.project_id
                                                                         AND archived_projects.user_id = $2) END) AS projects_count,
                                      (SELECT SUM(time_spent)
                                       FROM task_work_log
                                       WHERE user_id = team_members.user_id
                                         AND task_id IN (SELECT id
                                                         FROM tasks
                                                         WHERE project_id IN (SELECT id
                                                                              FROM projects
                                                                              WHERE team_id = $1)
                                                           AND CASE
                                                                 WHEN ($3 IS TRUE) THEN project_id IS NOT NULL
                                                                 ELSE project_id NOT IN (SELECT project_id
                                                                                         FROM archived_projects
                                                                                         WHERE archived_projects.project_id = tasks.project_id
                                                                                           AND archived_projects.user_id = $2) END)) AS time_logged,
                                      (SELECT name
                                       FROM team_member_info_view
                                       WHERE team_member_info_view.team_member_id = team_members.id),
                                      (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
                                       FROM (SELECT project_id,
                                                    (SELECT name
                                                     FROM projects
                                                     WHERE projects.id = project_members.project_id),
                                                    (SELECT SUM(time_spent)
                                                     FROM task_work_log
                                                     WHERE task_work_log.task_id IN (SELECT id
                                                                                     FROM tasks
                                                                                     WHERE tasks.project_id = project_members.project_id)
                                                       AND task_work_log.user_id IN (SELECT user_id
                                                                                     FROM team_members
                                                                                     WHERE team_member_id = team_members.id)
                                                       AND task_id IN (SELECT id
                                                                       FROM tasks
                                                                       WHERE id = task_work_log.task_id
                                                                         AND CASE
                                                                               WHEN ($3 IS TRUE)
                                                                                 THEN project_id IS NOT NULL
                                                                               ELSE project_id NOT IN (SELECT project_id
                                                                                                       FROM archived_projects
                                                                                                       WHERE archived_projects.project_id = tasks.project_id
                                                                                                         AND archived_projects.user_id = $2) END)) AS value
                                             FROM project_members
                                             WHERE team_member_id = team_members.id) t) AS projects
                               FROM team_members
                                      LEFT JOIN users u ON team_members.user_id = u.id
                               WHERE team_id = $1) t) AS data
                 FROM team_members
                        LEFT JOIN users u ON team_members.user_id = u.id
                 WHERE team_id = $1) rec;`;
    }

    if (selected === "tasks") {
      q = `SELECT ROW_TO_JSON(rec) AS team_members
           FROM (SELECT COUNT(*) AS total,
                        (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
                         FROM (SELECT team_members.id,
                                      (SELECT COUNT(*)
                                       FROM project_members
                                       WHERE team_member_id = team_members.id
                                         AND CASE
                                               WHEN ($3 IS FALSE) THEN project_id IS NOT NULL
                                               ELSE project_id NOT IN (SELECT project_id
                                                                       FROM archived_projects
                                                                       WHERE archived_projects.project_id = project_members.project_id
                                                                         AND archived_projects.user_id = $2) END) AS projects_count,
                                      (SELECT COUNT(*)
                                       FROM tasks_assignees
                                       WHERE team_member_id = team_members.id
                                         AND CASE
                                               WHEN ($3 IS FALSE) THEN task_id IN (SELECT id
                                                                                   FROM tasks
                                                                                   WHERE id = tasks_assignees.task_id
                                                                                     AND project_id NOT IN
                                                                                         (SELECT project_id
                                                                                          FROM archived_projects
                                                                                          WHERE archived_projects.project_id = tasks.project_id
                                                                                            AND archived_projects.user_id = $2))
                                               ELSE task_id IS NOT NULL END) AS task_count,
                                      (SELECT name
                                       FROM team_member_info_view
                                       WHERE team_member_info_view.team_member_id = team_members.id),
                                      (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
                                       FROM (SELECT project_id,
                                                    (SELECT name
                                                     FROM projects
                                                     WHERE projects.id = project_members.project_id),
                                                    (SELECT COUNT(*)
                                                     FROM tasks_assignees
                                                     WHERE project_member_id = project_members.id) AS value
                                             FROM project_members
                                             WHERE team_member_id = team_members.id
                                               AND CASE
                                                     WHEN ($3 IS FALSE) THEN project_id IS NOT NULL
                                                     ELSE project_id NOT IN (SELECT project_id
                                                                             FROM archived_projects
                                                                             WHERE archived_projects.project_id = project_members.project_id
                                                                               AND archived_projects.user_id = $2) END) t) AS projects
                               FROM team_members
                                      LEFT JOIN users u ON team_members.user_id = u.id
                               WHERE team_id = $1) t) AS DATA
                 FROM team_members
                        LEFT JOIN users u
                                  ON team_members.user_id = u.id
                 WHERE team_id = $1) rec`;
    }

    const result = await db.query(q, [team, req.user?.id, archived]);
    const [data] = result.rows;

    const obj: any[] = [];

    data.team_members.data.forEach((element: {
      id: string;
      name: string;
      projects_count: number;
      task_count: number;
      projects: any[];
      time_logged: number;
    }) => {
      obj.push({
        id: element.id,
        name: element.name,
        value: selected === "time" ? element.time_logged || 1 : element.task_count || 0,
        color: getColor(element.name) + TEAM_MEMBER_TREE_MAP_COLOR_ALPHA,
        label: selected === "time"
          ? formatDuration(moment.duration(element.time_logged || "0", "seconds"))
          : `<br>${element.task_count} total tasks`,
        labelToolTip: selected === "time"
          ? formatDuration(moment.duration(element.time_logged || "0", "seconds"))
          : `<b><br> - ${element.projects_count} projects <br> - ${element.task_count} total tasks</br>`
      });
      if (element.projects.length) {
        element.projects.forEach(item => {
          obj.push({
            id: item.project_id,
            name: item.name,
            parent: element.id,
            value: item.value || 1,
            label: selected === "time" ? formatDuration(moment.duration(item.value || "0", "seconds")) : `${item.value} tasks`
          });
        });
      }
    });
    data.team_members.data = obj;

    return res.status(200).send(new ServerResponse(true, data.team_members));
  }

  @HandleExceptions()
  public static async getProjectsByTeamMember(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { project, status, startDate, endDate } = req.query;

    // Use parameterized queries
    let projectsString = "";
    let statusString = "";
    let dateFilterString1 = "";
    let dateFilterString2 = "";
    let dateFilterString3 = "";
    const params: any[] = [];
    let paramOffset = 1;

    if (project && typeof project === "string") {
      const projectIds = project.split(",").filter(id => id.trim());
      const { clause, params: projectParams } = SqlHelper.buildInClause(projectIds, paramOffset);
      projectsString = `AND project_id IN (${clause})`;
      params.push(...projectParams);
      paramOffset += projectParams.length;
    }

    if (status && typeof status === "string") {
      const statusIds = status.split(",").filter(id => id.trim());
      const { clause, params: statusParams } = SqlHelper.buildInClause(statusIds, paramOffset);
      statusString = `AND status_id IN (${clause})`;
      params.push(...statusParams);
      paramOffset += statusParams.length;
    }

    if (startDate && endDate) {
      // Fix: Use parameterized dates
      dateFilterString1 = `AND twl2.created_at::DATE BETWEEN $${paramOffset}::DATE AND $${paramOffset + 1}::DATE) AS total_logged_time`;
      dateFilterString2 = `LEFT JOIN tasks t ON p.id = t.project_id LEFT JOIN task_work_log twl ON t.id = twl.task_id`;
      dateFilterString3 = `AND twl.user_id = (SELECT user_id FROM team_members WHERE id = project_members.team_member_id)
                          AND twl.created_at::DATE BETWEEN $${paramOffset}::DATE AND $${paramOffset + 1}::DATE;`;
      params.push(startDate, endDate);
      paramOffset += 2;
    }

    const q = `
        (SELECT color_code,
        name,
        (SELECT count(*)
         FROM tasks_assignees
         WHERE project_members.team_member_id = tasks_assignees.team_member_id
           AND task_id IN (SELECT id FROM tasks WHERE tasks.project_id = projects.id)) AS task_count,
        (SELECT name FROM teams WHERE teams.id = projects.team_id)                     AS team,
        (SELECT sum(time_spent)
         FROM task_work_log
         WHERE task_id IN (SELECT id
                           FROM tasks
                           WHERE tasks.project_id = projects.id
                             AND task_work_log.user_id =
                                 (SELECT user_id FROM team_members WHERE id = project_members.team_member_id)) ${dateFilterString1}) AS total_logged_time
        FROM project_members
                  LEFT JOIN projects ON project_id = projects.id
                  ${dateFilterString2}
        WHERE team_member_id = $1 ${projectsString} ${statusString} ${dateFilterString3}
        ORDER BY name)`;
    const result = await db.query(q, [req.params.id, ...params]);

    result.rows.forEach((element: { total_logged_time: string; }) => {
      element.total_logged_time = formatDuration(moment.duration(element.total_logged_time || "0", "seconds"));
    });
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getTasksByMembers(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT name,
             (SELECT COUNT(*)
              FROM tasks_assignees
              WHERE team_member_info_view.team_member_id = tasks_assignees.team_member_id) ::INT AS y
      FROM team_member_info_view
      WHERE team_id = $1
      ORDER BY name;`;
    const result = await db.query(q, [req.user?.team_id]);

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  public static async getTeamMemberInsightData(team_id: string | undefined, start: any, end: any, project: any, status: any, searchQuery: string, sortField: string, sortOrder: string, size: any, offset: any, all: any) {
    // Use parameterized queries
    let timeRangeTaskWorkLog = "";
    let projectsFilterString = "";
    let statusFilterString = "";
    const params: any[] = [team_id || null];
    let paramOffset = 2; // Start after team_id ($1)

    if (start && end) {
      // Fix: Use parameterized dates
      timeRangeTaskWorkLog = `AND EXISTS(SELECT id FROM task_work_log
        WHERE created_at::DATE BETWEEN $${paramOffset}::DATE AND $${paramOffset + 1}::DATE
        AND task_work_log.user_id = u.id)`;
      params.push(start, end);
      paramOffset += 2;
    }

    if (project && typeof project === "string") {
      // Fix: Use SqlHelper.buildInClause for safe IN clause
      const projectIds = project.split(",");
      const { clause, params: projectParams } = SqlHelper.buildInClause(projectIds, paramOffset);
      projectsFilterString = `AND team_members.id IN (SELECT team_member_id FROM project_members WHERE project_id IN (${clause}))`;
      params.push(...projectParams);
      paramOffset += projectParams.length;
    }

    if (status && typeof status === "string") {
      // Fix: Use SqlHelper.buildInClause (team_id is already $1, so use paramOffset for status)
      const statusIds = status.split(",");
      const { clause: statusClause, params: statusParams } = SqlHelper.buildInClause(statusIds, paramOffset);
      statusFilterString = `AND team_members.id IN (SELECT team_member_id
                                FROM project_members
                                WHERE project_id IN (SELECT id
                                                     FROM projects
                                                     WHERE projects.team_id = $1
                                                       AND status_id IN (${statusClause})))`;
      params.push(...statusParams);
      paramOffset += statusParams.length;
    }

    // Fix: Use parameterized pagination
    const paginate = all === "false" ? `LIMIT $${paramOffset} OFFSET $${paramOffset + 1}` : "";
    if (all === "false") {
      params.push(size, offset);
    }

    const q = `
      SELECT ROW_TO_JSON(rec) AS team_members
      FROM (SELECT COUNT(*) AS total,
                   (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
                    FROM (SELECT team_members.id,
                                 (SELECT name
                                  FROM team_member_info_view
                                  WHERE team_member_info_view.team_member_id = team_members.id),
                                 u.avatar_url,
                                 (u.socket_id IS NOT NULL) AS is_online,
                                 (SELECT COUNT(*)
                                  FROM project_members
                                  WHERE team_member_id = team_members.id) AS projects_count,
                                 (SELECT COUNT(*)
                                  FROM tasks_assignees
                                  WHERE team_member_id = team_members.id) AS task_count,
                                 (SELECT SUM(time_spent)
                                  FROM task_work_log
                                  WHERE task_work_log.user_id = tmiv.user_id
                                    AND task_id IN (SELECT id
                                                    FROM tasks
                                                    WHERE project_id IN (SELECT id
                                                                         FROM projects
                                                                         WHERE team_id = $1))) AS total_logged_time_seconds,
                                 (SELECT name FROM job_titles WHERE id = team_members.job_title_id) AS job_title,
                                 (SELECT name FROM roles WHERE id = team_members.role_id) AS role_name,
                                 EXISTS(SELECT id
                                        FROM roles
                                        WHERE id = team_members.role_id
                                          AND admin_role IS TRUE) AS is_admin,
                                 (CASE
                                    WHEN team_members.user_id = (SELECT user_id FROM teams WHERE id = $1) THEN TRUE
                                    ELSE FALSE END) AS is_owner,
                                 (SELECT email
                                  FROM team_member_info_view
                                  WHERE team_member_info_view.team_member_id = team_members.id),
                                 EXISTS(SELECT email
                                        FROM email_invitations
                                        WHERE team_member_id = team_members.id
                                          AND email_invitations.team_id = team_members.team_id) AS pending_invitation,
                                 (SELECT (ARRAY(SELECT NAME
                                                FROM teams
                                                WHERE id IN (SELECT team_id
                                                             FROM team_members
                                                             WHERE team_members.user_id = tmiv.user_id)))) AS member_teams
                          FROM team_members
                                 LEFT JOIN users u ON team_members.user_id = u.ID ${timeRangeTaskWorkLog}
                                 LEFT JOIN team_member_info_view tmiv ON team_members.id = tmiv.team_member_id
                          WHERE team_members.team_id = $1 ${searchQuery} ${timeRangeTaskWorkLog} ${projectsFilterString} ${statusFilterString}
                          ORDER BY ${sortField} ${sortOrder} ${paginate}) t) AS data
            FROM team_members
                   LEFT JOIN users u ON team_members.user_id = u.ID ${timeRangeTaskWorkLog}
                   LEFT JOIN team_member_info_view tmiv ON team_members.id = tmiv.team_member_id
            WHERE team_members.team_id = $1 ${searchQuery} ${timeRangeTaskWorkLog} ${projectsFilterString} ${statusFilterString}) rec;
    `;
    const result = await db.query(q, params);
    const [data] = result.rows;

    return data.team_members;
  }

  @HandleExceptions()
  public static async getTeamMemberList(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {
      searchQuery,
      sortField,
      sortOrder,
      size,
      offset
    } = this.toPaginationOptions(req.query, ["tmiv.name", "tmiv.email", "u.name"]);
    const { start, end, project, status, teamId } = req.query;

    const teamMembers = await this.getTeamMemberInsightData(teamId as string, start, end, project, status, searchQuery, sortField, sortOrder, size, offset, req.query.all);

    teamMembers.data.map((a: any) => {
      a.color_code = getColor(a.name);
      a.total_logged_time = formatDuration(moment.duration(a.total_logged_time_seconds || "0", "seconds"));
    });

    return res.status(200).send(new ServerResponse(true, teamMembers || this.paginatedDatasetDefaultStruct));
  }

  @HandleExceptions()
  public static async getTreeDataByMember(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { selected, id } = req.query;

    let valueString = `(SELECT sum(time_spent)
        FROM task_work_log
        WHERE task_work_log.task_id IN (SELECT id
                                        FROM tasks
                                        WHERE tasks.project_id = project_members.project_id)
          AND task_work_log.user_id IN (SELECT user_id
                                        FROM team_members
                                        WHERE team_member_id = team_members.id))::INT AS value`;

    if (selected === "tasks") {
      valueString = `(SELECT count(*) FROM tasks_assignees
        WHERE project_member_id = project_members.id)::INT        AS value`;
    }

    const q = `
      SELECT project_id,
             (SELECT name FROM projects WHERE projects.id = project_members.project_id),
             (SELECT color_code FROM projects WHERE projects.id = project_members.project_id) AS color,
             ${valueString}
      FROM project_members
      WHERE team_member_id = $1`;
    const result = await db.query(q, [id]);

    const obj: any[] = [];

    result.rows.forEach((element: {
      project_id: string;
      name: string;
      value: number;
      color: string;
      time_logged: number;
    }) => {
      obj.push({
        name: element.name,
        value: element.value || 1,
        colorValue: element.color + TEAM_MEMBER_TREE_MAP_COLOR_ALPHA,
        color: element.color + TEAM_MEMBER_TREE_MAP_COLOR_ALPHA,
        label: selected === "tasks" ? `${element.value} tasks` : formatDuration(moment.duration(element.value || "0", "seconds"))
      });
    });

    return res.status(200).send(new ServerResponse(true, obj));
  }

  @HandleExceptions()
  public static async exportAllMembers(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<void> {
    const {
      searchQuery,
      sortField,
      sortOrder,
      size,
      offset
    } = this.toPaginationOptions(req.query, ["tmiv.name", "tmiv.email", "u.name"]);
    const { start, end, project, status } = req.query;

    const teamMembers = await this.getTeamMemberInsightData(req.user?.team_id, start || null, end, project, status, searchQuery, sortField, sortOrder, size, offset, req.query.all);

    const exportDate = moment().format("MMM-DD-YYYY");
    const fileName = `Worklenz - Team Members Export - ${exportDate}`;
    const metadata = {};
    const title = "";

    const workbook = new Excel.Workbook();
    const sheet = workbook.addWorksheet(title);

    sheet.headerFooter = {
      firstHeader: title
    };

    sheet.columns = [
      { header: "Name", key: "name", width: 50 },
      { header: "Task Count", key: "task_count", width: 25 },
      { header: "Projects Count", key: "projects_count", width: 25 },
      { header: "Email", key: "email", width: 40 },
    ];

    sheet.getCell("A1").value = req.user?.team_name;
    sheet.mergeCells("A1:D1");
    sheet.getCell("A1").alignment = { horizontal: "center" };

    sheet.getCell("A2").value = `Exported on (${exportDate})`;
    sheet.getCell("A2").alignment = { horizontal: "center" };

    sheet.getCell("A3").value = `From ${start || "-"} to ${end || "-"}`;

    sheet.getRow(5).values = [
      "Name",
      "Task Count",
      "Projects Count",
      "Email"
    ];

    for (const item of teamMembers.data) {
      const data = {
        name: item.name,
        task_count: item.task_count,
        projects_count: item.projects_count,
        email: item.email
      };
      sheet.addRow(data);
    }

    sheet.getCell("A1").style.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "D9D9D9" }
    };
    sheet.getCell("A1").font = {
      size: 16
    };

    sheet.getCell("A2").style.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "F2F2F2" }
    };
    sheet.getCell("A2").font = {
      size: 12
    };

    sheet.getRow(5).font = {
      bold: true
    };

    res.setHeader("Content-Type", "application/vnd.openxmlformats");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}.xlsx`);

    await workbook.xlsx.write(res)
      .then(() => {
        res.end();
      });
  }

  @HandleExceptions()
  public static async exportByMember(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<void> {
    const exportDate = moment().format("MMM-DD-YYYY");
    const fileName = `Team Members - ${exportDate}`;
    const title = "";

    const workbook = new Excel.Workbook();

    workbook.addWorksheet(title);

    res.setHeader("Content-Type", "application/vnd.openxmlformats");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}.xlsx`);

    await workbook.xlsx.write(res)
      .then(() => {
        res.end();
      });
  }

  @HandleExceptions()
  public static async toggleMemberActiveStatus(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    if (!req.user?.team_id) return res.status(200).send(new ServerResponse(false, "Required fields are missing."));

    // check subscription status
    const subscriptionData = await checkTeamSubscriptionStatus(req.user?.team_id);
    if (statusExclude.includes(subscriptionData.subscription_status)) {
      return res.status(200).send(new ServerResponse(false, "Please check your subscription status."));
    }

    let data: any;

    if (req.query.active === "true") {
      const q1 = `SELECT active FROM team_members WHERE  id = $1;`;
      const result1 = await db.query(q1, [req.params?.id]);
      const [status] = result1.rows;

      // Check if reactivating an inactive member would exceed limits
      if (!status.active) {
        const currentCount = parseInt(subscriptionData.current_count) || 0;
        
        // Check Business plan limits first - Business plans override AppSumo lifetime limits
        if (!subscriptionData.is_credit && !subscriptionData.is_custom && subscriptionData.subscription_status === "active") {
          const effectiveUserLimit = subscriptionData.effective_user_limit || subscriptionData.quantity || 25;
          if (currentCount + 1 > effectiveUserLimit) {
            const requiredSeats = (currentCount + 1) - effectiveUserLimit;
            const obj = {
              seats_enough: false,
              required_count: requiredSeats,
              current_seat_amount: effectiveUserLimit
            };
            return res.status(200).send(new ServerResponse(false, obj, "Insufficient seats available. Please upgrade your subscription to reactivate this member."));
          }
        }
        
        // Check AppSumo lifetime deal limit - only applies if not on Business plan
        if (
          subscriptionData.is_ltd
          && subscriptionData.ltd_users
          && subscriptionData.subscription_type !== 'ANNUAL_BUSINESS'
          && (currentCount + 1 > parseInt(subscriptionData.ltd_users))
        ) {
          return res.status(200).send(new ServerResponse(false, null, "Cannot exceed the maximum number of life time users."));
        }

        // Check trial user team member limit
        if (subscriptionData.subscription_status === "trialing") {
          if (currentCount + 1 > TRIAL_MEMBER_LIMIT) {
            return res.status(200).send(new ServerResponse(false, null, `Trial users cannot exceed ${TRIAL_MEMBER_LIMIT} team members. Please upgrade to add more members.`));
          }
        }
      }

      if (status.active) {
        const updateQ1 = `UPDATE users
              SET active_team = (SELECT id FROM teams WHERE user_id = users.id ORDER BY created_at DESC LIMIT 1)
              WHERE id = (SELECT user_id FROM team_members WHERE id = $1 AND active IS TRUE LIMIT 1);`;
        await db.query(updateQ1, [req.params?.id]);
      }

      const q = `UPDATE team_members SET active = NOT active WHERE id = $1 RETURNING active;`;
      const result = await db.query(q, [req.params?.id]);
      data = result.rows[0];

      // const userExists = await this.checkIfUserActiveInOtherTeams(req.user?.owner_id as string, req.query?.email as string);

      // if (subscriptionData.status === "trialing") break;
      // if (!userExists && !subscriptionData.is_credit && !subscriptionData.is_custom) {
      //   if (subscriptionData.subscription_status === "active" && subscriptionData.quantity > 0) {
      //     const operator = req.query.active === "true" ? - 1 : + 1;
      //     const response = await updateUsers(subscriptionData.subscription_id, subscriptionData.quantity + operator);
      //     if (!response.body.subscription_id) return res.status(200).send(new ServerResponse(false, response.message || "Please check your subscription."));
      //   }
      // }
    } else {

      const userExists = await this.checkIfUserActiveInOtherTeams(req.user?.owner_id as string, req.query?.email as string);

      // if (subscriptionData.status === "trialing") break;
      // if (!userExists && !subscriptionData.is_credit && !subscriptionData.is_custom) {
      //   if (subscriptionData.subscription_status === "active" && subscriptionData.quantity > 0) {
      //     const operator = req.query.active === "true" ? - 1 : + 1;
      //     const response = await updateUsers(subscriptionData.subscription_id, subscriptionData.quantity + operator);
      //     if (!response.body.subscription_id) return res.status(200).send(new ServerResponse(false, response.message || "Please check your subscription."));
      //   }
      // }

      const q1 = `SELECT active FROM team_members WHERE  id = $1;`;
      const result1 = await db.query(q1, [req.params?.id]);
      const [status] = result1.rows;

      if (status.active) {
        const updateQ1 = `UPDATE users
              SET active_team = (SELECT id FROM teams WHERE user_id = users.id ORDER BY created_at DESC LIMIT 1)
              WHERE id = (SELECT user_id FROM team_members WHERE id = $1 AND active IS TRUE LIMIT 1);`;
        await db.query(updateQ1, [req.params?.id]);
      }

      const q = `UPDATE team_members SET active = NOT active WHERE id = $1 RETURNING active;`;
      const result = await db.query(q, [req.params?.id]);
      data = result.rows[0];
    }

    return res.status(200).send(new ServerResponse(true, [], `Team member ${data.active ? " activated" : " deactivated"} successfully.`));
  }

  @HandleExceptions({
    raisedExceptions: {
      "ERROR_EMAIL_INVITATION_EXISTS": `Team member with email "{0}" already exists.`
    }
  })
  public static async addTeamMember(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    req.body.team_id = req.params?.id || null;

    if (!req.body.team_id || !req.user?.id) return res.status(200).send(new ServerResponse(false, "Required fields are missing."));

    // check the subscription status
    const subscriptionData = await checkTeamSubscriptionStatus(req.body.team_id);

    if (statusExclude.includes(subscriptionData.subscription_status)) {
      return res.status(200).send(new ServerResponse(false, "Please check your subscription status."));
    }

    /**
   * Checks trial user team member limit
   */
    if (subscriptionData.subscription_status === "trialing") {
      const currentTrialMembers = parseInt(subscriptionData.current_count) || 0;
      const emailsToAdd = req.body.emails?.length || 1;

      if (currentTrialMembers + emailsToAdd > TRIAL_MEMBER_LIMIT) {
        return res.status(200).send(new ServerResponse(false, null, `Trial users cannot exceed ${TRIAL_MEMBER_LIMIT} team members. Please upgrade to add more members.`));
      }
    }

    // if (subscriptionData.status === "trialing") break;
    if (!subscriptionData.is_credit && !subscriptionData.is_custom) {
      if (subscriptionData.subscription_status === "active") {
        const response = await updateUsers(subscriptionData.subscription_id, subscriptionData.quantity + (req.body.emails.length || 1));
        if (!response.body.subscription_id) return res.status(200).send(new ServerResponse(false, response.message || "Please check your subscription."));
      }
    }

    const newMembers = await this.createOrInviteMembers(req.body, req.user);
    return res.status(200).send(new ServerResponse(true, newMembers, `Your teammates will get an email that gives them access to your team.`).withTitle("Invitations sent"));
  }

  // Team Invitation Links Methods

  @HandleExceptions()
  public static async generateTeamInvitationLink(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { job_title_id, role_name = 'MEMBER', is_admin = false, max_usage = null } = req.body;
    const teamId = req.user?.team_id;
    const userId = req.user?.id;

    if (!teamId || !userId) {
      return res.status(200).send(new ServerResponse(false, null, "Required fields are missing."));
    }

    // Check subscription status
    const subscriptionData = await checkTeamSubscriptionStatus(teamId);

    // Handle self-hosted subscriptions - allow link generation
    if (subscriptionData.subscription_type === 'SELF_HOSTED') {
      // Self-hosted can generate links without restrictions
    } else {
      // Check if subscription status is valid
      if (statusExclude.includes(subscriptionData.subscription_status)) {
        return res.status(200).send(new ServerResponse(false, null, "Unable to generate invitation link! Please check your subscription status."));
      }

      // Check trial user limit - warn if close to limit
      if (subscriptionData.subscription_status === "trialing") {
        const currentTrialMembers = parseInt(subscriptionData.current_count) || 0;
        if (currentTrialMembers >= TRIAL_MEMBER_LIMIT) {
          return res.status(200).send(new ServerResponse(false, null, `Trial users cannot exceed ${TRIAL_MEMBER_LIMIT} team members. Please upgrade to add more members.`));
        }
      }

      // Check seat availability for active subscriptions
      if (!subscriptionData.is_credit && !subscriptionData.is_custom && subscriptionData.subscription_status === "active") {
        const currentCount = parseInt(subscriptionData.current_count) || 0;
        if (currentCount >= subscriptionData.quantity) {
          const requiredSeats = 1; // At least 1 more seat needed
          const obj = {
            seats_enough: false,
            required_count: requiredSeats,
            current_seat_amount: subscriptionData.quantity
          };
          return res.status(200).send(new ServerResponse(false, obj, "Insufficient seats available. Please upgrade your subscription before generating invitation links."));
        }
      }

      // Check LTD user limits
      if (subscriptionData.is_ltd && subscriptionData.current_count) {
        const currentCount = parseInt(subscriptionData.current_count) || 0;
        const ltdLimit = parseInt(subscriptionData.ltd_users) || 0;
        if (currentCount >= ltdLimit) {
          return res.status(200).send(new ServerResponse(false, null, "Cannot exceed the maximum number of lifetime users."));
        }
      }
    }

    try {
      // Check if an active link already exists
      const checkQuery = `
        SELECT id, token, expires_at, created_at, status
        FROM team_invitation_links
        WHERE team_id = $1 AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
      `;
      const checkResult = await db.query(checkQuery, [teamId]);

      let invitationLink;
      let message = "Team invitation link generated successfully";

      if (checkResult.rows.length > 0) {
        // Active link exists, return it
        invitationLink = checkResult.rows[0];
        message = "Active invitation link already exists";
      } else {
        // Check if there's an inactive link we can reactivate
        const inactiveQuery = `
          SELECT id, token, expires_at, created_at, status
          FROM team_invitation_links
          WHERE team_id = $1 AND status != 'active'
          ORDER BY created_at DESC
          LIMIT 1
        `;
        const inactiveResult = await db.query(inactiveQuery, [teamId]);

        // Generate a secure token
        const token = crypto.randomBytes(32).toString('hex');

        // Set expiration to 7 days from now
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        if (inactiveResult.rows.length > 0) {
          // Update existing inactive link
          const updateQuery = `
            UPDATE team_invitation_links 
            SET token = $2, created_by = $3, expires_at = $4, job_title_id = $5,
                role_name = $6, is_admin = $7, max_usage = $8, status = 'active',
                usage_count = 0, updated_at = NOW()
            WHERE id = $1
            RETURNING id, token, expires_at, created_at
          `;

          const result = await db.query(updateQuery, [
            inactiveResult.rows[0].id, token, userId, expiresAt, job_title_id,
            role_name, is_admin, max_usage
          ]);

          invitationLink = result.rows[0];
          message = "Team invitation link generated successfully";
        } else {
          // Create new invitation link
          const insertQuery = `
            INSERT INTO team_invitation_links (
              team_id, token, created_by, expires_at, job_title_id, 
              role_name, is_admin, max_usage
            ) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id, token, expires_at, created_at
          `;

          const result = await db.query(insertQuery, [
            teamId, token, userId, expiresAt, job_title_id,
            role_name, is_admin, max_usage
          ]);

          invitationLink = result.rows[0];
        }
      }

      // Generate the full invitation URL
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
      const invitationUrl = `${baseUrl}/invite/team/${invitationLink.token}`;

      return res.status(200).send(new ServerResponse(true, {
        ...invitationLink,
        invitation_url: invitationUrl,
        expires_in_days: 7
      }, message));

    } catch (error) {
      console.error('Error generating team invitation link:', error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to generate invitation link. Please try again."));
    }
  }

  @HandleExceptions()
  public static async validateTeamInvitationLink(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { token } = req.params;

    if (!token) {
      return res.status(200).send(new ServerResponse(false, null, "Invalid invitation link."));
    }

    try {
      const q = `SELECT * FROM validate_invitation_link($1, 'team')`;
      const result = await db.query(q, [token]);
      const [validation] = result.rows;

      if (!validation.is_valid) {
        return res.status(200).send(new ServerResponse(false, null, validation.error_message));
      }

      // Get team information
      const teamQuery = `
        SELECT t.id, t.name, u.name as owner_name
        FROM teams t
        JOIN users u ON t.user_id = u.id
        WHERE t.id = $1
      `;
      const teamResult = await db.query(teamQuery, [validation.team_id]);
      const [team] = teamResult.rows;

      return res.status(200).send(new ServerResponse(true, {
        team,
        invitation: {
          expires_at: validation.expires_at,
          job_title_id: validation.job_title_id,
          role_name: validation.role_name,
          is_admin: validation.is_admin
        }
      }));

    } catch (error) {
      console.error('Error validating team invitation link:', error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to validate invitation link."));
    }
  }

  @HandleExceptions()
  public static async acceptTeamInvitationByLink(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { token } = req.params;
    const { name, email } = req.body;
    const userId = req.user?.id;

    if (!token || !name || !email) {
      return res.status(200).send(new ServerResponse(false, null, "Required fields are missing."));
    }

    try {
      // Validate the invitation link
      const validationQuery = `SELECT * FROM validate_invitation_link($1, 'team')`;
      const validationResult = await db.query(validationQuery, [token]);
      const [validation] = validationResult.rows;

      if (!validation.is_valid) {
        return res.status(200).send(new ServerResponse(false, null, validation.error_message));
      }

      const teamId = validation.team_id;

      // Get team owner ID for checking user existence
      const ownerQuery = `
        SELECT u.id, u.name, t.name as team_name, t.user_id as owner_id
        FROM teams t
        JOIN users u ON t.user_id = u.id
        WHERE t.id = $1
      `;
      const ownerResult = await db.query(ownerQuery, [teamId]);
      const [owner] = ownerResult.rows;

      // Check if user already exists in any team owned by this owner
      const userExists = await this.checkIfUserAlreadyExists(owner.owner_id, email);
      const isUserActive = await this.checkIfUserActiveInOtherTeams(owner.owner_id, email);

      // Determine if this will increment the user count
      let incrementBy = 0;
      if (!userExists || !isUserActive) {
        incrementBy = 1;
      }

      // Check subscription status for the target team
      const subscriptionData = await checkTeamSubscriptionStatus(teamId);

      // Handle self-hosted subscriptions
      if (subscriptionData.subscription_type === 'SELF_HOSTED') {
        // Self-hosted can accept invitations without restrictions
      } else {
        // Check if subscription status is valid
        if (statusExclude.includes(subscriptionData.subscription_status)) {
          return res.status(200).send(new ServerResponse(false, null, "Unable to join team! Please check team subscription status."));
        }

        // Check seat availability for active subscriptions (Business plans override LTD limits)
        if (!subscriptionData.is_credit && !subscriptionData.is_custom && subscriptionData.subscription_status === "active") {
          const updatedCount = parseInt(subscriptionData.current_count) + incrementBy;
          const effectiveUserLimit = subscriptionData.effective_user_limit || subscriptionData.quantity || 25;
          const requiredSeats = updatedCount - effectiveUserLimit;
          if (updatedCount > effectiveUserLimit) {
            const obj = {
              seats_enough: false,
              required_count: requiredSeats,
              current_seat_amount: effectiveUserLimit
            };
            return res.status(200).send(new ServerResponse(false, obj, `Insufficient seats available. The team needs ${requiredSeats} more seat${requiredSeats > 1 ? 's' : ''} to add you. Please ask the team owner to upgrade.`));
          }
        }

        // Check LTD user limits - only applies if not on Business plan
        if (incrementBy > 0 && subscriptionData.is_ltd && subscriptionData.current_count && subscriptionData.subscription_type !== 'ANNUAL_BUSINESS') {
          const currentCount = parseInt(subscriptionData.current_count) || 0;
          const ltdLimit = parseInt(subscriptionData.ltd_users) || 0;
          if (currentCount + incrementBy > ltdLimit) {
            return res.status(200).send(new ServerResponse(false, null, "Cannot exceed the maximum number of lifetime users. Please ask the team owner to upgrade."));
          }
        }

        // Check trial member limit
        if (subscriptionData.subscription_status === "trialing") {
          const currentTrialMembers = parseInt(subscriptionData.current_count) || 0;
          if (currentTrialMembers + incrementBy > TRIAL_MEMBER_LIMIT) {
            return res.status(200).send(new ServerResponse(false, null, `Trial teams cannot exceed ${TRIAL_MEMBER_LIMIT} team members. Please ask the team owner to upgrade.`));
          }
        }
      }

      // Check if user already exists in the team
      if (userId) {
        const existingMemberQuery = `
          SELECT id FROM team_members 
          WHERE user_id = $1 AND team_id = $2
        `;
        const existingResult = await db.query(existingMemberQuery, [userId, teamId]);
        if (existingResult.rows.length > 0) {

          // Set the joined team as active for the user
          if (userId) {
            const setActiveTeamQuery = `SELECT set_active_team($1, $2)`;
            await db.query(setActiveTeamQuery, [userId, teamId]);
          }
          return res.status(200).send(new ServerResponse(false, null, "You are already a member of this team."));
        }
      }

      // Check if email already exists in the team
      const emailExistsQuery = `
        SELECT EXISTS(
          SELECT 1 FROM team_member_info_view 
          WHERE email = $1 AND team_id = $2
        )
      `;
      const emailResult = await db.query(emailExistsQuery, [email, teamId]);
      const [emailExists] = emailResult.rows;

      if (emailExists.exists) {
        // Set the joined team as active for the user
        if (userId) {
          const setActiveTeamQuery = `SELECT set_active_team($1, $2)`;
          await db.query(setActiveTeamQuery, [userId, teamId]);
        }
        return res.status(200).send(new ServerResponse(false, null, "A team member with this email already exists."));
      }

      // Create team member using the existing function
      const memberData = {
        team_id: teamId,
        emails: [email],
        names: [name],
        job_title_id: validation.job_title_id,
        role_name: validation.role_name,
        is_admin: validation.is_admin,
        user_id: userId // If user is logged in
      };

      const mockUser: IPassportSession = {
        id: owner.id,
        name: owner.name,
        team_id: teamId,
        team_name: owner.team_name,
        owner_id: owner.owner_id
      } as IPassportSession;

      const newMembers = await this.createOrInviteMembers(memberData, mockUser);

      // Record the invitation link usage
      if (newMembers && newMembers.length > 0) {
        const member = newMembers[0];
        const usageQuery = `
          INSERT INTO invitation_link_usage (
            team_invitation_link_id, user_id, team_member_id, 
            email, name, ip_address, user_agent
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;

        const ipAddress = req.ip || req.connection?.remoteAddress;
        const userAgent = req.get('User-Agent');

        await db.query(usageQuery, [
          validation.link_id, userId, member.team_member_id,
          email, name, ipAddress, userAgent
        ]);

        // Set the joined team as active for the user
        if (userId) {
          const setActiveTeamQuery = `SELECT set_active_team($1, $2)`;
          await db.query(setActiveTeamQuery, [userId, teamId]);
        }
      }

      return res.status(200).send(new ServerResponse(true, newMembers, "Successfully joined the team!"));

    } catch (error) {
      console.error('Error accepting team invitation:', error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to join team. Please try again."));
    }
  }

  @HandleExceptions()
  public static async revokeTeamInvitationLink(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;

    if (!teamId || !userId) {
      return res.status(200).send(new ServerResponse(false, null, "Required fields are missing."));
    }

    try {
      const q = `
        UPDATE team_invitation_links 
        SET status = 'revoked', updated_at = NOW()
        WHERE team_id = $1 AND status = 'active'
        RETURNING id
      `;

      const result = await db.query(q, [teamId]);

      if (result.rows.length === 0) {
        return res.status(200).send(new ServerResponse(false, null, "No active invitation link found."));
      }

      return res.status(200).send(new ServerResponse(true, null, "Invitation link has been deactivated."));

    } catch (error) {
      console.error('Error revoking team invitation link:', error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to deactivate invitation link."));
    }
  }

  @HandleExceptions()
  public static async getTeamInvitationLinkStatus(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;

    if (!teamId) {
      return res.status(200).send(new ServerResponse(false, null, "Required fields are missing."));
    }

    try {
      const q = `
        SELECT id, token, expires_at, status, usage_count, max_usage, created_at
        FROM team_invitation_links
        WHERE team_id = $1 AND status = 'active'
        ORDER BY created_at DESC
        LIMIT 1
      `;

      const result = await db.query(q, [teamId]);

      if (result.rows.length === 0) {
        return res.status(200).send(new ServerResponse(true, { has_active_link: false }));
      }

      const [link] = result.rows;
      const baseUrl = process.env.FRONTEND_URL || 'http://localhost:4200';
      const invitationUrl = `${baseUrl}/invite/team/${link.token}`;

      return res.status(200).send(new ServerResponse(true, {
        has_active_link: true,
        invitation_url: invitationUrl,
        expires_at: link.expires_at,
        usage_count: link.usage_count,
        max_usage: link.max_usage,
        created_at: link.created_at
      }));

    } catch (error) {
      console.error('Error getting team invitation link status:', error);
      return res.status(200).send(new ServerResponse(false, null, "Failed to get invitation link status."));
    }
  }
}

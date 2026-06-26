import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import {
  getColor,
  log_error,
  sanitizePlainText,
} from "../shared/utils";
import { getActiveTeamMemberCount } from "../shared/licensing-utils";
import { statusExclude } from "../shared/constants";
import business from "../business";
import { NotificationsService } from "../services/notifications/notifications.service";
import { SocketEvents } from "../socket.io/events";
import { IO } from "../shared/io";

export default class AdminCenterController extends WorklenzControllerBase {
  private static readonly TEAM_DELETE_BLOCKERS = {
    ACTIVE_TEAM: {
      title: "Unable to delete team",
      message:
        "This team cannot be deleted because one or more users still have it selected as their active team. Please switch those users to another team and try again.",
    },
    PROJECT_FOLDERS: {
      title: "Unable to delete team",
      message:
        "This team cannot be deleted because it still has project folders associated with it. Please remove those folders and try again.",
    },
  } as const;

  private static async checkIfUserActiveInOtherTeams(
    owner_id: string,
    email: string
  ) {
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

  private static async getTeamDeleteBlocker(teamId: string) {
    const q = `SELECT EXISTS(
                 SELECT 1
                 FROM users
                 WHERE active_team = $1::UUID
               ) AS has_active_users,
               EXISTS(
                 SELECT 1
                 FROM project_folders
                 WHERE team_id = $1::UUID
               ) AS has_project_folders;`;
    const result = await db.query(q, [teamId]);
    const [data] = result.rows;

    if (data?.has_active_users) {
      return this.TEAM_DELETE_BLOCKERS.ACTIVE_TEAM;
    }

    if (data?.has_project_folders) {
      return this.TEAM_DELETE_BLOCKERS.PROJECT_FOLDERS;
    }

    return null;
  }

  // organization
  @HandleExceptions()
  public static async getOrganizationDetails(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = `SELECT organization_name                                      AS name,
                      contact_number,
                      contact_number_secondary,
                      (SELECT email FROM users WHERE id = organizations.user_id),
                      (SELECT name FROM users WHERE id = organizations.user_id) AS owner_name,
                      calculation_method,
                      hours_per_day,
                      logo_url
                  FROM organizations
                  WHERE user_id = $1;`;
    const result = await db.query(q, [req.user?.owner_id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async getAdminCenterSettings(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = `SELECT organization_name                                      AS name,
                      contact_number,
                      contact_number_secondary,
                      calculation_method,
                      hours_per_day,
                      (SELECT email FROM users WHERE id = organizations.user_id),
                      (SELECT name FROM users WHERE id = organizations.user_id) AS owner_name,
                      logo_url
                  FROM organizations
                  WHERE user_id = $1;`;
    const result = await db.query(q, [req.user?.owner_id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async getOrganizationAdmins(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = `SELECT u.name, email, owner AS is_owner
               FROM users u
                      LEFT JOIN team_members tm ON u.id = tm.user_id
                      LEFT JOIN roles r ON tm.role_id = r.id
               WHERE tm.team_id IN (SELECT id FROM teams WHERE teams.user_id = $1)
                 AND (admin_role IS TRUE OR owner IS TRUE)
               GROUP BY u.name, email, owner
               ORDER BY owner DESC, u.name;`;
    const result = await db.query(q, [req.user?.owner_id]);

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getOrganizationUsers(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    // owner_id is $1, size is $2, offset is $3, so search params start at $4
    const { searchQuery, searchParams, size, offset } = this.toPaginationOptions(req.query, [
      "outer_tmiv.name",
      "outer_tmiv.email",
    ], false, 4);

    const q = `SELECT ROW_TO_JSON(rec) AS users
            FROM (SELECT COUNT(*) AS total,
                        (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
                          FROM (SELECT email,
                                      STRING_AGG(DISTINCT CAST(user_id AS VARCHAR), ', ') AS user_id,
                                      STRING_AGG(DISTINCT name, ', ') AS name,
                                      STRING_AGG(DISTINCT avatar_url, ', ') AS avatar_url,
                                      (SELECT GREATEST(
                                        (SELECT twl.created_at
                                          FROM task_work_log twl
                                          WHERE twl.user_id IN (SELECT tmiv.user_id
                                                                FROM team_member_info_view tmiv
                                                                WHERE tmiv.email = outer_tmiv.email)
                                          ORDER BY created_at DESC
                                          LIMIT 1),
                                        (SELECT tal.created_at
                                          FROM task_activity_logs tal
                                          WHERE tal.user_id IN (SELECT tmiv.user_id
                                                                FROM team_member_info_view tmiv
                                                                WHERE tmiv.email = outer_tmiv.email)
                                          ORDER BY created_at DESC
                                          LIMIT 1)
                                      )) AS last_logged
                                FROM team_member_info_view outer_tmiv
                                WHERE outer_tmiv.team_id IN (SELECT id
                                                            FROM teams
                                                            WHERE teams.user_id = $1) ${searchQuery}
                                GROUP BY email
                                ORDER BY email LIMIT $2 OFFSET $3) t) AS data
                  FROM (SELECT DISTINCT email
                        FROM team_member_info_view outer_tmiv
                        WHERE outer_tmiv.team_id IN
                              (SELECT id
                              FROM teams
                              WHERE teams.user_id = $1) ${searchQuery}) AS total) rec;`;
    const result = await db.query(q, [req.user?.owner_id, size, offset, ...searchParams]);
    const [data] = result.rows;

    return res.status(200).send(new ServerResponse(true, data.users));
  }

  @HandleExceptions()
  public static async updateOrganizationName(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { name } = req.body;
    const q = `UPDATE organizations
               SET organization_name = $1
               WHERE user_id = $2;`;
    const result = await db.query(q, [name, req.user?.owner_id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async updateOwnerContactNumber(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { contact_number } = req.body;
    const q = `UPDATE organizations
               SET contact_number = $1
               WHERE user_id = $2;`;
    const result = await db.query(q, [contact_number, req.user?.owner_id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async updateOrganizationCalculationMethod(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { calculation_method, hours_per_day } = req.body;

    // Validate calculation method
    if (!["hourly", "man_days"].includes(calculation_method)) {
      return res
        .status(400)
        .send(
          new ServerResponse(
            false,
            null,
            "Invalid calculation method. Must be \"hourly\" or \"man_days\""
          )
        );
    }

    const updateQuery = `
      UPDATE organizations 
      SET calculation_method = $1, 
          hours_per_day = COALESCE($2, hours_per_day),
          updated_at = NOW()
      WHERE user_id = $3
      RETURNING id, organization_name, calculation_method, hours_per_day;
    `;

    const result = await db.query(updateQuery, [
      calculation_method,
      hours_per_day,
      req.user?.owner_id,
    ]);

    if (result.rows.length === 0) {
      return res
        .status(404)
        .send(new ServerResponse(false, null, "Organization not found"));
    }

    return res.status(200).send(
      new ServerResponse(true, {
        organization: result.rows[0],
        message: "Organization calculation method updated successfully",
      })
    );
  }

  @HandleExceptions()
  public static async getOrganizationTeams(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    // owner_id is $1, size is $2, offset is $3, team_id is $4, so search params start at $5
    const { searchQuery, searchParams, size, offset } = this.toPaginationOptions(req.query, [
      "name",
    ], false, 5);

    let size_changed = size;

    if (offset == 0) size_changed = size_changed - 1;

    const currentTeamClosure =
      offset == 0
        ? `,
                          (SELECT COALESCE(ROW_TO_JSON(c), '{}'::JSON)
                            FROM (SELECT id,
                                          name,
                                          created_at,
                                          (SELECT count(*) FROM team_members WHERE team_id = teams.id) as members_count,
                                          (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                                          FROM (SELECT CASE
                                                          WHEN u.name IS NOT NULL THEN u.name
                                                          ELSE (SELECT name
                                                                FROM email_invitations
                                                                WHERE team_member_id = team_members.id) END,
                                                        avatar_url
                                                FROM team_members
                                                        LEFT JOIN users u on team_members.user_id = u.id
                                                WHERE team_id = teams.id) rec)                        AS team_members
                                  FROM teams
                                  WHERE user_id = $1 AND teams.id = $4) c) AS current_team_data`
        : ``;

    const q = `SELECT ROW_TO_JSON(rec) AS teams
               FROM (SELECT COUNT(*)                      AS total,
                            (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
                             FROM (SELECT id,
                                          name,
                                          created_at,
                                          (SELECT count(*) FROM team_members WHERE team_id = teams.id) as members_count,
                                          (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                                           FROM (SELECT CASE
                                                          WHEN u.name IS NOT NULL THEN u.name
                                                          ELSE (SELECT name
                                                                FROM email_invitations
                                                                WHERE team_member_id = team_members.id) END,
                                                        avatar_url
                                                 FROM team_members
                                                        LEFT JOIN users u on team_members.user_id = u.id
                                                 WHERE team_id = teams.id) rec)                        AS team_members
                                   FROM teams
                                   WHERE user_id = $1 AND NOT teams.id = $4 ${searchQuery}
                                   ORDER BY name, created_at
                                   LIMIT $2 OFFSET $3) t) AS data
                                   ${currentTeamClosure}
                     FROM teams
                     WHERE user_id = $1 ${searchQuery}) rec;`;
    const result = await db.query(q, [
      req.user?.owner_id,
      size_changed,
      offset,
      req.user?.team_id,
      ...searchParams,
    ]);

    const [obj] = result.rows;

    for (const team of obj.teams?.data || []) {
      team.names = this.createTagList(team?.team_members);
      team.names.map((a: any) => (a.color_code = getColor(a.name)));
    }

    if (obj.teams.current_team_data) {
      obj.teams.current_team_data.names = this.createTagList(
        obj.teams.current_team_data?.team_members
      );
      obj.teams.current_team_data.names.map(
        (a: any) => (a.color_code = getColor(a.name))
      );
    }

    return res.status(200).send(new ServerResponse(true, obj.teams || {}));
  }

  @HandleExceptions()
  public static async getTeamDetails(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { id } = req.params;

    const q = `SELECT id,
                      name,
                      created_at,
                      (SELECT count(*) FROM team_members WHERE team_id = teams.id) as members_count,
                      (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                       FROM (SELECT tm.id,
                                    tm.user_id,
                                    (SELECT name
                                     FROM team_member_info_view
                                     WHERE team_member_info_view.team_member_id = tm.id),
                                    (SELECT team_member_info_view.email
                                     FROM team_member_info_view
                                     WHERE team_member_info_view.team_member_id = tm.id),
                                    (SELECT team_member_info_view.avatar_url
                                     FROM team_member_info_view
                                     WHERE team_member_info_view.team_member_id = tm.id),
                                    role_id,
                                    r.name AS role_name,
                                    EXISTS(SELECT email
                                           FROM email_invitations
                                           WHERE team_member_id = tm.id
                                             AND email_invitations.team_id = tm.team_id) AS pending_invitation
                             FROM team_members tm
                                    LEFT JOIN users u on tm.user_id = u.id
                                    LEFT JOIN roles r on tm.role_id = r.id
                             WHERE tm.team_id = teams.id
                             ORDER BY r.name = 'Owner' DESC, u.name) rec)          AS team_members
               FROM teams
               WHERE id = $1;`;
    const result = await db.query(q, [id]);

    const [obj] = result.rows;

    obj.names = this.createTagList(obj?.team_members);
    obj.names.map((a: any) => (a.color_code = getColor(a.name)));

    return res.status(200).send(new ServerResponse(true, obj || {}));
  }

   @HandleExceptions()
  public static async updateTeam(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const { name, teamMembers } = req.body;
 
    try {
      // 1. Update team name
      const updateNameQuery = `UPDATE teams SET name = $1 WHERE id = $2 RETURNING id;`;
      const nameResult = await db.query(updateNameQuery, [name, id]);
 
      if (!nameResult.rows.length) {
        return res
          .status(404)
          .send(new ServerResponse(false, null, "Team not found"));
      }
 
      // 2. Update team member roles and names
      if (teamMembers?.length) {
        await Promise.all(
          teamMembers.map(async (member: {
            id: string;
            role_name: string;
            user_id: string | null;
            name: string;
            pending_invitation?: boolean;
          }) => {
 
            // Always resolve user_id fresh from the DB using the team_member id.
            // Never trust the client-supplied user_id — it may be null or stale
            // because getTeamDetails selects tm.user_id which can be null for
            // pending members whose row exists only in email_invitations.
            const resolveQ = `
              SELECT tm.user_id
              FROM team_members tm
              WHERE tm.id = $1
                AND tm.team_id = $2;
            `;
            const resolveResult = await db.query(resolveQ, [member.id, id]);
 
            if (!resolveResult.rows.length) return; // not in this team — skip
 
            // eslint-disable-next-line prefer-destructuring
            const { user_id } = resolveResult.rows[0];
 
            // 2a. Update role (skip Owner — their role must never change here)
            if (member.role_name && member.role_name !== "Owner") {
              await db.query(
                `UPDATE team_members
                 SET role_id = (
                   SELECT id FROM roles
                   WHERE roles.team_id = $1
                     AND name = $2
                 )
                 WHERE id = $3
                   AND team_id = $1;`,
                [id, member.role_name, member.id]
              );
            }
 
            // 2b. Update name — mirrors COALESCE(u.name, email_invitations.name)
            //     that team_member_info_view uses, so the GET after save returns
            //     the correct updated name immediately.
            if (member.name?.trim()) {
              const trimmedName = member.name.trim();
 
              if (user_id) {
                // Active member — users.name is the COALESCE first branch
                await db.query(
                  `UPDATE users SET name = $1 WHERE id = $2;`,
                  [trimmedName, user_id]
                );
              } else {
                // Pending invitation — email_invitations.name is the fallback branch
                await db.query(
                  `UPDATE email_invitations
                   SET name = $1
                   WHERE team_member_id = $2
                     AND team_id = $3;`,
                  [trimmedName, member.id, id]
                );
              }
            }
          })
        );
      }
 
      return res
        .status(200)
        .send(new ServerResponse(true, null, "Team updated successfully"));
    } catch (error) {
      log_error(error);
      return res
        .status(500)
        .send(new ServerResponse(false, null, "Failed to update team"));
    }
  }
 
  @HandleExceptions()
  public static async deleteTeam(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const ownerId = req.user?.owner_id;

    if (!ownerId) {
      return res
        .status(200)
        .send(new ServerResponse(false, null, "User not found").withTitle("Unable to delete team"));
    }

    if (id == req.user?.team_id) {
      return res
        .status(200)
        .send(
          new ServerResponse(
            true,
            [],
            "Please switch to another team before attempting deletion."
          ).withTitle("Unable to remove the presently active team!")
        );
    }

    const blocker = await this.getTeamDeleteBlocker(id);
    if (blocker) {
      return res
        .status(200)
        .send(new ServerResponse(false, null, blocker.message).withTitle(blocker.title));
    }

    const q = `DELETE FROM teams
               WHERE id = $1
                 AND user_id = $2
               RETURNING id;`;
    const result = await db.query(q, [id, ownerId]);

    if (!result.rowCount) {
      return res
        .status(200)
        .send(new ServerResponse(false, null, "Team not found").withTitle("Unable to delete team"));
    }

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async deleteById(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const { teamId } = req.body;

    if (!id || !teamId)
      return res
        .status(200)
        .send(new ServerResponse(false, "Required fields are missing."));

    // check subscription status
    const subscriptionData = await business.featureGate.getTeamSubscription(teamId);
    if (statusExclude.includes(subscriptionData.subscription_status)) {
      return res
        .status(200)
        .send(
          new ServerResponse(false, "Please check your subscription status.")
        );
    }

    const q = `SELECT remove_team_member($1, $2, $3) AS member;`;
    const result = await db.query(q, [id, req.user?.id, teamId]);
    const [data] = result.rows;

    const safeName = sanitizePlainText(req.user?.name || 'an administrator');
    const safeTeamName = sanitizePlainText(req.user?.team_name || 'the team');
    const message = `You have been removed from <b>${safeTeamName}</b> by <b>${safeName}</b>`;

    // if (subscriptionData.status === "trialing") break;
    if (!subscriptionData.is_credit && !subscriptionData.is_custom) {
      if (
        subscriptionData.subscription_status === "active" &&
        subscriptionData.quantity > 0
      ) {
        const obj = await getActiveTeamMemberCount(req.user?.owner_id ?? "");

        const userActiveInOtherTeams = await this.checkIfUserActiveInOtherTeams(
          req.user?.owner_id as string,
          req.query?.email as string
        );

        if (!userActiveInOtherTeams) {
          const response: any = await business.featureGate.syncSeatCount(
            subscriptionData.subscription_id,
            obj.user_count
          );
          if (!response.body.subscription_id)
            return res
              .status(200)
              .send(
                new ServerResponse(
                  false,
                  response.message || "Please check your subscription."
                )
              );
        }
      }
    }

    NotificationsService.sendNotification({
      receiver_socket_id: data.member.socket_id,
      message,
      team: data.member.team,
      team_id: teamId,
    });

    IO.emitByUserId(
      data.member.id,
      req.user?.id || null,
      SocketEvents.TEAM_MEMBER_REMOVED,
      {
        teamId: teamId,
        message,
      }
    );
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getOrganizationProjects(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    // For count query: owner_id is $1, search params start at $2
    const countSearchOptions = this.toPaginationOptions(req.query, ["p.name"], false, 2);
    
    // For data query: owner_id is $1, offset is $2, size is $3, search params start at $4
    const { searchQuery, searchParams, size, offset } = this.toPaginationOptions(req.query, [
      "p.name",
    ], false, 4);

    const countQ = `SELECT COUNT(*) AS total
        FROM projects p
        JOIN teams t ON p.team_id = t.id
        WHERE t.user_id = $1 ${countSearchOptions.searchQuery};`;
    const countResult = await db.query(countQ, [req.user?.owner_id, ...countSearchOptions.searchParams]);

    // Query to get the project data
    const dataQ = `SELECT p.id,
            p.name,
            t.name AS team_name,
            p.created_at,
            pm.member_count
        FROM projects p
        JOIN teams t ON p.team_id = t.id
        LEFT JOIN (
        SELECT project_id, COUNT(*) AS member_count
        FROM project_members
        GROUP BY project_id
        ) pm ON p.id = pm.project_id
        WHERE t.user_id = $1 ${searchQuery}
        ORDER BY p.name
        OFFSET $2 LIMIT $3;`;

    const result = await db.query(dataQ, [req.user?.owner_id, offset, size, ...searchParams]);

    const response = {
      total: countResult.rows[0]?.total ?? 0,
      data: result.rows ?? [],
    };

    return res.status(200).send(new ServerResponse(true, response));
  }

  @HandleExceptions()
  public static async getOrganizationHolidaySettings(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = `SELECT ohs.id, ohs.organization_id, ohs.country_code, ohs.state_code, 
                      ohs.auto_sync_holidays, ohs.created_at, ohs.updated_at
               FROM organization_holiday_settings ohs
               JOIN organizations o ON ohs.organization_id = o.id
               WHERE o.user_id = $1;`;

    const result = await db.query(q, [req.user?.owner_id]);

    // If no settings exist, return default settings
    if (result.rows.length === 0) {
      return res.status(200).send(
        new ServerResponse(true, {
          country_code: null,
          state_code: null,
          auto_sync_holidays: true,
        })
      );
    }

    return res.status(200).send(new ServerResponse(true, result.rows[0]));
  }

  @HandleExceptions()
  public static async updateOrganizationHolidaySettings(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { country_code, state_code, auto_sync_holidays } = req.body;

    // First, get the organization ID
    const orgQ = `SELECT id FROM organizations WHERE user_id = $1;`;
    const orgResult = await db.query(orgQ, [req.user?.owner_id]);

    if (orgResult.rows.length === 0) {
      return res
        .status(404)
        .send(new ServerResponse(false, "Organization not found"));
    }

    const organizationId = orgResult.rows[0].id;

    // Check if settings already exist
    const checkQ = `SELECT id FROM organization_holiday_settings WHERE organization_id = $1;`;
    const checkResult = await db.query(checkQ, [organizationId]);

    let result;
    if (checkResult.rows.length > 0) {
      // Update existing settings
      const updateQ = `UPDATE organization_holiday_settings 
                       SET country_code = $2, 
                           state_code = $3, 
                           auto_sync_holidays = $4,
                           updated_at = CURRENT_TIMESTAMP
                       WHERE organization_id = $1
                       RETURNING *;`;
      result = await db.query(updateQ, [
        organizationId,
        country_code,
        state_code,
        auto_sync_holidays,
      ]);
    } else {
      // Insert new settings
      const insertQ = `INSERT INTO organization_holiday_settings 
                       (organization_id, country_code, state_code, auto_sync_holidays)
                       VALUES ($1, $2, $3, $4)
                       RETURNING *;`;
      result = await db.query(insertQ, [
        organizationId,
        country_code,
        state_code,
        auto_sync_holidays,
      ]);
    }

    // If auto_sync_holidays is enabled and country is Sri Lanka, populate holidays
    if (auto_sync_holidays && country_code === "LK") {
      try {
        // Import the holiday data provider
        const {
          HolidayDataProvider,
        } = require("../services/holiday-data-provider");

        // Get current year and next year to ensure we have recent data
        const currentYear = new Date().getFullYear();
        const years = [currentYear, currentYear + 1];

        for (const year of years) {
          const sriLankanHolidays =
            await HolidayDataProvider.getSriLankanHolidays(year);

          for (const holiday of sriLankanHolidays) {
            const query = `
              INSERT INTO country_holidays (country_code, name, description, date, is_recurring)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (country_code, name, date) DO NOTHING
            `;

            await db.query(query, [
              "LK",
              holiday.name,
              holiday.description,
              holiday.date,
              holiday.is_recurring,
            ]);
          }
        }

      } catch (error) {
        // Log error but don't fail the settings update
        log_error(error);
      }
    }

    return res.status(200).send(new ServerResponse(true, result.rows[0]));
  }

  @HandleExceptions()
  public static async getCountriesWithStates(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    // Get all countries
    const countriesQ = `SELECT code, name FROM countries ORDER BY name;`;
    const countriesResult = await db.query(countriesQ);

    // For now, we'll return a basic structure
    // In a real implementation, you would have a states table
    const countriesWithStates = countriesResult.rows.map((country) => ({
      code: country.code,
      name: country.name,
      states: [] as Array<{ code: string; name: string }>, // Would be populated from a states table
    }));

    // Add some example states for US and Canada
    const usIndex = countriesWithStates.findIndex((c) => c.code === "US");
    if (usIndex !== -1) {
      countriesWithStates[usIndex].states = [
        { code: "CA", name: "California" },
        { code: "NY", name: "New York" },
        { code: "TX", name: "Texas" },
        { code: "FL", name: "Florida" },
        { code: "WA", name: "Washington" },
      ];
    }

    const caIndex = countriesWithStates.findIndex((c) => c.code === "CA");
    if (caIndex !== -1) {
      countriesWithStates[caIndex].states = [
        { code: "ON", name: "Ontario" },
        { code: "QC", name: "Quebec" },
        { code: "BC", name: "British Columbia" },
        { code: "AB", name: "Alberta" },
      ];
    }

    return res.status(200).send(new ServerResponse(true, countriesWithStates));
  }

}

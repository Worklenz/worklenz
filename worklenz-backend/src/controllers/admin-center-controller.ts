import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import {
  calculateMonthDays,
  getColor,
  log_error,
  megabytesToBytes,
  sanitizePlainText,
} from "../shared/utils";
import moment from "moment";
import { calculateStorage } from "../shared/s3";
import {
  checkTeamSubscriptionStatus,
  getActiveTeamMemberCount,
  getCurrentProjectsCount,
  getFreePlanSettings,
  getOwnerIdByTeam,
  getTeamMemberCount,
  getUsedStorage,
} from "../ee/shared/paddle-utils";
import { appSumoService } from "../shared/private-extensions";
import { PlanTrialService } from "../ee/services/plan-trial-service";
import {
  addModifier,
  cancelSubscription,
  changePlan,
  generatePayLinkRequest,
  pauseOrResumeSubscription,
  updateUsers,
} from "../ee/shared/paddle-requests";
import { statusExclude } from "../shared/constants";
import { NotificationsService } from "../services/notifications/notifications.service";
import { SocketEvents } from "../socket.io/events";
import { IO } from "../shared/io";
import { uploadBase64, getOrganizationLogoKey, deleteObject, getRootDir } from "../shared/storage";

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

  private static async getSubscriptionId(ownerId: string): Promise<string> {
    const q = `SELECT subscription_id FROM licensing_user_subscriptions WHERE user_id = $1;`;
    const result = await db.query(q, [ownerId]);
    return result.rows[0]?.subscription_id?.toString();
  }

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
  public static async uploadOrganizationLogo(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const ownerId = req.user?.owner_id;
    if (!ownerId) {
      return res.status(400).send(new ServerResponse(false, null, "User not found"));
    }

    // Get organization ID
    const orgQuery = `SELECT id FROM organizations WHERE user_id = $1`;
    const orgResult = await db.query(orgQuery, [ownerId]);
    if (orgResult.rows.length === 0) {
      return res.status(404).send(new ServerResponse(false, null, "Organization not found"));
    }
    const organizationId = orgResult.rows[0].id;

    const { logoData } = req.body;
    if (!logoData) {
      return res.status(400).send(new ServerResponse(false, null, "Logo data is required"));
    }

    // Extract file type from base64 data
    const mimeMatch = logoData.match(/^data:(image\/[a-z]+);base64,/);
    if (!mimeMatch) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid image format"));
    }

    const mimeType = mimeMatch[1];
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(mimeType)) {
      return res.status(400).send(new ServerResponse(false, null, "Only PNG, JPG, JPEG, and WEBP images are allowed"));
    }

    // Validate file size (assuming base64 data)
    const fileSizeBytes = Math.floor((logoData.length * 3) / 4);
    const maxSizeBytes = 5 * 1024 * 1024; // 5MB limit
    if (fileSizeBytes > maxSizeBytes) {
      return res.status(400).send(new ServerResponse(false, null, "Logo file size must be less than 5MB"));
    }

    const fileExtension = mimeType.split("/")[1];

    // Get old logo URL to delete it
    const oldLogoQuery = `SELECT logo_url FROM organizations WHERE id = $1`;
    const oldLogoResult = await db.query(oldLogoQuery, [organizationId]);
    const oldLogoUrl = oldLogoResult.rows[0]?.logo_url;

    // Delete old logo from S3 if exists
    if (oldLogoUrl) {
      try {
        // Extract the storage key from the old logo URL
        // Logo URLs are typically in format: {S3_URL}/{env}/organization-logos/{orgId}.{ext}
        const urlParts = oldLogoUrl.split("/organization-logos/");
        if (urlParts.length > 1) {
          const keyPart = urlParts[1].split("?")[0]; // Remove query params if any
          // Reconstruct the storage key using the same pattern as getOrganizationLogoKey
          const oldStorageKey = `organization-logos/${getRootDir()}/${keyPart}`;
          await deleteObject(oldStorageKey);
        }
      } catch (deleteError) {
        // Log but don't fail if old logo deletion fails
        log_error(deleteError);
      }
    }

    // Generate storage key
    const storageKey = getOrganizationLogoKey(organizationId, fileExtension);

    // Upload to storage
    const logoUrl = await uploadBase64(logoData, storageKey);
    if (!logoUrl) {
      return res.status(500).send(new ServerResponse(false, null, "Failed to upload logo"));
    }

    // Update database with logo URL
    const updateQ = `
      UPDATE organizations
      SET logo_url = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING logo_url
    `;
    const updateResult = await db.query(updateQ, [logoUrl, organizationId]);

    // Sync logo to all related client_portal_settings
    // Find all teams belonging to this organization and update their client portal settings
    const syncQuery = `
      UPDATE client_portal_settings
      SET logo_url = $1, updated_at = CURRENT_TIMESTAMP
      WHERE organization_team_id IN (
        SELECT id FROM teams
        WHERE user_id = $2 OR organization_id = $3
      )
    `;
    await db.query(syncQuery, [logoUrl, ownerId, organizationId]);

    return res.status(200).send(
      new ServerResponse(
        true,
        { logo_url: updateResult.rows[0].logo_url },
        "Logo uploaded successfully"
      )
    );
  }

  @HandleExceptions()
  public static async deleteOrganizationLogo(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const ownerId = req.user?.owner_id;
    if (!ownerId) {
      return res.status(400).send(new ServerResponse(false, null, "User not found"));
    }

    // Get organization ID
    const orgQuery = `SELECT id, logo_url FROM organizations WHERE user_id = $1`;
    const orgResult = await db.query(orgQuery, [ownerId]);
    if (orgResult.rows.length === 0) {
      return res.status(404).send(new ServerResponse(false, null, "Organization not found"));
    }
    const organizationId = orgResult.rows[0].id;
    const logoUrl = orgResult.rows[0].logo_url;

    if (!logoUrl) {
      return res.status(404).send(new ServerResponse(false, null, "No logo to delete"));
    }

    // Delete logo from S3
    try {
      // Extract the storage key from the logo URL
      const urlParts = logoUrl.split("/organization-logos/");
      if (urlParts.length > 1) {
        const keyPart = urlParts[1].split("?")[0]; // Remove query params if any
        const storageKey = `organization-logos/${getRootDir()}/${keyPart}`;
        await deleteObject(storageKey);
      }
    } catch (deleteError) {
      // Log but don't fail if S3 deletion fails
      log_error(deleteError);
    }

    // Update database to remove logo URL
    const updateQ = `
      UPDATE organizations
      SET logo_url = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING logo_url
    `;
    await db.query(updateQ, [organizationId]);

    // Clear logo from all related client_portal_settings
    // Find all teams belonging to this organization and clear their client portal logo
    const syncQuery = `
      UPDATE client_portal_settings
      SET logo_url = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE organization_team_id IN (
        SELECT id FROM teams
        WHERE user_id = $1 OR organization_id = $2
      )
    `;
    await db.query(syncQuery, [ownerId, organizationId]);

    return res.status(200).send(
      new ServerResponse(true, { logo_url: null }, "Logo deleted successfully")
    );
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
  public static async getBillingInfo(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = `SELECT get_billing_info($1) AS billing_info;`;
    const result = await db.query(q, [req.user?.owner_id]);
    const [data] = result.rows;

    // Validate that billing_info exists
    if (!data || !data.billing_info) {
      return res.status(200).send(
        new ServerResponse(false, null, "Billing information not found")
      );
    }

    if (data.billing_info.trial_expire_date) {
      const validTillDate = moment(data.billing_info.trial_expire_date);
      const daysDifference = validTillDate.diff(moment(), "days");
      const dateString = calculateMonthDays(
        moment().format("YYYY-MM-DD"),
        data.billing_info.trial_expire_date
      );

      data.billing_info.expire_date_string = dateString;

      if (daysDifference < 0) {
        data.billing_info.expire_date_string = `Your trial plan expired ${dateString} ago`;
      } else if (daysDifference === 0 && daysDifference < 7) {
        data.billing_info.expire_date_string = `Your trial plan expires today`;
      } else {
        data.billing_info.expire_date_string = `Your trial plan expires in ${dateString}.`;
      }
    }

    if (data.billing_info.billing_type === "year")
      data.billing_info.unit_price_per_month =
        data.billing_info.unit_price / 12;

    const teamMemberData = await getActiveTeamMemberCount(req.user?.owner_id ?? "");
    const subscriptionData = await checkTeamSubscriptionStatus(
      req.user?.team_id ?? ""
    );

    const adjustedUsedCount = Number(teamMemberData?.user_count ?? 0);
    const freeSeatCount = Number(teamMemberData?.free_count ?? 0);
    const actualActiveMemberCount = adjustedUsedCount + freeSeatCount;

    // total_used should reflect the actual active members shown in team settings.
    data.billing_info.total_used = Math.max(actualActiveMemberCount, 0);
    const isLtdUser = data.billing_info?.is_ltd_user === true;
    const ltdSeatLimit = Number(subscriptionData?.ltd_users ?? 0);

    data.billing_info.total_seats = isLtdUser
      ? Math.max(ltdSeatLimit, 0)
      : (subscriptionData?.quantity ?? null);
    data.billing_info.redeemed_codes_count = subscriptionData?.redeemed_codes_count ?? 0;
    data.billing_info.appsumo_business_eligible = subscriptionData?.appsumo_business_eligible === true;

    return res.status(200).send(new ServerResponse(true, data.billing_info));
  }

  @HandleExceptions()
  public static async getBillingTransactions(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = `SELECT subscription_payment_id,
                      event_time::date,
                      (next_bill_date::DATE - INTERVAL '1 day')::DATE AS next_bill_date,
                      currency,
                      receipt_url,
                      payment_method,
                      status,
                      payment_status
               FROM licensing_payment_details
               WHERE user_id = $1
               ORDER BY created_at DESC;`;
    const result = await db.query(q, [req.user?.owner_id]);

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getBillingCharges(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = `SELECT (SELECT name FROM licensing_pricing_plans lpp WHERE id = lus.plan_id),
                      unit_price::numeric,
                      currency,
                      status,
                      quantity,
                      unit_price::numeric * quantity                  AS amount,
                      (SELECT event_time
                       FROM licensing_payment_details lpd
                       WHERE lpd.user_id = lus.user_id
                       ORDER BY created_at DESC
                       LIMIT 1)::DATE                                 AS start_date,
                      (next_bill_date::DATE - INTERVAL '1 day')::DATE AS end_date
               FROM licensing_user_subscriptions lus
               WHERE user_id = $1;`;
    const result = await db.query(q, [req.user?.owner_id]);

    const countQ = `SELECT subscription_id
                    FROM licensing_user_subscription_modifiers
                    WHERE subscription_id = (SELECT subscription_id
                                             FROM licensing_user_subscriptions
                                             WHERE user_id = $1
                                               AND status != 'deleted'
                                             LIMIT 1)::INT;`;
    const countResult = await db.query(countQ, [req.user?.owner_id]);

    return res.status(200).send(
      new ServerResponse(true, {
        plan_charges: result.rows,
        modifiers: countResult.rows,
      })
    );
  }

  @HandleExceptions()
  public static async getBillingModifiers(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = `SELECT created_at
               FROM licensing_user_subscription_modifiers
               WHERE subscription_id = (SELECT subscription_id
                                        FROM licensing_user_subscriptions
                                        WHERE user_id = $1
                                          AND status != 'deleted'
                                        LIMIT 1)::INT;`;
    const result = await db.query(q, [req.user?.owner_id]);

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getBillingConfiguration(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = `SELECT name,
                      email,
                      organization_name AS company_name,
                      contact_number    AS phone,
                      address_line_1,
                      address_line_2,
                      city,
                      state,
                      postal_code,
                      country
               FROM organizations
                      LEFT JOIN users u ON organizations.user_id = u.id
               WHERE u.id = $1;`;
    const result = await db.query(q, [req.user?.owner_id]);
    const [data] = result.rows;

    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async updateBillingConfiguration(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const {
      company_name,
      phone,
      address_line_1,
      address_line_2,
      city,
      state,
      postal_code,
      country,
    } = req.body;
    const q = `UPDATE organizations
               SET organization_name = $1,
                   contact_number    = $2,
                   address_line_1    = $3,
                   address_line_2    = $4,
                   city              = $5,
                   state             = $6,
                   postal_code       = $7,
                   country           = $8
               WHERE user_id = $9;`;
    const result = await db.query(q, [
      company_name,
      phone,
      address_line_1,
      address_line_2,
      city,
      state,
      postal_code,
      country,
      req.user?.owner_id,
    ]);
    const [data] = result.rows;

    return res
      .status(200)
      .send(new ServerResponse(true, data, "Configuration Updated"));
  }

  @HandleExceptions()
  public static async upgradePlan(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { plan, seatCount } = req.query;

    const obj = await getTeamMemberCount(req.user?.owner_id ?? "");
    if (seatCount) {
      obj.user_count = parseInt(seatCount as string, 10);
    }
    const axiosResponse = await generatePayLinkRequest(
      obj,
      plan as string,
      req.user?.owner_id,
      req.user?.id
    );

    return res.status(200).send(new ServerResponse(true, axiosResponse.body));
  }

  @HandleExceptions()
  public static async getPlans(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = `SELECT
                  ls.default_monthly_plan AS monthly_plan_id,
                  lp_monthly.name AS monthly_plan_name,
                  ls.default_annual_plan AS annual_plan_id,
                  lp_monthly.recurring_price AS monthly_price,
                  lp_annual.name AS annual_plan_name,
                  lp_annual.recurring_price AS annual_price,
                  ls.team_member_limit,
                  ls.projects_limit,
                  ls.free_tier_storage
              FROM
                  licensing_settings ls
              LEFT JOIN
                  licensing_pricing_plans lp_monthly ON ls.default_monthly_plan = lp_monthly.id
              LEFT JOIN
                  licensing_pricing_plans lp_annual ON ls.default_annual_plan = lp_annual.id;`;
    const result = await db.query(q, []);
    const [data] = result.rows;

    const obj = await getTeamMemberCount(req.user?.owner_id ?? "");

    // If no data found, return default values
    if (!data) {
      const defaultData = {
        monthly_plan_id: null,
        monthly_plan_name: "Pro Monthly",
        annual_plan_id: null,
        annual_plan_name: "Pro Annual",
        monthly_price: "69",
        annual_price: "49",
        team_member_limit: "3",
        projects_limit: "3",
        free_tier_storage: "100MB",
        current_user_count: obj.user_count
      };
      
      return res.status(200).send(new ServerResponse(true, defaultData));
    }

    // Safely handle data transformation with null checks
    const responseData = {
      ...data,
      team_member_limit: data.team_member_limit === 0 ? "Unlimited" : (data.team_member_limit || "3"),
      projects_limit: data.projects_limit === 0 ? "Unlimited" : (data.projects_limit || "3"),
      free_tier_storage: data.free_tier_storage ? `${data.free_tier_storage}MB` : "100MB",
      current_user_count: obj.user_count,
      annual_price: data.annual_price ? (data.annual_price / 12).toFixed(2) : "49",
      monthly_price: data.monthly_price || "69"
    };

    return res.status(200).send(new ServerResponse(true, responseData));
  }

  @HandleExceptions()
  public static async purchaseStorage(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const subscriptionId = await this.getSubscriptionId(req.user?.owner_id ?? "");

    await addModifier(subscriptionId);

    return res.status(200).send(new ServerResponse(true, { subscription_id: subscriptionId }));
  }

  @HandleExceptions()
  public static async changePlan(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { plan } = req.query;

    const subscriptionId = await this.getSubscriptionId(req.user?.owner_id ?? "");

    const axiosResponse = await changePlan(
      plan as string,
      subscriptionId
    );

    return res.status(200).send(new ServerResponse(true, axiosResponse.body));
  }

  @HandleExceptions()
  public static async cancelPlan(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    if (!req.user?.owner_id)
      return res
        .status(200)
        .send(new ServerResponse(false, "Invalid Request."));

    const subscriptionId = await this.getSubscriptionId(req.user?.owner_id ?? "");

    const axiosResponse = await cancelSubscription(
      subscriptionId,
      req.user?.owner_id
    );

    return res.status(200).send(new ServerResponse(true, axiosResponse.body));
  }

  @HandleExceptions()
  public static async pauseSubscription(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    if (!req.user?.owner_id)
      return res
        .status(200)
        .send(new ServerResponse(false, "Invalid Request."));

    const subscriptionId = await this.getSubscriptionId(req.user?.owner_id ?? "");

    const axiosResponse = await pauseOrResumeSubscription(
      subscriptionId,
      req.user?.owner_id,
      true
    );

    return res.status(200).send(new ServerResponse(true, axiosResponse.body));
  }

  @HandleExceptions()
  public static async resumeSubscription(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    if (!req.user?.owner_id)
      return res
        .status(200)
        .send(new ServerResponse(false, "Invalid Request."));

    const subscriptionId = await this.getSubscriptionId(req.user?.owner_id ?? "");

    const axiosResponse = await pauseOrResumeSubscription(
      subscriptionId,
      req.user?.owner_id,
      false
    );

    return res.status(200).send(new ServerResponse(true, axiosResponse.body));
  }

  @HandleExceptions()
  public static async getBillingStorageInfo(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = `SELECT trial_in_progress,
                      trial_expire_date,
                      ud.storage,
                      (SELECT name AS plan_name FROM licensing_pricing_plans WHERE id = lus.plan_id),
                      (SELECT default_trial_storage FROM licensing_settings),
                      (SELECT storage_addon_size FROM licensing_settings),
                      (SELECT storage_addon_price FROM licensing_settings)
               FROM organizations ud
                      LEFT JOIN users u ON ud.user_id = u.id
                      LEFT JOIN licensing_user_subscriptions lus ON u.id = lus.user_id
               WHERE ud.user_id = $1;`;
    const result = await db.query(q, [req.user?.owner_id]);
    const [data] = result.rows;

    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async getAccountStorage(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamsQ = `SELECT id
                    FROM teams
                    WHERE user_id = $1;`;
    const teamsResponse = await db.query(teamsQ, [req.user?.owner_id]);

    const storageQ = `SELECT storage
                      FROM organizations
                      WHERE user_id = $1;`;
    const result = await db.query(storageQ, [req.user?.owner_id]);
    const [data] = result.rows;

    const storage: any = {};
    storage.used = 0;
    storage.total = data.storage;

    for (const team of teamsResponse.rows) {
      storage.used += await calculateStorage(team.id);
    }

    storage.remaining = storage.total * 1024 * 1024 * 1024 - storage.used;
    storage.used_percent =
      Math.ceil((storage.used / (storage.total * 1024 * 1024 * 1024)) * 10000) /
      100;

    return res.status(200).send(new ServerResponse(true, storage));
  }

  @HandleExceptions()
  public static async getCountries(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = `SELECT id, name, code
               FROM countries
               ORDER BY name;`;
    const result = await db.query(q, []);

    return res.status(200).send(new ServerResponse(true, result.rows || []));
  }

  @HandleExceptions()
  public static async switchToFreePlan(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { id: teamId } = req.params;

    const limits = await getFreePlanSettings();
    const ownerId = await getOwnerIdByTeam(teamId);

    if (limits && ownerId) {
      if (parseInt(limits.team_member_limit) !== 0) {
        const teamMemberCount = await getTeamMemberCount(ownerId);
        if (parseInt(teamMemberCount) > parseInt(limits.team_member_limit)) {
          return res
            .status(200)
            .send(
              new ServerResponse(
                false,
                [],
                `Sorry, the free plan cannot have more than ${limits.team_member_limit} members.`
              )
            );
        }
      }

      const projectsCount = await getCurrentProjectsCount(ownerId);
      if (parseInt(projectsCount) > parseInt(limits.projects_limit)) {
        return res
          .status(200)
          .send(
            new ServerResponse(
              false,
              [],
              `Sorry, the free plan cannot have more than ${limits.projects_limit} projects.`
            )
          );
      }

      const usedStorage = await getUsedStorage(ownerId);
      if (
        parseInt(usedStorage) >
        megabytesToBytes(parseInt(limits.free_tier_storage))
      ) {
        return res
          .status(200)
          .send(
            new ServerResponse(
              false,
              [],
              `Sorry, the free plan cannot exceed ${limits.free_tier_storage}MB of storage.`
            )
          );
      }

      const update_q = `UPDATE organizations
        SET license_type_id     = (SELECT id FROM sys_license_types WHERE key = 'FREE'),
            trial_in_progress   = FALSE,
            subscription_status = 'free',
            storage             = (SELECT free_tier_storage FROM licensing_settings)
        WHERE user_id = $1;`;
      await db.query(update_q, [ownerId]);

      return res
        .status(200)
        .send(
          new ServerResponse(
            true,
            [],
            "Your plan has been successfully switched to the Free Plan."
          )
        );
    }
    return res
      .status(200)
      .send(
        new ServerResponse(
          false,
          [],
          "Failed to switch to the Free Plan. Please try again later."
        )
      );
  }

  @HandleExceptions()
  public static async redeem(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { code } = req.body;

    const q = `SELECT * FROM licensing_coupon_codes WHERE coupon_code = $1 AND is_redeemed IS FALSE AND is_refunded IS FALSE;`;
    const result = await db.query(q, [code]);
    const [data] = result.rows;

    if (!result.rows.length)
      return res
        .status(200)
        .send(
          new ServerResponse(
            false,
            [],
            "Redeem Code verification Failed! Please try again."
          )
        );

    const checkQ = `SELECT  sum(team_members_limit) AS team_member_total FROM licensing_coupon_codes WHERE redeemed_by = $1 AND is_redeemed IS TRUE;`;
    const checkResult = await db.query(checkQ, [req.user?.owner_id]);
    const [total] = checkResult.rows;

    if (parseInt(total.team_member_total) > 50)
      return res
        .status(200)
        .send(
          new ServerResponse(false, [], "Maximum number of codes redeemed!")
        );

    const updateQ = `UPDATE licensing_coupon_codes
                SET is_redeemed  = TRUE, redeemed_at = CURRENT_TIMESTAMP,
                    redeemed_by = $1
                WHERE id = $2;`;
    await db.query(updateQ, [req.user?.owner_id, data.id]);

    const updateQ2 = `UPDATE organizations
        SET subscription_status = 'life_time_deal',
            trial_in_progress   = FALSE,
            storage = (SELECT sum(storage_limit) FROM licensing_coupon_codes WHERE redeemed_by = $1),
            license_type_id = (SELECT id FROM sys_license_types WHERE key = 'LIFE_TIME_DEAL') 
        WHERE user_id = $1;`;
    await db.query(updateQ2, [req.user?.owner_id]);

    // Check if user has redeemed 5 codes and upgrade to Business Plan
    const redeemedCountQ = `SELECT COUNT(*)::INT AS redeemed_count 
                           FROM licensing_coupon_codes 
                           WHERE redeemed_by = $1 
                             AND is_redeemed = TRUE 
                             AND is_refunded = FALSE;`;
    const redeemedResult = await db.query(redeemedCountQ, [req.user?.owner_id]);
    const redeemedCount = redeemedResult.rows[0]?.redeemed_count || 0;

	    if (redeemedCount >= 5) {
	      // Upgrade to Business Plan
	      const businessPlanQ = `UPDATE organizations
	        SET business_plan_override = TRUE,
	            team_member_limit_override = TRUE
	        WHERE user_id = $1;`;
	      await db.query(businessPlanQ, [req.user?.owner_id]);
	    }

    return res
      .status(200)
      .send(new ServerResponse(true, [], "Code redeemed successfully!"));
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

    // Prevent self-removal using the current session identity already resolved on the request.
    const isSelfRemoval = !!req.user?.team_member_id && id === req.user.team_member_id;
    if (isSelfRemoval) {
      return res
        .status(200)
        .send(
          new ServerResponse(
            false,
            null,
            "You cannot remove yourself from the team.",
          ),
        );
    }

    // check subscription status
    const subscriptionData = await checkTeamSubscriptionStatus(teamId);
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
          const response = await updateUsers(
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

    const actorUserId = req.user?.id ?? null;

    NotificationsService.sendNotificationToUser(
      data.member.id,
      actorUserId,
      data.member.team,
      teamId,
      message,
    );

    IO.emitByUserId(
      data.member.id,
      actorUserId,
      SocketEvents.TEAM_MEMBER_REMOVED,
      {
        teamId: teamId,
        message,
        removedUserId: data.member.id,
      }
    );
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getFreePlanLimits(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const limits = await getFreePlanSettings();

    return res.status(200).send(new ServerResponse(true, limits || {}));
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
        // Get the default holiday type (Public Holiday)
        const typeQ = `SELECT id FROM holiday_types WHERE name = 'Public Holiday' LIMIT 1`;
        const typeResult = await db.query(typeQ);
        const holidayTypeId = typeResult.rows[0]?.id;

        if (!holidayTypeId) {
          console.warn("Default holiday type 'Public Holiday' not found");
        } else {
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
              // Insert into organization_holidays so they show in the calendar
              const insertOrgQuery = `
                INSERT INTO organization_holidays (organization_id, holiday_type_id, name, description, date, is_recurring)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (organization_id, date) DO NOTHING
              `;

              await db.query(insertOrgQuery, [
                organizationId,
                holidayTypeId,
                holiday.name,
                holiday.description,
                holiday.date,
                holiday.is_recurring,
              ]);

              // Also store in country_holidays for reference
              const insertCountryQuery = `
                INSERT INTO country_holidays (country_code, name, description, date, is_recurring)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (country_code, name, date) DO NOTHING
              `;

              await db.query(insertCountryQuery, [
                "LK",
                holiday.name,
                holiday.description,
                holiday.date,
                holiday.is_recurring,
              ]);
            }
          }
        }

      } catch (error) {
        // Log error but don't fail the settings update
        console.error("Error syncing Sri Lankan holidays:", error);
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

    // Add all US states, DC, and territories
    const usIndex = countriesWithStates.findIndex((c) => c.code === "US");
    if (usIndex !== -1) {
      countriesWithStates[usIndex].states = [
        { code: "AL", name: "Alabama" },
        { code: "AK", name: "Alaska" },
        { code: "AZ", name: "Arizona" },
        { code: "AR", name: "Arkansas" },
        { code: "CA", name: "California" },
        { code: "CO", name: "Colorado" },
        { code: "CT", name: "Connecticut" },
        { code: "DE", name: "Delaware" },
        { code: "FL", name: "Florida" },
        { code: "GA", name: "Georgia" },
        { code: "HI", name: "Hawaii" },
        { code: "ID", name: "Idaho" },
        { code: "IL", name: "Illinois" },
        { code: "IN", name: "Indiana" },
        { code: "IA", name: "Iowa" },
        { code: "KS", name: "Kansas" },
        { code: "KY", name: "Kentucky" },
        { code: "LA", name: "Louisiana" },
        { code: "ME", name: "Maine" },
        { code: "MD", name: "Maryland" },
        { code: "MA", name: "Massachusetts" },
        { code: "MI", name: "Michigan" },
        { code: "MN", name: "Minnesota" },
        { code: "MS", name: "Mississippi" },
        { code: "MO", name: "Missouri" },
        { code: "MT", name: "Montana" },
        { code: "NE", name: "Nebraska" },
        { code: "NV", name: "Nevada" },
        { code: "NH", name: "New Hampshire" },
        { code: "NJ", name: "New Jersey" },
        { code: "NM", name: "New Mexico" },
        { code: "NY", name: "New York" },
        { code: "NC", name: "North Carolina" },
        { code: "ND", name: "North Dakota" },
        { code: "OH", name: "Ohio" },
        { code: "OK", name: "Oklahoma" },
        { code: "OR", name: "Oregon" },
        { code: "PA", name: "Pennsylvania" },
        { code: "RI", name: "Rhode Island" },
        { code: "SC", name: "South Carolina" },
        { code: "SD", name: "South Dakota" },
        { code: "TN", name: "Tennessee" },
        { code: "TX", name: "Texas" },
        { code: "UT", name: "Utah" },
        { code: "VT", name: "Vermont" },
        { code: "VA", name: "Virginia" },
        { code: "WA", name: "Washington" },
        { code: "WV", name: "West Virginia" },
        { code: "WI", name: "Wisconsin" },
        { code: "WY", name: "Wyoming" },
        { code: "DC", name: "District of Columbia" },
        { code: "AS", name: "American Samoa" },
        { code: "GU", name: "Guam" },
        { code: "MP", name: "Northern Mariana Islands" },
        { code: "PR", name: "Puerto Rico" },
        { code: "VI", name: "U.S. Virgin Islands" },
      ];
    }

    // Add all Canadian provinces and territories
    const caIndex = countriesWithStates.findIndex((c) => c.code === "CA");
    if (caIndex !== -1) {
      countriesWithStates[caIndex].states = [
        { code: "AB", name: "Alberta" },
        { code: "BC", name: "British Columbia" },
        { code: "MB", name: "Manitoba" },
        { code: "NB", name: "New Brunswick" },
        { code: "NL", name: "Newfoundland and Labrador" },
        { code: "NS", name: "Nova Scotia" },
        { code: "ON", name: "Ontario" },
        { code: "PE", name: "Prince Edward Island" },
        { code: "QC", name: "Quebec" },
        { code: "SK", name: "Saskatchewan" },
        { code: "NT", name: "Northwest Territories" },
        { code: "NU", name: "Nunavut" },
        { code: "YT", name: "Yukon" },
      ];
    }

    return res.status(200).send(new ServerResponse(true, countriesWithStates));
  }

  /**
   * Get AppSumo countdown widget data
   * GET /api/admin-center/appsumo/countdown-widget
   */
  @HandleExceptions()
  public static async getAppSumoCountdownWidget(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_id;
    
    if (!organizationId) {
      return res.status(400).send(new ServerResponse(false, null, "Organization ID is required"));
    }

    const countdownData = await appSumoService.getCountdownWidget(organizationId);

    if (!countdownData) {
      return res.status(200).send(new ServerResponse(true, {
        isVisible: false,
        remainingDays: 0,
        remainingHours: 0,
        remainingMinutes: 0,
        urgencyLevel: 'normal',
        message: 'Not an AppSumo user or discount period expired',
        ctaText: 'View Plans',
        ctaUrl: '/settings/billing'
      }));
    }

    return res.status(200).send(new ServerResponse(true, countdownData));
  }
}

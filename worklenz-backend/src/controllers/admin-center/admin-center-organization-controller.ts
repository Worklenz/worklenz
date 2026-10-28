import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";

import db from "../../config/db";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../worklenz-controller-base";
import HandleExceptions from "../../decorators/handle-exceptions";
import { log_error } from "../../shared/utils";
import { uploadBase64, getOrganizationLogoKey, deleteObject, getRootDir } from "../../shared/storage";
import { actorFromSessionUser, logAuditEvent } from "../../services/audit-log.service";
import { AUDIT_EVENT_TYPE } from "../../shared/audit-log-constants";

export default class AdminCenterOrganizationController extends WorklenzControllerBase {
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

    // Use users.last_active instead of correlated scans of task_work_log /
    // task_activity_logs. Those tables grow huge in production, so the old
    // per-row GREATEST(...) subqueries made this endpoint very slow there
    // while staying fast on small local/test datasets. last_active is kept
    // current on each authenticated session (passport deserialize).
    const q = `SELECT ROW_TO_JSON(rec) AS users
            FROM (SELECT COUNT(*) AS total,
                        (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
                          FROM (SELECT outer_tmiv.email,
                                      STRING_AGG(DISTINCT CAST(outer_tmiv.user_id AS VARCHAR), ', ') AS user_id,
                                      STRING_AGG(DISTINCT outer_tmiv.name, ', ') AS name,
                                      STRING_AGG(DISTINCT outer_tmiv.avatar_url, ', ') AS avatar_url,
                                      MAX(u.last_active) AS last_logged
                                 FROM team_member_info_view outer_tmiv
                                 LEFT JOIN users u ON u.id = outer_tmiv.user_id
                                 WHERE outer_tmiv.team_id IN (SELECT id
                                                             FROM teams
                                                             WHERE teams.user_id = $1)
                                   ${searchQuery}
                                 GROUP BY outer_tmiv.email
                                 ORDER BY outer_tmiv.email LIMIT $2 OFFSET $3) t) AS data
                   FROM (SELECT DISTINCT email
                         FROM team_member_info_view outer_tmiv
                         WHERE outer_tmiv.team_id IN
                               (SELECT id
                               FROM teams
                               WHERE teams.user_id = $1)
                           ${searchQuery}) AS total) rec;`;
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

    // captured before the UPDATE so the audit entry can record a real
    // old → new transition.
    const previousNameResult = await db.query(
      `SELECT organization_name FROM organizations WHERE user_id = $1`,
      [req.user?.owner_id]
    );
    const previousName = previousNameResult.rows[0]?.organization_name;

    const q = `UPDATE organizations
               SET organization_name = $1
               WHERE user_id = $2;`;
    const result = await db.query(q, [name, req.user?.owner_id]);

    if (req.user?.organization_id && previousName !== name) {
      logAuditEvent({
        organizationId: req.user.organization_id,
        teamId: req.user.team_id || null,
        actor: actorFromSessionUser(req.user),
        eventType: AUDIT_EVENT_TYPE.WORKSPACE_RENAMED.id,
        description: `Workspace renamed from "${previousName}" to "${name}"`,
        oldValue: previousName,
        newValue: name,
      });
    }

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async updateOwnerContactNumber(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { contact_number } = req.body;

    // captured before the UPDATE for the old → new audit entry.
    const previousContactResult = await db.query(
      `SELECT contact_number FROM organizations WHERE user_id = $1`,
      [req.user?.owner_id]
    );
    const previousContactNumber = previousContactResult.rows[0]?.contact_number;

    const q = `UPDATE organizations
               SET contact_number = $1
               WHERE user_id = $2;`;
    const result = await db.query(q, [contact_number, req.user?.owner_id]);

    if (req.user?.organization_id && previousContactNumber !== contact_number) {
      logAuditEvent({
        organizationId: req.user.organization_id,
        teamId: req.user.team_id || null,
        actor: actorFromSessionUser(req.user),
        eventType: AUDIT_EVENT_TYPE.WORKSPACE_SETTING_CHANGED.id,
        description: `Workspace owner contact number updated`,
        oldValue: previousContactNumber,
        newValue: contact_number,
      });
    }

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

    // captured before the UPDATE for the old → new audit entry.
    const previousCalcResult = await db.query(
      `SELECT calculation_method, hours_per_day FROM organizations WHERE user_id = $1`,
      [req.user?.owner_id]
    );
    const previousCalc = previousCalcResult.rows[0];

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

    if (
      req.user?.organization_id &&
      previousCalc &&
      (previousCalc.calculation_method !== result.rows[0].calculation_method ||
        previousCalc.hours_per_day !== result.rows[0].hours_per_day)
    ) {
      logAuditEvent({
        organizationId: req.user.organization_id,
        teamId: req.user.team_id || null,
        actor: actorFromSessionUser(req.user),
        eventType: AUDIT_EVENT_TYPE.WORKSPACE_SETTING_CHANGED.id,
        description: `Workspace time calculation method changed to "${result.rows[0].calculation_method}"`,
        oldValue: JSON.stringify({
          calculation_method: previousCalc.calculation_method,
          hours_per_day: previousCalc.hours_per_day,
        }),
        newValue: JSON.stringify({
          calculation_method: result.rows[0].calculation_method,
          hours_per_day: result.rows[0].hours_per_day,
        }),
      });
    }

    return res.status(200).send(
      new ServerResponse(true, {
        organization: result.rows[0],
        message: "Organization calculation method updated successfully",
      })
    );
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
}

import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import db from "../../config/db";
import { isValidUuid } from "../../shared/validation-helpers";
import {
  isClientContactRole,
  isClientPermissionLevel,
} from "../../shared/client-portal-permissions";
import {
  CONTACT_PORTAL_STATUSES,
  CONTACT_PORTAL_STATUS_SQL,
  CONTACT_STATE_JOINS_SQL,
  ContactPortalStatus,
  ContactServiceError,
  findContactByEmail,
  getContactById,
  inviteContact,
  InviteDelivery,
  isValidContactEmail,
  loadContactView,
  mapContactRow,
  normalizeContactEmail,
  PROJECT_ACCESS_SQL,
  ProjectAccessInput,
  replaceProjectAccess,
  withTransaction,
} from "../../services/client-contacts-service";
import {
  badRequest,
  handleContactError,
  notFound,
  unauthenticated,
} from "./client-contacts-http";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

// Company sort keys the list accepts, mapped to SQL. Keys outside this list fall back to "name".
const SORT_COLUMNS: Record<string, string> = {
  name: "cc.name",
  email: "cc.email",
  company_name: "COALESCE(NULLIF(TRIM(c.company_name), ''), c.name)",
  role: "cc.role",
  created_at: "cc.created_at",
};

/** Company Users: the people at each client company who can be given portal access. */
export default class ClientPortalCompanyUsersController {
  /** GET /portal/company-users */
  static async list(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const teamId = req.user?.team_id;
      if (!teamId) return unauthenticated(res);

      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.limit) || DEFAULT_PAGE_SIZE));
      const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
      const clientId = typeof req.query.client_id === "string" ? req.query.client_id : "";

      if (clientId && !isValidUuid(clientId)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid client ID"));
      }

      const statuses = parseStatusFilter(req.query.status);

      const params: unknown[] = [teamId];
      const conditions = ["cc.team_id = $1"];

      if (clientId) {
        params.push(clientId);
        conditions.push(`cc.client_id = $${params.length}`);
      }

      if (search) {
        params.push(`%${search}%`);
        const p = `$${params.length}`;
        conditions.push(
          `(cc.name ILIKE ${p} OR cc.email ILIKE ${p} OR cc.job_title ILIKE ${p}
            OR c.name ILIKE ${p} OR c.company_name ILIKE ${p})`
        );
      }

      if (statuses.length > 0) {
        params.push(statuses);
        conditions.push(`(${CONTACT_PORTAL_STATUS_SQL}) = ANY($${params.length}::text[])`);
      }

      const fromWhere = `
        FROM client_contacts cc
        JOIN clients c ON c.id = cc.client_id
        ${CONTACT_STATE_JOINS_SQL}
        WHERE ${conditions.join(" AND ")}
      `;

      const sortColumn = SORT_COLUMNS[String(req.query.sortBy)] ?? SORT_COLUMNS.name;
      const sortDirection = req.query.sortOrder === "desc" ? "DESC" : "ASC";

      const countResult = await db.query(`SELECT COUNT(*)::int AS total ${fromWhere}`, params);
      const total: number = countResult.rows[0]?.total ?? 0;

      const dataParams = [...params, limit, (page - 1) * limit];
      const dataResult = await db.query(
        `SELECT
           cc.id, cc.client_id, cc.name, cc.email, cc.phone, cc.job_title, cc.role,
           cc.disabled_at, cc.created_at,
           COALESCE(NULLIF(TRIM(c.company_name), ''), c.name) AS company_name,
           cu.last_login AS last_login_at,
           (cc.client_user_id IS NOT NULL) AS has_login,
           inv.created_at AS invited_at,
           (${CONTACT_PORTAL_STATUS_SQL}) AS portal_status_key,
           ${PROJECT_ACCESS_SQL} AS projects
         ${fromWhere}
         ORDER BY ${sortColumn} ${sortDirection}, cc.id ASC
         LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        dataParams
      );

      return res.json(
        new ServerResponse(
          true,
          {
            users: dataResult.rows.map(mapContactRow),
            total,
            page,
            limit,
          },
          null
        )
      );
    } catch (error) {
      console.error("Error fetching company users:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve company users"));
    }
  }

  /**
   * GET /portal/company-users/stats
   * Computed live over the whole team. "Companies with no POC" counts companies that have at least
   * one user and none of them a POC, by client id (two companies can share a name).
   */
  static async stats(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const teamId = req.user?.team_id;
      if (!teamId) return unauthenticated(res);

      const result = await db.query(
        `SELECT
           COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE role = 'poc')::int AS pocs,
           COUNT(*) FILTER (WHERE disabled_at IS NOT NULL)::int AS disabled,
           (
             SELECT COUNT(*)::int FROM (
               SELECT client_id
               FROM client_contacts
               WHERE team_id = $1
               GROUP BY client_id
               HAVING COUNT(*) FILTER (WHERE role = 'poc') = 0
             ) AS companies_without_poc
           ) AS companies_without_poc
         FROM client_contacts
         WHERE team_id = $1`,
        [teamId]
      );

      const row = result.rows[0] ?? {};
      return res.json(
        new ServerResponse(
          true,
          {
            total: row.total ?? 0,
            pocs: row.pocs ?? 0,
            companies_without_poc: row.companies_without_poc ?? 0,
            disabled: row.disabled ?? 0,
          },
          null
        )
      );
    } catch (error) {
      console.error("Error fetching company users stats:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve company users stats"));
    }
  }

  /** GET /portal/company-users/:userId */
  static async getById(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const teamId = req.user?.team_id;
      if (!teamId) return unauthenticated(res);

      const user = await loadContactView(teamId, req.params.userId);
      if (!user) return notFound(res);

      return res.json(new ServerResponse(true, user, null));
    } catch (error) {
      console.error("Error fetching company user:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve company user"));
    }
  }

  /**
   * PUT /portal/company-users/:userId
   * Name, phone and job title are always editable. The email is the sign-in identity, so it can
   * only change until the user has a login; changing it also drops any pending invitation, since
   * that link was sent to the old address.
   */
  static async update(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const teamId = req.user?.team_id;
      if (!teamId) return unauthenticated(res);

      const { name, phone, job_title, email } = req.body ?? {};

      if (name !== undefined && (typeof name !== "string" || !name.trim() || name.trim().length > 255)) {
        return badRequest(res, "Name is required and must be at most 255 characters");
      }
      if (phone !== undefined && phone !== null && (typeof phone !== "string" || phone.trim().length > 50)) {
        return badRequest(res, "Phone must be at most 50 characters");
      }
      if (job_title !== undefined && job_title !== null && (typeof job_title !== "string" || job_title.trim().length > 100)) {
        return badRequest(res, "Job title must be at most 100 characters");
      }
      if (email !== undefined && !isValidContactEmail(email)) {
        return badRequest(res, "A valid email address is required");
      }

      await withTransaction(async (tx) => {
        const locked = await tx.query(
          `SELECT id, client_user_id, email FROM client_contacts WHERE id = $1 AND team_id = $2 FOR UPDATE`,
          [req.params.userId, teamId]
        );
        const contact = locked.rows[0];
        if (!contact) throw new ContactServiceError("NOT_FOUND", "Company user not found");

        let emailChanged = false;
        let nextEmail: string | undefined;
        if (email !== undefined) {
          nextEmail = normalizeContactEmail(email);
          emailChanged = nextEmail.toLowerCase() !== String(contact.email).toLowerCase();
        }

        if (emailChanged) {
          if (contact.client_user_id) {
            throw new ContactServiceError(
              "HAS_LOGIN",
              "The email can't be changed once the user has portal access"
            );
          }
          const taken = await findContactByEmail(tx, teamId, nextEmail as string);
          if (taken && taken.id !== contact.id) {
            throw new ContactServiceError(
              "EMAIL_TAKEN",
              `${nextEmail} is already a contact of ${taken.company_name || taken.client_name}`
            );
          }
          await tx.query(
            `DELETE FROM client_invitations WHERE client_contact_id = $1 AND status = 'pending'`,
            [contact.id]
          );
        }

        await tx.query(
          `UPDATE client_contacts
           SET name = COALESCE($1, name),
               phone = CASE WHEN $2::boolean THEN $3 ELSE phone END,
               job_title = CASE WHEN $4::boolean THEN $5 ELSE job_title END,
               email = COALESCE($6, email),
               updated_at = NOW()
           WHERE id = $7`,
          [
            typeof name === "string" ? name.trim() : null,
            phone !== undefined,
            typeof phone === "string" && phone.trim() ? phone.trim() : null,
            job_title !== undefined,
            typeof job_title === "string" && job_title.trim() ? job_title.trim() : null,
            emailChanged ? nextEmail : null,
            contact.id,
          ]
        );
      });

      const user = await loadContactView(teamId, req.params.userId);
      return res.json(new ServerResponse(true, user, "Company user updated"));
    } catch (error) {
      return handleContactError(res, error, "Failed to update company user");
    }
  }

  /** PUT /portal/company-users/:userId/role  body: { role: 'poc' | 'member' } */
  static async setRole(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const teamId = req.user?.team_id;
      if (!teamId) return unauthenticated(res);

      const { role } = req.body ?? {};
      if (!isClientContactRole(role)) return badRequest(res, "Role must be 'poc' or 'member'");

      const result = await db.query(
        `UPDATE client_contacts SET role = $1, updated_at = NOW() WHERE id = $2 AND team_id = $3 RETURNING id`,
        [role, req.params.userId, teamId]
      );
      if (result.rows.length === 0) return notFound(res);

      const user = await loadContactView(teamId, req.params.userId);
      return res.json(new ServerResponse(true, user, null));
    } catch (error) {
      return handleContactError(res, error, "Failed to update role");
    }
  }

  /**
   * PUT /portal/company-users/:userId/status  body: { disabled: boolean }
   * Disable only stamps `disabled_at`; the invitation and login state are untouched, so enabling
   * restores the prior portal status. Access is enforced per request (client-auth-middleware).
   */
  static async setStatus(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const teamId = req.user?.team_id;
      if (!teamId) return unauthenticated(res);

      const { disabled } = req.body ?? {};
      if (typeof disabled !== "boolean") return badRequest(res, "'disabled' must be true or false");

      const result = await db.query(
        `UPDATE client_contacts
         SET disabled_at = CASE WHEN $1::boolean THEN COALESCE(disabled_at, NOW()) ELSE NULL END,
             updated_at = NOW()
         WHERE id = $2 AND team_id = $3
         RETURNING id`,
        [disabled, req.params.userId, teamId]
      );
      if (result.rows.length === 0) return notFound(res);

      const user = await loadContactView(teamId, req.params.userId);
      return res.json(new ServerResponse(true, user, null));
    } catch (error) {
      return handleContactError(res, error, "Failed to update user status");
    }
  }

  /**
   * PUT /portal/company-users/:userId/projects  body: { projects: [{ project_id, level }] }
   * Replaces the user's per-project access. Stored and displayed only for now.
   */
  static async setProjects(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const teamId = req.user?.team_id;
      if (!teamId) return unauthenticated(res);

      const projects: unknown = req.body?.projects;
      if (!Array.isArray(projects)) return badRequest(res, "'projects' must be an array");

      const access: ProjectAccessInput[] = [];
      for (const item of projects) {
        const projectId = item?.project_id;
        const level = toLevel(item?.level);
        if (typeof projectId !== "string" || !isValidUuid(projectId) || !level) {
          return badRequest(res, "Each project needs a valid project_id and level");
        }
        access.push({ projectId, level });
      }

      await withTransaction(async (tx) => {
        const contact = await getContactById(tx, teamId, req.params.userId);
        if (!contact) throw new ContactServiceError("NOT_FOUND", "Company user not found");

        await replaceProjectAccess(tx, {
          contactId: contact.id,
          clientId: contact.client_id,
          teamId,
          access,
        });
        await tx.query(`UPDATE client_contacts SET updated_at = NOW() WHERE id = $1`, [contact.id]);
      });

      const user = await loadContactView(teamId, req.params.userId);
      return res.json(new ServerResponse(true, user, "Project access updated"));
    } catch (error) {
      return handleContactError(res, error, "Failed to update project access");
    }
  }

  /**
   * POST /portal/company-users/:userId/invite  body: { delivery?: 'email' | 'link' }
   * Sends the first invitation or resends it. With delivery 'link' the invitation is created but
   * nothing is emailed, and the link is returned for the operator to copy.
   */
  static async invite(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const teamId = req.user?.team_id;
      const invitedBy = req.user?.id;
      if (!teamId || !invitedBy) return unauthenticated(res);

      const delivery: InviteDelivery = req.body?.delivery === "link" ? "link" : "email";

      const result = await inviteContact({
        teamId,
        contactId: req.params.userId,
        invitedBy,
        delivery,
      });

      return res.json(
        new ServerResponse(
          true,
          {
            email: result.email,
            delivery: result.delivery,
            email_sent: result.emailSent,
            link: result.link,
            expires_at: result.expiresAt,
          },
          result.delivery === "email" && !result.emailSent
            ? "The invitation was created but the email could not be sent"
            : "Invitation sent"
        )
      );
    } catch (error) {
      return handleContactError(res, error, "Failed to send invitation");
    }
  }

  /**
   * DELETE /portal/company-users/:userId
   * Removes the contact, its access rows and open invitations, and revokes the login. The company
   * and its other users are untouched. A login shared with a contact in another team (multi-org) is
   * only detached from this team's organisation, not deleted.
   */
  static async remove(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const teamId = req.user?.team_id;
      if (!teamId) return unauthenticated(res);

      await withTransaction(async (tx) => {
        const contact = await getContactById(tx, teamId, req.params.userId);
        if (!contact) throw new ContactServiceError("NOT_FOUND", "Company user not found");

        await tx.query(`DELETE FROM client_contacts WHERE id = $1`, [contact.id]);

        if (contact.client_user_id) {
          const stillReferenced = await tx.query(
            `SELECT 1 FROM client_contacts WHERE client_user_id = $1 LIMIT 1`,
            [contact.client_user_id]
          );

          if (stillReferenced.rows.length === 0) {
            await tx.query(`DELETE FROM client_users WHERE id = $1`, [contact.client_user_id]);
          } else {
            await tx.query(
              `DELETE FROM client_user_organizations WHERE client_user_id = $1 AND team_id = $2`,
              [contact.client_user_id, teamId]
            );
          }
        }
      });

      return res.json(new ServerResponse(true, null, "Company user removed"));
    } catch (error) {
      return handleContactError(res, error, "Failed to remove company user");
    }
  }
}

function toLevel(value: unknown) {
  return isClientPermissionLevel(value) ? value : null;
}

function parseStatusFilter(value: unknown): ContactPortalStatus[] {
  if (typeof value !== "string" || !value.trim()) return [];
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item): item is ContactPortalStatus =>
      (CONTACT_PORTAL_STATUSES as string[]).includes(item)
    );
}


import db from "../../../config/db";
import { CLIENT_ROLE_DEFINITIONS } from "../../../shared/client-portal-permissions";
import { withTransaction } from "../../../services/client-contacts-service";
import { getPortalCounts } from "../../../services/client-portal-v2/counts.service";
import { badRequest } from "../../../services/client-portal-v2/errors";
import { addClient } from "../../../services/client-portal-v2/onboard.service";
import {
  getOrganizationOverview,
  getOrganizationStats,
  listOrganizations,
} from "../../../services/client-portal-v2/organizations.service";
import {
  PortalSettingsV2Patch,
  getPortalSettingsV2,
  getSharedCounts,
  savePortalSettingsV2,
} from "../../../services/client-portal-v2/settings.service";
import { listStaff } from "../../../services/client-portal-v2/staff";
import {
  assignClientUserProjects,
  deactivateClientUser,
  getClientUser,
  listClientUsers,
  reactivateClientUser,
  removeClientUser,
  resendClientInvitation,
  updateClientUser,
} from "../../../services/client-portal-v2/users.service";
import { asNumber, asString, bodyOf, ok, portalHandler, staffContext, uuidParam } from "./portal-http";

/**
 * Client Portal v2 admin: roles, settings, organizations, client users and the Add Client wizard.
 * Every route sits behind login and the Owner/Admin guard on the router.
 */
export default class PortalAccessController {
  /** GET /portal/v2/counts - the three sidebar badges from one request. */
  static counts = portalHandler("Failed to load the counts", async (req, res) => {
    const { teamId, userId } = staffContext(req);
    ok(res, await getPortalCounts(db, teamId, userId));
  });

  /** GET /portal/v2/roles - the matrix the client API enforces, so Settings shows the real thing. */
  static roles = portalHandler("Failed to load the roles", async (_req, res) => {
    ok(res, CLIENT_ROLE_DEFINITIONS);
  });

  /** GET /portal/v2/staff - active workspace members for the pickers (primary contact, assignee). */
  static staff = portalHandler("Failed to load the team", async (req, res) => {
    const { teamId } = staffContext(req);
    ok(res, await listStaff(db, teamId));
  });

  /** GET /portal/v2/settings */
  static getSettings = portalHandler("Failed to load the portal settings", async (req, res) => {
    const { teamId } = staffContext(req);
    const [settings, shared] = await Promise.all([getPortalSettingsV2(db, teamId), getSharedCounts(db, teamId)]);
    ok(res, { settings, shared });
  });

  /** PUT /portal/v2/settings - one Save for all four sections; a partial body is fine. */
  static saveSettings = portalHandler("Failed to save the portal settings", async (req, res) => {
    const { teamId, actor } = staffContext(req);
    const patch = bodyOf(req) as PortalSettingsV2Patch;
    const settings = await withTransaction(tx => savePortalSettingsV2(tx, { teamId, actor, patch }));
    ok(res, { settings, shared: await getSharedCounts(db, teamId) }, "Settings saved");
  });

  /** GET /portal/v2/organizations */
  static organizations = portalHandler("Failed to load the clients", async (req, res) => {
    const { teamId } = staffContext(req);
    const list = await listOrganizations(teamId, {
      search: asString(req.query.search),
      sort: asString(req.query.sort),
      order: asString(req.query.order),
      access: asString(req.query.access),
      page: asNumber(req.query.page),
      limit: asNumber(req.query.limit),
    });
    ok(res, { ...list, stats: await getOrganizationStats(db, teamId) });
  });

  /** GET /portal/v2/organizations/:organizationId/overview - counts plus "Needs attention". */
  static organizationOverview = portalHandler("Failed to load the client", async (req, res) => {
    const { teamId, userId } = staffContext(req);
    ok(res, await getOrganizationOverview(db, teamId, userId, uuidParam(req, "organizationId")));
  });

  /** GET /portal/v2/client-users */
  static users = portalHandler("Failed to load the client users", async (req, res) => {
    const { teamId } = staffContext(req);
    ok(
      res,
      await listClientUsers(teamId, {
        search: asString(req.query.search),
        organization_id: asString(req.query.organization_id),
        role: asString(req.query.role),
        status: asString(req.query.status),
        sort: asString(req.query.sort),
        order: asString(req.query.order),
        page: asNumber(req.query.page),
        limit: asNumber(req.query.limit),
      })
    );
  });

  /** GET /portal/v2/client-users/:userId */
  static user = portalHandler("Failed to load the client user", async (req, res) => {
    const { teamId } = staffContext(req);
    ok(res, await getClientUser(db, teamId, uuidParam(req, "userId")));
  });

  /** PUT /portal/v2/client-users/:userId - name, email, phone, job title and role. */
  static updateUser = portalHandler("Failed to update the client user", async (req, res) => {
    const { teamId, actor } = staffContext(req);
    const body = bodyOf(req);
    ok(
      res,
      await updateClientUser({
        teamId,
        userId: uuidParam(req, "userId"),
        actor,
        patch: {
          name: asString(body.name),
          email: asString(body.email),
          phone: body.phone === null ? null : asString(body.phone),
          job_title: body.job_title === null ? null : asString(body.job_title),
          role: asString(body.role),
          confirm_last_admin: body.confirm_last_admin === true,
        },
      }),
      "Saved. A role change applies on the user's next authorization check."
    );
  });

  /** PUT /portal/v2/client-users/:userId/projects  body: { project_ids } */
  static assignProjects = portalHandler("Failed to assign projects", async (req, res) => {
    const { teamId, actor } = staffContext(req);
    const { project_ids } = bodyOf(req);
    if (!Array.isArray(project_ids) || project_ids.some(id => typeof id !== "string")) {
      throw badRequest("project_ids must be a list of project ids", "INVALID_PROJECTS");
    }
    ok(
      res,
      await assignClientUserProjects({ teamId, userId: uuidParam(req, "userId"), projectIds: project_ids, actor }),
      "Saved. Removed access applies on the client's next request."
    );
  });

  /** POST /portal/v2/client-users/:userId/resend */
  static resend = portalHandler("Failed to resend the invitation", async (req, res) => {
    const { teamId, userId, actor } = staffContext(req);
    const result = await resendClientInvitation({
      teamId,
      userId: uuidParam(req, "userId"),
      invitedBy: userId,
      actor,
      delivery: bodyOf(req).delivery === "link" ? "link" : "email",
    });
    ok(res, result, "Invitation resent. The link is valid for 7 days.");
  });

  /** POST /portal/v2/client-users/:userId/deactivate */
  static deactivate = portalHandler("Failed to deactivate the client user", async (req, res) => {
    const { teamId, actor } = staffContext(req);
    ok(
      res,
      await deactivateClientUser({
        teamId,
        userId: uuidParam(req, "userId"),
        actor,
        confirmLastAdmin: bodyOf(req).confirm_last_admin === true,
        confirmPendingApprovals: bodyOf(req).confirm_pending_approvals === true,
      }),
      "Deactivated. Their next request fails and they are signed out."
    );
  });

  /** POST /portal/v2/client-users/:userId/reactivate - restores the status they held before. */
  static reactivate = portalHandler("Failed to reactivate the client user", async (req, res) => {
    const { teamId, actor } = staffContext(req);
    ok(res, await reactivateClientUser({ teamId, userId: uuidParam(req, "userId"), actor }), "Reactivated");
  });

  /** DELETE /portal/v2/client-users/:userId - their comments and approvals stay in history. */
  static remove = portalHandler("Failed to remove the client user", async (req, res) => {
    const { teamId, actor } = staffContext(req);
    await removeClientUser({
      teamId,
      userId: uuidParam(req, "userId"),
      actor,
      confirmLastAdmin: bodyOf(req).confirm_last_admin === true,
      confirmPendingApprovals: bodyOf(req).confirm_pending_approvals === true,
    });
    ok(res, null, "Removed");
  });

  /** POST /portal/v2/add-client - the two-method Add Client wizard, finished in one transaction. */
  static addClient = portalHandler("Failed to add the client", async (req, res) => {
    const { teamId, userId, actor } = staffContext(req);
    const body = bodyOf(req);
    const result = await addClient({
      teamId,
      invitedBy: userId,
      actor,
      body: {
        method: body.method,
        organization_id: asString(body.organization_id),
        organization_name: asString(body.organization_name),
        first_name: asString(body.first_name) ?? "",
        last_name: asString(body.last_name),
        email: asString(body.email) ?? "",
        phone: asString(body.phone),
        job_title: asString(body.job_title),
        role: asString(body.role),
        project_ids: Array.isArray(body.project_ids) ? body.project_ids.filter((id: unknown) => typeof id === "string") : [],
        send_invitation: body.send_invitation !== false,
      },
    });
    ok(res, result, "Client added", 201);
  });
}

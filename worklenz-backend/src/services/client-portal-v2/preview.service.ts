import { CLIENT_ROLE_DEFINITIONS, ClientContactRole } from "../../shared/client-portal-permissions";
import {
  getClientDashboard,
  getClientProject,
  getHiddenSummary,
  listClientApprovals,
  listClientChangeRequests,
  listClientFiles,
  listClientMilestones,
  listClientProjects,
  listClientTasks,
} from "./client-read.service";
import { getDashboardLayout } from "./dashboard-layout.service";
import { notFound } from "./errors";
import { getPortalSettingsV2 } from "./settings.service";
import { ClientSubject } from "./subject";
import { listClientThreads } from "./client-write.service";
import { Queryable } from "./types";
import { USER_VIEW_SQL } from "./users.service";

/**
 * "Preview as client": what one specific client user sees, read-only. It is built by calling the SAME
 * client read functions the client API uses, with the previewed user as the subject, so it cannot
 * drift from the rules a real client is held to. It changes no data, never signs staff in as the
 * client, and writes no audit event. The hidden-items panel is staff-only and is not reachable from
 * the client router.
 */

export type PreviewUserStatus = "active" | "invited";

export interface PreviewUserView {
  id: string;
  name: string;
  email: string;
  organization_id: string;
  organization_name: string;
  role: string;
  status: PreviewUserStatus;
}

export interface PreviewUsersResult {
  users: PreviewUserView[];
  /** False when the team has no client users left to preview or invite (deleted accounts do not count). */
  has_client_users: boolean;
}

/**
 * Active and invited users who can open at least one portal project. Client Admins inherit org portal
 * projects (no client_contact_project_access rows), so the filter uses USER_VIEW_SQL.projects rather than
 * assignment rows alone. An invited user has not accepted yet; the preview still uses the same project
 * and visibility rules they will be held to after they join. Deactivated and deleted users are excluded.
 */
export async function listPreviewUsers(q: Queryable, teamId: string): Promise<PreviewUsersResult> {
  const [usersResult, anyResult] = await Promise.all([
    q.query(
      `SELECT u.id, u.name, u.email, u.client_id, u.organization_name, u.role, u.status_key
         FROM (${USER_VIEW_SQL}) u
         JOIN clients org ON org.id = u.client_id AND org.status <> 'inactive'
        WHERE u.status_key IN ('active', 'invited')
          AND json_array_length(u.projects) > 0
        ORDER BY u.organization_name,
                 CASE WHEN u.status_key = 'active' THEN 0 ELSE 1 END,
                 u.name`,
      [teamId]
    ),
    q.query(
      `SELECT EXISTS (
         SELECT 1 FROM (${USER_VIEW_SQL}) u WHERE u.status_key <> 'deleted'
       ) AS has_client_users`,
      [teamId]
    ),
  ]);

  return {
    users: usersResult.rows.map(row => ({
      id: row.id,
      name: row.name,
      email: row.email,
      organization_id: row.client_id,
      organization_name: row.organization_name,
      role: row.role,
      status: row.status_key === "invited" ? "invited" : "active",
    })),
    has_client_users: anyResult.rows[0]?.has_client_users === true,
  };
}

/**
 * Subject for the staff preview. Active users and invited users who have not accepted yet can be
 * previewed. This does not grant a client session: the client API still resolves an active login only.
 */
async function subjectFor(q: Queryable, teamId: string, contactId: string): Promise<ClientSubject> {
  const result = await q.query(
    `SELECT u.id, u.name, u.email, u.client_id, u.role, cc.client_user_id, cc.team_id
       FROM (${USER_VIEW_SQL}) u
       JOIN client_contacts cc ON cc.id = u.id
       JOIN clients org ON org.id = u.client_id AND org.status <> 'inactive'
      WHERE u.id = $2
        AND u.status_key IN ('active', 'invited')`,
    [teamId, contactId]
  );
  const row = result.rows[0];
  if (!row) throw notFound("Client user");
  return {
    contactId: row.id,
    clientId: row.client_id,
    teamId: row.team_id,
    role: row.role as ClientContactRole,
    name: row.name,
    email: row.email,
    clientUserId: row.client_user_id ?? null,
  };
}

/** The whole preview for one user: dashboard, projects, approvals, change requests, discussions and the staff-only hidden panel. */
export async function getPreview(q: Queryable, teamId: string, contactId: string) {
  const subject = await subjectFor(q, teamId, contactId);
  const settings = await getPortalSettingsV2(q, teamId);

  const [dashboard, projects, approvals, changeRequests, hidden, threads, dashboardLayout] = await Promise.all([
    getClientDashboard(q, subject),
    listClientProjects(q, subject),
    listClientApprovals(q, subject),
    listClientChangeRequests(q, subject),
    getHiddenSummary(q, subject),
    listClientThreads(subject),
    getDashboardLayout(q, subject),
  ]);

  return {
    user: { id: subject.contactId, name: subject.name, email: subject.email, role: subject.role },
    role: CLIENT_ROLE_DEFINITIONS.find(definition => definition.role === subject.role) ?? null,
    // "Manage organization users" reads "currently off in Settings" while both Client Admin switches are off.
    manage_users_enabled: settings.admins_can_invite_users || settings.admins_can_remove_users,
    dashboard,
    projects,
    approvals,
    change_requests: changeRequests,
    // Discussions as this user sees them (client-visible messages only), read-only.
    threads,
    // The user's own saved dashboard arrangement; null means they never customised it.
    dashboard_layout: dashboardLayout.layout,
    hidden,
  };
}

/** One project as the previewed user sees it: summary, shared milestones, tasks and files. */
export async function getPreviewProject(q: Queryable, teamId: string, contactId: string, projectId: string) {
  const subject = await subjectFor(q, teamId, contactId);
  const [project, milestones, tasks, files] = await Promise.all([
    getClientProject(q, subject, projectId),
    listClientMilestones(q, subject, projectId),
    listClientTasks(q, subject, projectId),
    listClientFiles(q, subject, projectId),
  ]);
  return { project, milestones, tasks, files };
}

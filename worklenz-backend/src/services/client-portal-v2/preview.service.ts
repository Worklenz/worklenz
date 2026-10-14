import { CLIENT_ROLE_DEFINITIONS } from "../../shared/client-portal-permissions";
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
import { loadSubjectByContactId } from "./subject";
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

export interface PreviewUserView {
  id: string;
  name: string;
  email: string;
  organization_id: string;
  organization_name: string;
  role: string;
}

/** Active users who are assigned to at least one project. An Invited or Deactivated user cannot be previewed. */
export async function listPreviewUsers(q: Queryable, teamId: string): Promise<PreviewUserView[]> {
  const result = await q.query(
    `SELECT u.id, u.name, u.email, u.client_id, u.organization_name, u.role
       FROM (${USER_VIEW_SQL}) u
      WHERE u.status_key = 'active'
        AND EXISTS (SELECT 1 FROM client_contact_project_access a WHERE a.client_contact_id = u.id)
      ORDER BY u.organization_name, u.name`,
    [teamId]
  );
  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    email: row.email,
    organization_id: row.client_id,
    organization_name: row.organization_name,
    role: row.role,
  }));
}

async function subjectFor(q: Queryable, teamId: string, contactId: string) {
  const subject = await loadSubjectByContactId(q, teamId, contactId);
  if (!subject) throw notFound("Client user");
  return subject;
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

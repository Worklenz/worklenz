import { notFound } from "./errors";
import { ClientSubject } from "./subject";
import { Queryable } from "./types";

/**
 * The gating chain, in one place.
 *
 * A client user sees an item only when ALL of these hold:
 *   1. the user is Active                                  (subject.ts)
 *   2. the user is a Client Admin (every project of their client) or is assigned to the project
 *                                                          (SUBJECT_PROJECTS_SQL)
 *   3. the project's Client Portal switch is on            (SUBJECT_PROJECTS_SQL)
 *   4. the item itself is Client Visible                   (the *_CLIENT_VISIBLE_SQL fragments)
 *
 * Controllers and services must build client payloads from these, never hand-write the checks, so
 * the admin Preview (which calls the same functions with the previewed user as subject) cannot
 * drift from what a real client sees.
 */

/**
 * A Client Admin opens every project of their client automatically; a Member or Viewer only the
 * projects they are assigned to. Used wherever "who can open this project" is decided, so a role
 * change in the admin console takes effect without touching the assignments.
 */
export const CONTACT_CAN_OPEN_PROJECT_SQL = (contactId: string, projectId: string) => `(
  EXISTS (SELECT 1 FROM client_contacts adm WHERE adm.id = ${contactId} AND adm.role = 'admin')
  OR EXISTS (SELECT 1 FROM client_contact_project_access acc
              WHERE acc.client_contact_id = ${contactId} AND acc.project_id = ${projectId}))`;

/** Projects a subject can open. Parameters: $1 contact id, $2 client id, $3 team id. */
export const SUBJECT_PROJECTS_SQL = `
  SELECT p.id
    FROM projects p
    JOIN project_client_settings pcs
      ON pcs.project_id = p.id AND pcs.portal_enabled IS TRUE
   WHERE p.client_id = $2
     AND p.team_id = $3
     AND ${CONTACT_CAN_OPEN_PROJECT_SQL("$1", "p.id")}
`;

/** A task is shared only when its settings row says so. No row means Internal Only. */
export const taskClientVisibleSql = (alias = "t") => `
  (${alias}.archived IS FALSE AND EXISTS (
     SELECT 1 FROM client_portal_task_settings cts
      WHERE cts.task_id = ${alias}.id AND cts.visibility = 'client'))
`;

/** A file is shared only when active and marked Client Visible. */
export const fileClientVisibleSql = (alias = "pf") =>
  `(${alias}.status = 'active' AND ${alias}.portal_visibility = 'client')`;

/**
 * A change request belongs to the person who submitted it. A Client Admin also sees every request of their
 * client; a Member or Viewer sees only their own, so one contact's request (and its estimate cost) is not
 * shown to the rest of the project. `contactParam` and `roleParam` are SQL placeholders, e.g. "$3", "$4".
 */
export const changeRequestVisibleSql = (alias: string, contactParam: string, roleParam: string) =>
  `(${alias}.requester_contact_id = ${contactParam}::uuid OR ${roleParam}::text = 'admin')`;

export const milestoneClientVisibleSql = (alias = "m") => `(${alias}.visibility = 'client')`;

/** Ids of the projects the subject can currently open. */
export async function getSubjectProjectIds(q: Queryable, subject: ClientSubject): Promise<string[]> {
  const result = await q.query(SUBJECT_PROJECTS_SQL, [
    subject.contactId,
    subject.clientId,
    subject.teamId,
  ]);
  return result.rows.map(row => row.id as string);
}

/**
 * Throws a 404 unless the subject can open the project. It is a 404, never a 403, so a client
 * cannot tell a project they are not assigned to from one that does not exist.
 */
export async function assertSubjectProject(
  q: Queryable,
  subject: ClientSubject,
  projectId: string
): Promise<void> {
  const result = await q.query(`${SUBJECT_PROJECTS_SQL} AND p.id = $4 LIMIT 1`, [
    subject.contactId,
    subject.clientId,
    subject.teamId,
    projectId,
  ]);
  if (result.rows.length === 0) throw notFound("Project");
}

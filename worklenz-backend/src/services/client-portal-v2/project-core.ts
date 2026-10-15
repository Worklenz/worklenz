import { AuditActor, recordAuditEvent } from "./audit.service";
import { badRequest, conflict, notFound } from "./errors";
import { Queryable } from "./types";

/**
 * Operations on a project's portal state that more than one module needs: the Add Client wizard,
 * the Portal Projects list and the user Assign-projects dialog. Keeping them here guarantees the
 * rules and the audit events are identical everywhere.
 */

export interface ProjectRef {
  id: string;
  name: string;
  clientId: string | null;
  clientName: string | null;
}

export async function getProjectRef(q: Queryable, teamId: string, projectId: string): Promise<ProjectRef> {
  const result = await q.query(
    `SELECT p.id, p.name, p.client_id,
            COALESCE(NULLIF(TRIM(c.company_name), ''), c.name) AS client_name
       FROM projects p
       LEFT JOIN clients c ON c.id = p.client_id
      WHERE p.id = $1 AND p.team_id = $2`,
    [projectId, teamId]
  );
  const row = result.rows[0];
  if (!row) throw notFound("Project");
  return { id: row.id, name: row.name, clientId: row.client_id ?? null, clientName: row.client_name ?? null };
}

/**
 * Makes sure a project has a portal settings row. A project with no row is simply "portal off", so
 * rows are created lazily. The client-facing dates start from the project's own dates.
 */
export async function ensureProjectSettings(q: Queryable, teamId: string, projectId: string): Promise<void> {
  await q.query(
    `INSERT INTO project_client_settings (project_id, team_id, start_date, expected_completion)
     SELECT p.id, p.team_id, p.start_date::date, p.end_date::date
       FROM projects p
      WHERE p.id = $1 AND p.team_id = $2
     ON CONFLICT (project_id) DO NOTHING`,
    [projectId, teamId]
  );
}

/**
 * Turns the Client Portal on for a project. Only a project that belongs to a client organization can
 * be shared. Writes `Project portal enabled` only when the state actually changes.
 */
export async function enableProjectPortal(
  q: Queryable,
  input: { teamId: string; projectId: string; actor: AuditActor }
): Promise<{ changed: boolean; project: ProjectRef }> {
  const project = await getProjectRef(q, input.teamId, input.projectId);
  if (!project.clientId) {
    throw badRequest("Link this project to a client first", "PROJECT_HAS_NO_CLIENT");
  }

  await ensureProjectSettings(q, input.teamId, input.projectId);
  const updated = await q.query(
    `UPDATE project_client_settings
        SET portal_enabled = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE project_id = $1 AND portal_enabled IS FALSE
    RETURNING project_id`,
    [input.projectId]
  );

  const changed = updated.rows.length > 0;
  if (changed) {
    await recordAuditEvent(q, {
      teamId: input.teamId,
      event: "Project portal enabled",
      actor: input.actor,
      clientId: project.clientId,
      clientName: project.clientName,
      projectId: project.id,
      targetType: "project",
      targetId: project.id,
      targetLabel: project.name,
    });
  }
  return { changed, project };
}

/** Counts the Active client users assigned to a project, i.e. who loses access if it is switched off. */
export async function countActiveAssignedUsers(q: Queryable, projectId: string): Promise<number> {
  const result = await q.query(
    `SELECT COUNT(*)::int AS n
       FROM client_contact_project_access a
       JOIN client_contacts cc ON cc.id = a.client_contact_id
       JOIN client_users cu ON cu.id = cc.client_user_id
      WHERE a.project_id = $1
        AND cc.disabled_at IS NULL
        AND cc.activated_at IS NOT NULL
        AND cu.status = 'active'`,
    [projectId]
  );
  return result.rows[0]?.n ?? 0;
}

/**
 * Turns the portal off. Nothing is deleted: assignments and shared items stay, so switching it back
 * on restores everything. Clients lose access on their next request because every client request
 * re-checks the gating chain.
 */
export async function disableProjectPortal(
  q: Queryable,
  input: { teamId: string; projectId: string; actor: AuditActor }
): Promise<{ changed: boolean; affectedUsers: number; project: ProjectRef }> {
  const project = await getProjectRef(q, input.teamId, input.projectId);
  const affectedUsers = await countActiveAssignedUsers(q, input.projectId);

  const updated = await q.query(
    `UPDATE project_client_settings
        SET portal_enabled = FALSE, updated_at = CURRENT_TIMESTAMP
      WHERE project_id = $1 AND portal_enabled IS TRUE
    RETURNING project_id`,
    [input.projectId]
  );

  const changed = updated.rows.length > 0;
  if (changed) {
    await recordAuditEvent(q, {
      teamId: input.teamId,
      event: "Project portal disabled",
      actor: input.actor,
      clientId: project.clientId,
      clientName: project.clientName,
      projectId: project.id,
      targetType: "project",
      targetId: project.id,
      targetLabel: project.name,
      metadata: { affected_users: affectedUsers },
    });
  }
  return { changed, affectedUsers, project };
}

/**
 * Links a project that has no client yet to a client organization. Unlinking is not supported in
 * v1, so a project that already belongs to a different client is rejected.
 */
export async function linkProjectToClient(
  q: Queryable,
  input: { teamId: string; projectId: string; clientId: string; actor: AuditActor }
): Promise<{ changed: boolean; project: ProjectRef }> {
  const project = await getProjectRef(q, input.teamId, input.projectId);

  const client = await q.query(
    `SELECT id, COALESCE(NULLIF(TRIM(company_name), ''), name) AS name
       FROM clients WHERE id = $1 AND team_id = $2 AND deleted_at IS NULL`,
    [input.clientId, input.teamId]
  );
  if (client.rows.length === 0) throw notFound("Client");
  const clientName: string = client.rows[0].name;

  if (project.clientId === input.clientId) return { changed: false, project };
  if (project.clientId) {
    throw conflict(
      "This project already belongs to another client. Unlinking is not supported yet.",
      "PROJECT_HAS_CLIENT"
    );
  }

  await q.query(`UPDATE projects SET client_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`, [
    input.clientId,
    input.projectId,
  ]);

  await recordAuditEvent(q, {
    teamId: input.teamId,
    event: "Project linked to client",
    actor: input.actor,
    clientId: input.clientId,
    clientName,
    projectId: project.id,
    targetType: "project",
    targetId: project.id,
    targetLabel: `${project.name} · ${clientName}`,
  });

  return { changed: true, project: { ...project, clientId: input.clientId, clientName } };
}

interface ContactRef {
  id: string;
  name: string;
  clientId: string;
}

async function getContactRef(q: Queryable, teamId: string, contactId: string): Promise<ContactRef> {
  const result = await q.query(
    `SELECT id, name, client_id FROM client_contacts WHERE id = $1 AND team_id = $2`,
    [contactId, teamId]
  );
  const row = result.rows[0];
  if (!row) throw notFound("Client user");
  return { id: row.id, name: row.name, clientId: row.client_id };
}

/**
 * Assigns a client user to a project. The project must belong to the user's organization and, unless
 * `allowPortalOff` is set (the wizard switches the portal on itself), must have its portal on:
 * a portal-off project cannot be assigned. Writes `Project access assigned` only for a new assignment.
 */
export async function assignContactToProject(
  q: Queryable,
  input: { teamId: string; contactId: string; projectId: string; actor: AuditActor; allowPortalOff?: boolean }
): Promise<{ changed: boolean }> {
  const contact = await getContactRef(q, input.teamId, input.contactId);
  const project = await getProjectRef(q, input.teamId, input.projectId);

  if (project.clientId !== contact.clientId) {
    throw badRequest("This project does not belong to the user's organization", "INVALID_PROJECT");
  }

  if (!input.allowPortalOff) {
    const portal = await q.query(
      `SELECT portal_enabled FROM project_client_settings WHERE project_id = $1`,
      [input.projectId]
    );
    if (portal.rows[0]?.portal_enabled !== true) {
      throw badRequest("Client Portal is off for this project. Turn it on first.", "PORTAL_OFF");
    }
  }

  const inserted = await q.query(
    `INSERT INTO client_contact_project_access (client_contact_id, project_id, permission_level)
     VALUES ($1, $2, NULL)
     ON CONFLICT (client_contact_id, project_id) DO NOTHING
     RETURNING id`,
    [input.contactId, input.projectId]
  );

  const changed = inserted.rows.length > 0;
  if (changed) {
    await recordAuditEvent(q, {
      teamId: input.teamId,
      event: "Project access assigned",
      actor: input.actor,
      clientId: contact.clientId,
      clientName: project.clientName,
      projectId: project.id,
      targetType: "client_user",
      targetId: contact.id,
      targetLabel: `${contact.name} · ${project.name}`,
    });
  }
  return { changed };
}

/** Removes a client user's assignment. Takes effect on the client's next request. */
export async function removeContactFromProject(
  q: Queryable,
  input: { teamId: string; contactId: string; projectId: string; actor: AuditActor }
): Promise<{ changed: boolean }> {
  const contact = await getContactRef(q, input.teamId, input.contactId);
  const project = await getProjectRef(q, input.teamId, input.projectId);

  const removed = await q.query(
    `DELETE FROM client_contact_project_access
      WHERE client_contact_id = $1 AND project_id = $2
    RETURNING id`,
    [input.contactId, input.projectId]
  );

  const changed = removed.rows.length > 0;
  if (changed) {
    await recordAuditEvent(q, {
      teamId: input.teamId,
      event: "Project access removed",
      actor: input.actor,
      clientId: contact.clientId,
      clientName: project.clientName,
      projectId: project.id,
      targetType: "client_user",
      targetId: contact.id,
      targetLabel: `${contact.name} · ${project.name}`,
    });
  }
  return { changed };
}


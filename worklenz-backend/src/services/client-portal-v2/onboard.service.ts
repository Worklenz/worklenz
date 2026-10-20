import db from "../../config/db";
import {
  CLIENT_ROLE_DEFINITIONS,
  ClientContactRole,
  isClientContactRole,
} from "../../shared/client-portal-permissions";
import { ContactInviteResult, withTransaction, inviteContact } from "../client-contacts-service";
import { addContactToCompany, createCompanyWithFirstContact } from "../client-onboarding-service";
import { AuditActor, recordAuditEvent } from "./audit.service";
import { badRequest, notFound } from "./errors";
import { OrganizationView, getOrganization } from "./organizations.service";
import {
  assignContactToProject,
  enableProjectPortal,
  getProjectRef,
  linkProjectToClient,
} from "./project-core";
import { ClientUserView, getClientUser } from "./users.service";

/**
 * The Add Client wizard (Clients, Users & Access FR-12..FR-15).
 *
 * Two methods, both ending in a Project access step:
 *   new_organization       creates the organization with its first user, who is a Client Admin
 *   existing_organization  adds a user with a chosen role to an organization
 *
 * Finishing is one transaction: the user is created Invited, and for every chosen project the
 * project is linked to the client when it had none, its portal is switched on when it was off, and
 * the user is assigned. Cancelling the wizard changes nothing because nothing is written until it
 * finishes. The invitation is sent after the commit and never undoes the record.
 */

export interface AddClientInput {
  method: "new_organization" | "existing_organization";
  organization_id?: string;
  organization_name?: string;
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
  job_title?: string;
  role?: string;
  project_ids?: string[];
  send_invitation?: boolean;
}

export interface AddClientResult {
  organization: OrganizationView;
  user: ClientUserView;
  portals_switched_on: number;
  projects_linked: number;
  invite: {
    requested: boolean;
    email_sent: boolean;
    /** Set when the email could not be sent, so the operator can still share the link. */
    link: string | null;
    expires_at: string | null;
    error: string | null;
  };
}

const optionalText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export async function addClient(input: {
  teamId: string;
  invitedBy: string;
  actor: AuditActor;
  body: AddClientInput;
}): Promise<AddClientResult> {
  const { teamId, actor, body } = input;

  if (body.method !== "new_organization" && body.method !== "existing_organization") {
    throw badRequest("Choose how to add the client", "INVALID_METHOD");
  }
  if (typeof body.first_name !== "string" || !body.first_name.trim()) {
    throw badRequest("First name is required", "MISSING_FIELDS");
  }

  const projectIds = Array.from(new Set(Array.isArray(body.project_ids) ? body.project_ids : []));

  const created = await withTransaction(async tx => {
    let clientId: string;
    let contactId: string;
    let organizationName: string;
    let role: ClientContactRole;

    if (body.method === "new_organization") {
      const companyName = optionalText(body.organization_name);
      if (!companyName) throw badRequest("The organization name is required", "MISSING_FIELDS");

      const result = await createCompanyWithFirstContact(tx, {
        teamId,
        companyName,
        firstName: body.first_name,
        lastName: optionalText(body.last_name),
        email: typeof body.email === "string" ? body.email : "",
        phone: optionalText(body.phone),
        jobTitle: optionalText(body.job_title),
      });
      clientId = result.client.id;
      contactId = result.contact.id;
      organizationName = result.client.company_name ?? result.client.name;
      role = "admin"; // the first user of a new organization is always a Client Admin
    } else {
      if (!body.organization_id) throw badRequest("Choose an organization", "MISSING_FIELDS");
      role = body.role === undefined ? "member" : (body.role as ClientContactRole);
      if (!isClientContactRole(role)) throw badRequest("Role must be admin, member or viewer", "INVALID_ROLE");

      const org = await tx.query(
        `SELECT COALESCE(NULLIF(TRIM(company_name), ''), name) AS name
           FROM clients WHERE id = $1 AND team_id = $2 AND deleted_at IS NULL`,
        [body.organization_id, teamId]
      );
      if (org.rows.length === 0) throw notFound("Client");

      const contact = await addContactToCompany(tx, {
        teamId,
        clientId: body.organization_id,
        firstName: body.first_name,
        lastName: optionalText(body.last_name),
        email: typeof body.email === "string" ? body.email : "",
        phone: optionalText(body.phone),
        jobTitle: optionalText(body.job_title),
        role,
      });
      clientId = body.organization_id;
      contactId = contact.id;
      organizationName = org.rows[0].name;
    }

    const userName = [body.first_name, body.last_name]
      .map(part => (part ?? "").trim())
      .filter(Boolean)
      .join(" ");
    const roleLabel = CLIENT_ROLE_DEFINITIONS.find(definition => definition.role === role)?.label ?? role;

    await recordAuditEvent(tx, {
      teamId,
      event: "Client invited",
      actor,
      clientId,
      clientName: organizationName,
      targetType: "client_user",
      targetId: contactId,
      targetLabel: `${userName} · ${organizationName} · ${roleLabel}`,
    });

    let projectsLinked = 0;
    let portalsSwitchedOn = 0;

    for (const projectId of projectIds) {
      const project = await getProjectRef(tx, teamId, projectId);

      if (body.method === "new_organization") {
        // A new organization can only pick workspace projects that have no client yet.
        if (project.clientId !== null) {
          throw badRequest(`"${project.name}" already belongs to a client`, "INVALID_PROJECT");
        }
      } else if (project.clientId !== clientId) {
        // An existing organization lists only its own projects.
        throw badRequest(`"${project.name}" does not belong to this organization`, "INVALID_PROJECT");
      }

      // Linking a client-less project and switching its portal on happen here, in the same flow, so
      // onboarding is one step. Cancelling the wizard never reaches this point.
      const linked = await linkProjectToClient(tx, { teamId, projectId, clientId, actor });
      if (linked.changed) projectsLinked += 1;

      const enabled = await enableProjectPortal(tx, { teamId, projectId, actor });
      if (enabled.changed) portalsSwitchedOn += 1;

      await assignContactToProject(tx, { teamId, contactId, projectId, actor, allowPortalOff: true });
    }

    return { clientId, contactId, portalsSwitchedOn, projectsLinked };
  });

  let invite: AddClientResult["invite"] = {
    requested: false,
    email_sent: false,
    link: null,
    expires_at: null,
    error: null,
  };

  if (body.send_invitation !== false) {
    // Sent after the commit so a failure never undoes the user that was just created.
    try {
      const result: ContactInviteResult = await inviteContact({
        teamId,
        contactId: created.contactId,
        invitedBy: input.invitedBy,
        delivery: "email",
      });
      invite = {
        requested: true,
        email_sent: result.emailSent,
        link: result.link,
        expires_at: result.expiresAt,
        error: null,
      };
    } catch (error) {
      console.error("Could not send the invitation after saving the client user:", error);
      invite = {
        requested: true,
        email_sent: false,
        link: null,
        expires_at: null,
        error: error instanceof Error ? error.message : "Could not send the invitation",
      };
    }
  }

  return {
    organization: await getOrganization(db, teamId, created.clientId),
    user: await getClientUser(db, teamId, created.contactId),
    portals_switched_on: created.portalsSwitchedOn,
    projects_linked: created.projectsLinked,
    invite,
  };
}

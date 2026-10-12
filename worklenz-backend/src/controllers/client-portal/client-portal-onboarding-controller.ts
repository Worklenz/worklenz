import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { isValidUuid } from "../../shared/validation-helpers";
import {
  isClientContactRole,
  isClientPermissionLevel,
} from "../../shared/client-portal-permissions";
import {
  ContactInviteResult,
  InviteDelivery,
  ProjectAccessInput,
  inviteContact,
  loadContactView,
  withTransaction,
} from "../../services/client-contacts-service";
import {
  addContactToCompany,
  commitImport,
  createCompanyWithFirstContact,
  postWelcomeMessage,
  validateImport,
} from "../../services/client-onboarding-service";
import { badRequest, handleContactError, unauthenticated } from "./client-contacts-http";

interface InviteOutcome {
  requested: boolean;
  delivery: InviteDelivery;
  email_sent: boolean;
  /** Set for delivery "link", or when the email could not be sent, so it can still be shared. */
  link: string | null;
  expires_at: string | null;
  /** Why the invitation could not be created. The record itself was still saved. */
  error: string | null;
}

const NOT_REQUESTED: InviteOutcome = {
  requested: false,
  delivery: "email",
  email_sent: false,
  link: null,
  expires_at: null,
  error: null,
};

/** Sends the invitation after the record is committed. A failure never undoes the record. */
async function sendInviteIfRequested(input: {
  requested: boolean;
  delivery: InviteDelivery;
  teamId: string;
  contactId: string;
  invitedBy: string;
}): Promise<InviteOutcome> {
  if (!input.requested) return NOT_REQUESTED;

  try {
    const result: ContactInviteResult = await inviteContact({
      teamId: input.teamId,
      contactId: input.contactId,
      invitedBy: input.invitedBy,
      delivery: input.delivery,
    });

    return {
      requested: true,
      delivery: result.delivery,
      email_sent: result.emailSent,
      link: result.link,
      expires_at: result.expiresAt,
      error: null,
    };
  } catch (error) {
    console.error("Could not send the invitation after saving the record:", error);
    return {
      ...NOT_REQUESTED,
      requested: true,
      delivery: input.delivery,
      error: error instanceof Error ? error.message : "Could not send the invitation",
    };
  }
}

const optionalText = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const readDelivery = (value: unknown): InviteDelivery => (value === "link" ? "link" : "email");

function parseProjectAccess(value: unknown): ProjectAccessInput[] | null {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) return null;

  const access: ProjectAccessInput[] = [];
  for (const item of value) {
    const projectId = item?.project_id;
    if (typeof projectId !== "string" || !isValidUuid(projectId) || !isClientPermissionLevel(item?.level)) {
      return null;
    }
    access.push({ projectId, level: item.level });
  }
  return access;
}

/**
 * The Add Client wizard's writes: a new company with its first contact, a user added to an
 * existing company, and the CSV import.
 */
export default class ClientPortalOnboardingController {
  /**
   * POST /portal/clients/onboard
   * Creates the company and its first contact (the POC) in one transaction. Inviting and the
   * welcome message happen afterwards and never undo the record.
   */
  static async onboard(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const teamId = req.user?.team_id;
      const userId = req.user?.id;
      if (!teamId || !userId) return unauthenticated(res);

      const body = req.body ?? {};
      if (typeof body.first_name !== "string" || !body.first_name.trim()) {
        return badRequest(res, "First name is required");
      }

      const created = await withTransaction((tx) =>
        createCompanyWithFirstContact(tx, {
          teamId,
          companyName: optionalText(body.company_name),
          firstName: body.first_name,
          lastName: optionalText(body.last_name),
          email: typeof body.email === "string" ? body.email : "",
          phone: optionalText(body.phone),
          jobTitle: optionalText(body.job_title),
        })
      );

      const invite = await sendInviteIfRequested({
        requested: body.send_invite === true,
        delivery: readDelivery(body.delivery),
        teamId,
        contactId: created.contact.id,
        invitedBy: userId,
      });

      const welcomeText = optionalText(body.welcome_message);
      const welcomePosted = welcomeText
        ? await postWelcomeMessage({ teamId, clientId: created.client.id, userId, text: welcomeText })
        : false;

      return res.status(201).json(
        new ServerResponse(
          true,
          {
            client: created.client,
            user: await loadContactView(teamId, created.contact.id),
            invite,
            welcome_message_posted: welcomePosted,
          },
          "Client added"
        )
      );
    } catch (error) {
      return handleContactError(res, error, "Failed to add the client");
    }
  }

  /**
   * POST /portal/clients/:id/company-users
   * Adds a user to an existing company, optionally as a POC and with per-project access.
   */
  static async addCompanyUser(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const teamId = req.user?.team_id;
      const userId = req.user?.id;
      if (!teamId || !userId) return unauthenticated(res);

      const body = req.body ?? {};
      if (typeof body.first_name !== "string" || !body.first_name.trim()) {
        return badRequest(res, "First name is required");
      }
      if (body.role !== undefined && !isClientContactRole(body.role)) {
        return badRequest(res, "Role must be 'poc' or 'member'");
      }

      const projectAccess = parseProjectAccess(body.project_access);
      if (projectAccess === null) {
        return badRequest(res, "Each project needs a valid project_id and level");
      }

      const contact = await withTransaction((tx) =>
        addContactToCompany(tx, {
          teamId,
          clientId: req.params.id,
          firstName: body.first_name,
          lastName: optionalText(body.last_name),
          email: typeof body.email === "string" ? body.email : "",
          phone: optionalText(body.phone),
          jobTitle: optionalText(body.job_title),
          role: body.role === "poc" ? "poc" : "member",
          projectAccess,
        })
      );

      const invite = await sendInviteIfRequested({
        requested: body.send_invite === true,
        delivery: readDelivery(body.delivery),
        teamId,
        contactId: contact.id,
        invitedBy: userId,
      });

      return res.status(201).json(
        new ServerResponse(
          true,
          { user: await loadContactView(teamId, contact.id), invite },
          "Company user added"
        )
      );
    } catch (error) {
      return handleContactError(res, error, "Failed to add the company user");
    }
  }

  /** POST /portal/clients/import/validate  body: { rows } — a dry run, nothing is written. */
  static async importValidate(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const teamId = req.user?.team_id;
      if (!teamId) return unauthenticated(res);

      return res.json(new ServerResponse(true, await validateImport(teamId, req.body?.rows), null));
    } catch (error) {
      return handleContactError(res, error, "Failed to check the file");
    }
  }

  /** POST /portal/clients/import  body: { rows } — imports every valid row, skipping the rest. */
  static async importCommit(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const teamId = req.user?.team_id;
      if (!teamId) return unauthenticated(res);

      return res.json(new ServerResponse(true, await commitImport(teamId, req.body?.rows), "Import finished"));
    } catch (error) {
      return handleContactError(res, error, "Failed to import the file");
    }
  }
}

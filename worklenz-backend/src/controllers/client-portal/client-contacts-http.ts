import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { CONTACT_ERROR_HTTP_STATUS, ContactServiceError } from "../../services/client-contacts-service";

/** Response helpers shared by the company-user controllers. */

export function unauthenticated(res: IWorkLenzResponse) {
  return res.status(401).json(new ServerResponse(false, null, "Authentication required"));
}

export function notFound(res: IWorkLenzResponse, what = "Company user") {
  return res.status(404).json(new ServerResponse(false, null, `${what} not found`));
}

export function badRequest(res: IWorkLenzResponse, message: string) {
  return res.status(400).json(new ServerResponse(false, null, message));
}

/**
 * Maps an expected ContactServiceError to its HTTP status. A unique-constraint violation that got
 * past the pre-checks (two requests racing) becomes the same 409 the pre-check would have given.
 * Anything else is a 500 with a generic message.
 */
export function handleContactError(res: IWorkLenzResponse, error: unknown, fallbackMessage: string) {
  if (error instanceof ContactServiceError) {
    return res
      .status(CONTACT_ERROR_HTTP_STATUS[error.code])
      .json(new ServerResponse(false, error.details ?? null, error.message));
  }

  const dbError = error as { code?: string; constraint?: string } | undefined;
  if (dbError?.code === "23505") {
    if (dbError.constraint?.includes("client_contacts_team_email")) {
      return res
        .status(409)
        .json(new ServerResponse(false, null, "That email address is already used by another company user"));
    }
    if (dbError.constraint?.includes("clients_name")) {
      return res
        .status(409)
        .json(new ServerResponse(false, null, "A client with that name already exists"));
    }
  }

  console.error(fallbackMessage, error);
  return res.status(500).json(new ServerResponse(false, null, fallbackMessage));
}

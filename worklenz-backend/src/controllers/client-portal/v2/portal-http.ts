import { IWorkLenzRequest } from "../../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../../interfaces/worklenz-response";
import { ServerResponse } from "../../../models/server-response";
import { CONTACT_ERROR_HTTP_STATUS, ContactServiceError } from "../../../services/client-contacts-service";
import { AuditActor } from "../../../services/client-portal-v2/audit.service";
import { PortalError, badRequest } from "../../../services/client-portal-v2/errors";

/**
 * HTTP helpers for the Client Portal v2 controllers. They follow the client-portal controllers rather
 * than the main app's @HandleExceptions: real status codes (400/403/404/409), not an always-200 body.
 */

export const ok = <T>(res: IWorkLenzResponse, body: T, message: string | null = null, status = 200) =>
  res.status(status).json(new ServerResponse(true, body, message));

/**
 * Maps an expected failure to its status. A PortalError carries its own; a ContactServiceError maps
 * through the contact table; a unique violation that slipped past a pre-check becomes a 409. Anything
 * else is logged and answers a generic 500 so internals never reach the client.
 */
export function handlePortalError(res: IWorkLenzResponse, error: unknown, fallbackMessage: string) {
  if (error instanceof PortalError) {
    return res
      .status(error.status)
      .json(new ServerResponse(false, { code: error.code, ...(error.details ?? {}) }, error.message));
  }

  if (error instanceof ContactServiceError) {
    return res
      .status(CONTACT_ERROR_HTTP_STATUS[error.code])
      .json(new ServerResponse(false, { code: error.code, ...(error.details ?? {}) }, error.message));
  }

  const dbError = error as { code?: string; constraint?: string } | undefined;
  if (dbError?.code === "23505") {
    return res.status(409).json(new ServerResponse(false, { code: "DUPLICATE" }, "That already exists"));
  }
  if (dbError?.code === "22P02") {
    // invalid_text_representation, e.g. a malformed UUID that slipped past validation.
    return res.status(400).json(new ServerResponse(false, { code: "BAD_REQUEST" }, "Invalid request"));
  }

  console.error(fallbackMessage, error);
  return res.status(500).json(new ServerResponse(false, null, fallbackMessage));
}

/** Wraps a handler so any thrown error is turned into the right response. */
export const portalHandler =
  (fallbackMessage: string, fn: (req: IWorkLenzRequest, res: IWorkLenzResponse) => Promise<unknown>) =>
  async (req: IWorkLenzRequest, res: IWorkLenzResponse) => {
    try {
      await fn(req, res);
    } catch (error) {
      handlePortalError(res, error, fallbackMessage);
    }
  };

export interface StaffContext {
  teamId: string;
  userId: string;
  /** The signed-in staff member's team member id, when known. */
  memberId: string | null;
  actor: AuditActor;
}

/** The signed-in staff member. Routes are already behind login; this narrows the optional fields. */
export function staffContext(req: IWorkLenzRequest): StaffContext {
  const teamId = req.user?.team_id;
  const userId = req.user?.id;
  if (!teamId || !userId) throw new PortalError(401, "Authentication required", "UNAUTHENTICATED");
  return {
    teamId,
    userId,
    memberId: req.user?.team_member_id ?? null,
    actor: { side: "internal", name: req.user?.name || "Team member", userId },
  };
}

// Any 8-4-4-4-12 hex id, not only v4: Postgres accepts them all, and seeded or imported rows can carry other versions.
const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A UUID route parameter, or a 400. */
export function uuidParam(req: IWorkLenzRequest, name: string): string {
  const value = req.params[name];
  if (typeof value !== "string" || !UUID_SHAPE.test(value)) throw badRequest(`Invalid ${name}`, "INVALID_ID");
  return value;
}

export const asString = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

export const asNumber = (value: unknown): number | undefined => {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/** The request body as a plain object, so handlers can read fields without trusting its shape. */
export const bodyOf = (req: IWorkLenzRequest): Record<string, any> =>
  req.body && typeof req.body === "object" && !Array.isArray(req.body) ? (req.body as Record<string, any>) : {};

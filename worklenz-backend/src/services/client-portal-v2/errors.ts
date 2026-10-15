/**
 * Expected, user-facing failures in Client Portal v2 services. Controllers turn them into the HTTP
 * status they carry; anything else is an unexpected error and answers 500.
 */
export class PortalError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string = "PORTAL_ERROR",
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "PortalError";
  }
}

export const badRequest = (message: string, code = "BAD_REQUEST", details?: Record<string, unknown>) =>
  new PortalError(400, message, code, details);

export const forbidden = (message: string, code = "FORBIDDEN") => new PortalError(403, message, code);

export const notFound = (what: string) => new PortalError(404, `${what} not found`, "NOT_FOUND");

export const conflict = (message: string, code = "CONFLICT", details?: Record<string, unknown>) =>
  new PortalError(409, message, code, details);

import { createHmac, timingSafeEqual } from "crypto";
import { getJwtSecret } from "./jwt-secret";

// The code is valid only while the corresponding invitation remains unclaimed in the database.
export function createRegistrationInvitationToken(team: string, member: string, email: string, invitationId: string): string {
  return createHmac("sha256", getJwtSecret())
    .update(JSON.stringify(["registration-invitation", team, member, email.trim().toLowerCase(), invitationId]))
    .digest("base64url");
}

export function verifyRegistrationInvitationToken(token: unknown, team: string, member: string, email: string, invitationId: string): boolean {
  if (typeof token !== "string" || typeof team !== "string" || typeof member !== "string" || typeof email !== "string" || typeof invitationId !== "string" || !invitationId) return false;
  const supplied = Buffer.from(token.trim());
  const expected = Buffer.from(createRegistrationInvitationToken(team, member, email, invitationId));
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

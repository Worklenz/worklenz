import crypto from "crypto";
import db from "../../config/db";
import { EmailRequest, sendEmailEnhanced } from "../../shared/email";
import {
  isValidContactEmail,
  linkContactToLogin,
  normalizeContactEmail,
  withTransaction,
} from "../client-contacts-service";
import { getSignInCodeKey } from "../../shared/jwt-secret";
import TokenService from "../token-service";
import { PortalError, badRequest } from "./errors";
import { Queryable } from "./types";

/**
 * Client sign-in. There are no passwords and no sign-in settings: a person receives a one-time code at
 * an email address that the team (or a Client Admin) has added to the portal, then types it in.
 *
 *   - from the emailed invitation / magic link, which carries the invited address, or
 *   - by typing their address on the sign-in page.
 *
 * Codes are 6 digits, valid for 10 minutes, single use, and stop working after 5 wrong guesses. Only an
 * HMAC of the code is stored. Requesting a code answers the same way whether or not the address has
 * access, so the sign-in page cannot be used to find out who is a client.
 */

export const CODE_LENGTH = 6;
export const CODE_TTL_MINUTES = 10;
export const MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_SECONDS = 60;
/** Codes one address (typed from one IP) can ask for per hour. */
export const MAX_CODES_PER_HOUR = 5;
/**
 * Ceiling across all IPs for one address, so email-bombing a victim is bounded. It is deliberately much
 * higher than the per-IP budget: one machine cannot use up the victim's own budget.
 */
export const MAX_CODES_PER_ADDRESS_PER_HOUR = 30;

/** Stored for an address with no access: it never equals a hex digest, so the code can never verify. */
const UNUSABLE_HASH = "-";

const SESSION_HOURS = 24;

export interface SignInTarget {
  contact_id: string;
  team_id: string;
  client_id: string;
  name: string;
  team_name: string | null;
}

export interface SignInCodeResult {
  email: string;
  masked_email: string;
  expires_in_seconds: number;
  resend_after_seconds: number;
  organization_name: string | null;
}

export interface ClientSession {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    clientId: string;
    organizationId: string;
    clientName: string | null;
    companyName: string | null;
    organizations: Array<{ id: string; name: string; teamId: string; clientId: string; isDefault: boolean }>;
  };
  expiresAt: string;
}

/** Addresses are matched case-insensitively, so everything is compared lowercased. */
const normalise = (email: string): string => normalizeContactEmail(email).toLowerCase();

const invalidCode = () =>
  new PortalError(
    400,
    "That code is incorrect or has expired. Check the code, or request a new one.",
    "INVALID_CODE"
  );


export const hashCode = (email: string, code: string): string =>
  crypto.createHmac("sha256", getSignInCodeKey()).update(`client-sign-in:${email}:${code}`).digest("hex");

const generateCode = (): string =>
  crypto.randomInt(0, 10 ** CODE_LENGTH).toString().padStart(CODE_LENGTH, "0");

/** j***@brandbase.com */
export function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local.slice(0, 1)}***@${domain}`;
}

/**
 * The company users this address can sign in as: an added contact whose access has not been disabled,
 * at a company that is not deactivated and whose portal access is not switched off.
 */
export async function findSignInTargets(q: Queryable, email: string): Promise<SignInTarget[]> {
  const result = await q.query(
    `SELECT cc.id AS contact_id, cc.team_id, cc.client_id, cc.name, t.name AS team_name
       FROM client_contacts cc
       JOIN clients c ON c.id = cc.client_id AND c.deleted_at IS NULL
       LEFT JOIN teams t ON t.id = cc.team_id
      WHERE LOWER(cc.email) = $1
        AND cc.disabled_at IS NULL
        AND c.status <> 'inactive'
        -- A person who deleted their account is gone for the 30 days before support purges it.
        AND NOT EXISTS (SELECT 1 FROM client_users du WHERE LOWER(du.email) = LOWER(cc.email) AND du.deleted_at IS NOT NULL)
        AND COALESCE((SELECT cpa.is_active FROM client_portal_access cpa WHERE cpa.client_id = c.id LIMIT 1), TRUE)
      ORDER BY cc.created_at, cc.id`,
    [email]
  );
  return result.rows as SignInTarget[];
}

/**
 * The sign-in email is a fixed template. Nothing a workspace owner controls (team name, contact name) is
 * put in it: the message is sent from Worklenz's own sender to an address the requester only has to type,
 * so a custom name would let it be used as a branded phishing or spam relay.
 */
async function sendCodeEmail(email: string, code: string): Promise<boolean> {
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1f1f1f">
      <h2 style="margin:0 0 16px;font-size:20px">Your sign-in code</h2>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.5">
        Use this code to sign in to your Worklenz client portal.
      </p>
      <p style="margin:0 0 16px;font-size:32px;font-weight:700;letter-spacing:8px">${code}</p>
      <p style="margin:0;font-size:13px;line-height:1.5;color:#595959">
        It expires in ${CODE_TTL_MINUTES} minutes and works once. If you did not try to sign in, you can ignore this email.
      </p>
    </div>`;

  const result = await sendEmailEnhanced(new EmailRequest([email], `${code} is your sign-in code`, html));
  if (!result.success) console.error("Failed to send the client sign-in code:", result.error);
  return result.success;
}

/**
 * Sends a sign-in code. `inviteToken` is the emailed invitation / magic link: it names the address, so
 * the person does not type it, and an expired or replaced link is reported. Without it the caller types
 * the address and always gets the same answer.
 */
export async function requestSignInCode(input: {
  email?: string;
  inviteToken?: string;
  ip?: string | null;
}): Promise<SignInCodeResult> {
  let email: string;
  let invitationId: string | null = null;
  let organizationName: string | null = null;

  if (input.inviteToken) {
    const invitation = await TokenService.getInvitationByToken(input.inviteToken);
    if (!invitation) {
      throw new PortalError(
        404,
        "This link is no longer valid. Ask your project team for a new one, or sign in with your email address.",
        "LINK_INVALID"
      );
    }
    email = normalise(invitation.email);
    invitationId = invitation.id;
    organizationName = invitation.company_name || invitation.client_name || null;
  } else {
    const typed = typeof input.email === "string" ? normalise(input.email) : "";
    if (!isValidContactEmail(typed)) throw badRequest("Enter a valid email address", "INVALID_EMAIL");
    email = typed;
  }

  const ip = input.ip ?? null;

  const result: SignInCodeResult = {
    email,
    masked_email: maskEmail(email),
    expires_in_seconds: CODE_TTL_MINUTES * 60,
    resend_after_seconds: RESEND_COOLDOWN_SECONDS,
    organization_name: organizationName,
  };

  const outcome = await withTransaction(async tx => {
    // Serialises requests for one address, so concurrent requests cannot all pass the checks below.
    await tx.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [email]);

    // The budget and the cooldown are counted per address AND requesting IP: one machine cannot use up
    // (or sit in the cooldown of) a victim's address. A higher ceiling per address bounds email-bombing.
    const recent = await tx.query(
      `SELECT COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour')::int AS last_hour,
              COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour'
                                 AND requested_ip IS NOT DISTINCT FROM $2)::int AS last_hour_ip,
              EXTRACT(EPOCH FROM (NOW() - MAX(created_at) FILTER (WHERE requested_ip IS NOT DISTINCT FROM $2)))::int
                AS seconds_since_last
         FROM client_login_codes
        WHERE email = $1`,
      [email, ip]
    );
    const lastHour: number = recent.rows[0]?.last_hour ?? 0;
    const lastHourFromIp: number = recent.rows[0]?.last_hour_ip ?? 0;
    const secondsSinceLast: number | null = recent.rows[0]?.seconds_since_last ?? null;

    if (lastHourFromIp >= MAX_CODES_PER_HOUR || lastHour >= MAX_CODES_PER_ADDRESS_PER_HOUR) {
      throw new PortalError(429, "Too many codes were requested. Try again in a little while.", "TOO_MANY_CODES");
    }

    // A second request right after the first (an email scanner opening the link, a double click) keeps
    // the code that is already on its way instead of replacing it.
    if (secondsSinceLast !== null && secondsSinceLast < RESEND_COOLDOWN_SECONDS) {
      return { result: { ...result, resend_after_seconds: RESEND_COOLDOWN_SECONDS - secondsSinceLast }, send: null };
    }

    const targets = await findSignInTargets(tx, email);
    if (input.inviteToken && targets.length === 0) {
      throw new PortalError(
        403,
        "Your access is not available right now. Please contact your project team.",
        "ACCESS_UNAVAILABLE"
      );
    }

    const code = generateCode();
    await tx.query(`UPDATE client_login_codes SET consumed_at = NOW() WHERE email = $1 AND consumed_at IS NULL`, [email]);
    await tx.query(
      `INSERT INTO client_login_codes (email, code_hash, invitation_id, expires_at, requested_ip)
       VALUES ($1, $2, $3, NOW() + INTERVAL '${CODE_TTL_MINUTES} minutes', $4)`,
      [email, targets.length ? hashCode(email, code) : UNUSABLE_HASH, invitationId, ip]
    );

    return {
      result,
      send: targets.length ? { code } : null,
    };
  });

  if (outcome.send) {
    const { code } = outcome.send;
    if (input.inviteToken) {
      // Only a person holding the invitation link is told when the email failed.
      const sent = await sendCodeEmail(email, code);
      if (!sent) throw new PortalError(502, "We could not send the code. Try again in a moment.", "EMAIL_FAILED");
    } else {
      // For a typed address the answer (and its timing) must not differ between addresses, so the send
      // happens off the request path and a failure is only logged.
      void sendCodeEmail(email, code).catch(error =>
        console.error("Failed to send the client sign-in code:", error)
      );
    }
  }

  return outcome.result;
}

/** Checks a code and, when it is right, signs the person in. */
export async function verifySignInCode(input: { email: string; code: string }): Promise<ClientSession> {
  const email = normalise(typeof input.email === "string" ? input.email : "");
  const code = typeof input.code === "string" ? input.code.trim() : "";
  if (!isValidContactEmail(email) || !new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code)) throw invalidCode();

  const found = await db.query(
    `SELECT id
       FROM client_login_codes
      WHERE email = $1 AND consumed_at IS NULL AND expires_at > NOW()
      ORDER BY created_at DESC
      LIMIT 1`,
    [email]
  );
  const row = found.rows[0];
  if (!row) throw invalidCode();

  // Every guess is claimed atomically BEFORE the comparison, so N concurrent requests cannot all see
  // "attempts = 0": at most MAX_ATTEMPTS guesses are ever compared per code.
  const claimed = await db.query(
    `UPDATE client_login_codes
        SET attempts = attempts + 1
      WHERE id = $1 AND consumed_at IS NULL AND expires_at > NOW() AND attempts < $2
  RETURNING code_hash, attempts`,
    [row.id, MAX_ATTEMPTS]
  );
  const claim = claimed.rows[0];
  if (!claim) throw invalidCode();

  const expected = Buffer.from(hashCode(email, code));
  const stored = Buffer.from(String(claim.code_hash));
  const matches = stored.length === expected.length && crypto.timingSafeEqual(stored, expected);

  if (!matches) {
    // The last allowed guess also retires the code, so it cannot be tried again.
    if (claim.attempts >= MAX_ATTEMPTS) {
      await db.query(`UPDATE client_login_codes SET consumed_at = NOW() WHERE id = $1 AND consumed_at IS NULL`, [row.id]);
    }
    throw invalidCode();
  }

  // Single use: only one concurrent verification can consume the code.
  const consumed = await db.query(
    `UPDATE client_login_codes SET consumed_at = NOW() WHERE id = $1 AND consumed_at IS NULL RETURNING id`,
    [row.id]
  );
  if (!consumed.rows.length) throw invalidCode();

  return completeSignIn(email);
}

/**
 * Links a verified login to every company user at its address: a membership per portal, the contact
 * tied to the login, pending invitations accepted and pending companies activated. Shared by the code
 * sign-in and by accepting an invitation while already signed in.
 */
async function linkLoginToTargets(
  tx: Queryable,
  input: { loginId: string; email: string; targets: SignInTarget[] }
): Promise<void> {
  const { loginId, email, targets } = input;
  for (const target of targets) {
    await tx.query(
      `INSERT INTO client_user_organizations (client_user_id, team_id, client_id, is_default, created_at, updated_at)
       SELECT $1, $2, $3,
              NOT EXISTS (SELECT 1 FROM client_user_organizations WHERE client_user_id = $1 AND is_default),
              NOW(), NOW()
       ON CONFLICT (client_user_id, team_id) DO UPDATE SET client_id = EXCLUDED.client_id, updated_at = NOW()`,
      [loginId, target.team_id, target.client_id]
    );
    await linkContactToLogin(tx, {
      teamId: target.team_id,
      clientId: target.client_id,
      clientUserId: loginId,
      email,
      name: target.name,
      contactId: target.contact_id,
    });
  }

  await tx.query(
    `UPDATE client_invitations
        SET status = 'accepted', accepted_at = NOW(), updated_at = NOW()
      WHERE status = 'pending'
        AND (client_contact_id = ANY($1::uuid[]) OR (client_contact_id IS NULL AND LOWER(email) = $2))`,
    [targets.map(target => target.contact_id), email]
  );
  await tx.query(
    `UPDATE clients SET status = 'active', updated_at = NOW() WHERE id = ANY($1::uuid[]) AND status = 'pending'`,
    [targets.map(target => target.client_id)]
  );
}

/**
 * Turns a verified address into a session. The first successful sign-in activates the person: their
 * login is created, every company user at this address is linked to it, the invitation is marked
 * accepted, and the activation is audited (an Invited user becomes Active).
 */
async function completeSignIn(email: string): Promise<ClientSession> {
  const { login, targets } = await withTransaction(async tx => {
    const targets = await findSignInTargets(tx, email);
    // Access was removed between asking for the code and typing it.
    if (targets.length === 0) throw invalidCode();
    const first = targets[0];

    const existing = await tx.query(
      `SELECT id, name, role, status FROM client_users WHERE LOWER(email) = $1 AND deleted_at IS NULL FOR UPDATE`,
      [email]
    );

    let login = existing.rows[0] as { id: string; name: string; role: string; status: string } | undefined;
    if (login) {
      if (login.status !== "active" && login.status !== "pending") throw invalidCode();
      if (login.status === "pending") {
        await tx.query(`UPDATE client_users SET status = 'active', updated_at = NOW() WHERE id = $1`, [login.id]);
      }
    } else {
      const created = await tx.query(
        `INSERT INTO client_users (client_id, email, name, role, team_id, status, created_at, updated_at)
         VALUES ($1, $2, $3, 'member', $4, 'active', NOW(), NOW())
         RETURNING id, name, role, status`,
        [first.client_id, email, first.name || email.split("@")[0], first.team_id]
      );
      login = created.rows[0];
    }

    await linkLoginToTargets(tx, { loginId: login!.id, email, targets });

    return { login: login!, targets };
  });

  // Only organisations the person can still use go into the session.
  const organizations = (await TokenService.getClientUserOrganizations(login.id)).filter(org =>
    targets.some(target => target.client_id === org.clientId)
  );
  const current = organizations.find(org => org.isDefault) ?? organizations[0];
  if (!current) throw invalidCode();

  const company = await db.query(`SELECT name, company_name FROM clients WHERE id = $1`, [current.clientId]);

  const token = TokenService.generateClientToken({
    clientId: current.clientId,
    organizationId: current.teamId,
    clientUserId: login.id,
    email,
    permissions: await TokenService.getClientPermissions(current.clientId),
    availableOrganizations: TokenService.toTokenOrganizations(organizations),
    type: "client",
  });

  await db.query(`UPDATE client_users SET last_login = NOW() WHERE id = $1`, [login.id]);
  await TokenService.updateOrganizationAccess(login.id, current.teamId);

  return {
    token,
    user: {
      id: login.id,
      email,
      name: login.name,
      role: login.role,
      clientId: current.clientId,
      organizationId: current.teamId,
      clientName: company.rows[0]?.name ?? null,
      companyName: company.rows[0]?.company_name ?? null,
      organizations,
    },
    expiresAt: new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString(),
  };
}

/** The portal a signed-in person just joined through an invitation link, with a session for it. */
export interface AcceptedInvite {
  token: string;
  organizationId: string;
  clientId: string;
  organizationName: string | null;
  expiresAt: string;
}

/**
 * Accepts an emailed invitation for someone who is ALREADY signed in, with no code. The invitation link
 * proves they were invited and the live session proves the address is theirs, so the two must name the
 * same address: a link for another address is refused (they sign out and use it instead).
 */
export async function acceptInviteWhileSignedIn(input: {
  clientUserId: string;
  sessionEmail: string;
  inviteToken: string;
}): Promise<AcceptedInvite> {
  const invitation = await TokenService.getInvitationByToken(input.inviteToken);
  if (!invitation) {
    throw new PortalError(
      404,
      "This link is no longer valid. Ask your project team for a new one.",
      "LINK_INVALID"
    );
  }

  const email = normalise(invitation.email);
  if (email !== normalise(input.sessionEmail)) {
    throw new PortalError(
      403,
      "This invitation was sent to a different email address than the one you are signed in with.",
      "EMAIL_MISMATCH"
    );
  }

  await withTransaction(async tx => {
    const login = await tx.query(
      `SELECT id FROM client_users
        WHERE id = $1 AND LOWER(email) = $2 AND status = 'active' AND deleted_at IS NULL
        FOR UPDATE`,
      [input.clientUserId, email]
    );
    if (!login.rows[0]) throw new PortalError(401, "Please sign in again.", "SESSION_INVALID");

    const targets = await findSignInTargets(tx, email);
    if (!targets.some(target => target.client_id === invitation.client_id)) {
      throw new PortalError(
        403,
        "Your access is not available right now. Please contact your project team.",
        "ACCESS_UNAVAILABLE"
      );
    }
    await linkLoginToTargets(tx, { loginId: input.clientUserId, email, targets });
  });

  const organizations = await TokenService.getClientUserOrganizations(input.clientUserId);
  const joined = organizations.find(org => org.clientId === invitation.client_id);
  if (!joined) {
    throw new PortalError(
      403,
      "Your access is not available right now. Please contact your project team.",
      "ACCESS_UNAVAILABLE"
    );
  }

  const token = TokenService.generateClientToken({
    clientId: joined.clientId,
    organizationId: joined.teamId,
    clientUserId: input.clientUserId,
    email,
    permissions: await TokenService.getClientPermissions(joined.clientId),
    availableOrganizations: TokenService.toTokenOrganizations(organizations),
    type: "client",
  });
  await TokenService.updateOrganizationAccess(input.clientUserId, joined.teamId);

  return {
    token,
    organizationId: joined.teamId,
    clientId: joined.clientId,
    organizationName: joined.portalTitle || joined.clientName || null,
    expiresAt: new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000).toISOString(),
  };
}

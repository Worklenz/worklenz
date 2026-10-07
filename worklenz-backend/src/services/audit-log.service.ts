import db from "../config/db";
import { log_error } from "../shared/utils";
import { IPassportSession } from "../interfaces/passport-session";
import {
  AUDIT_EVENT_TYPE,
  AuditEventCategoryId,
  AuditEventTypeId,
  getCategoryForEventType,
  isValidAuditEventType,
} from "../shared/audit-log-constants";

/**
 * Write path for the workspace-wide Audit Log (Admin Center > Security > Audit Log).
 * Audit log spec, tasks 2.1 and 2.2.
 *
 * Writes land in `audit_events` (see
 * database/pg-migrations/1791193625587_create-audit-events-table.js), which is append-only
 * at the DB level - this module only ever INSERTs, never UPDATEs/DELETEs.
 */

export interface AuditActor {
  /** The acting user's id, when known. Use null for system-initiated events. */
  userId: string | null;
  /**
   * Display-name snapshot at the time of the event. Always required (not derived from
   * userId at write time) so the entry stays attributable even after the user is later
   * removed from the workspace or the account is deleted (actor_user_id is ON DELETE SET
   * NULL on the users FK - see the migration above).
   */
  name: string;
}

export interface LogAuditEventParams {
  /**
   * The organization ("workspace") this event belongs to. Admin Center > Security > Audit
   * Log is organization-wide, not per-team - see the scope decision documented in
   * 1791193625587_create-audit-events-table.js.
   */
  organizationId: string;
  /** The specific team the event happened in, when applicable. Omit/null for org-wide events
   * (e.g. workspace renamed/deleted, org-level settings changes). */
  teamId?: string | null;
  actor: AuditActor;
  /**
   * One of the catalogued event types in shared/audit-log-constants.ts. The category is
   * derived from this automatically (every event type belongs to exactly one category), so
   * callers cannot pass a mismatched category/eventType pair.
   */
  eventType: AuditEventTypeId;
  /**
   * Human-readable summary, e.g. "Role changed from Member to Admin". Falls back to the
   * event type's default label when omitted, so every row is always readable even when a
   * caller doesn't construct a custom sentence (per the spec's own acknowledgment that
   * old/new value capture isn't feasible for every event type).
   */
  description?: string;
  oldValue?: string | null;
  newValue?: string | null;
}

/** Builds an {@link AuditActor} from the authenticated session user already attached to
 * `req.user`, for the common case of logging an action a logged-in user just took. */
export function actorFromSessionUser(user: IPassportSession): AuditActor {
  return {
    userId: user.id ?? null,
    name: user.name?.trim() || user.email || "Unknown user",
  };
}

/**
 * Records a workspace-wide audit log entry.
 *
 * Non-blocking by design: this function returns immediately -
 * synchronously, before any validation or DB work runs - and never throws. The actual write
 * is deferred to a later microtask and fully error-isolated, mirroring the existing
 * "fire email in background, never let it affect the response" pattern already used for
 * password-reset emails (see AuthController.reset_password in auth-controller.ts). A failed
 * or slow audit write must never add latency to, break, or roll back the user action it's
 * recording.
 *
 * Durability note: this is fire-and-forget, not a durable queue. If the process crashes
 * between this call and the INSERT completing, that one entry can be lost. A persistent
 * outbox/queue would close that gap; explicitly out of scope for this pass per spike 0.3,
 * which calls for "queue or fire-and-forget" and this codebase has no queue infrastructure
 * (no Bull/BullMQ/etc.) to build on without introducing new infra as a side effect of this
 * task.
 */
export function logAuditEvent(params: LogAuditEventParams): void {
  // queueMicrotask defers *everything*, including input validation, off the caller's call
  // stack - logAuditEvent() always returns in O(1) with zero work done on the hot path.
  queueMicrotask(() => {
    writeAuditEvent(params).catch(() => {
      // writeAuditEvent already catches and logs internally; this is a last-resort net so an
      // unexpected throw inside the catch/logging path itself still can't produce an
      // unhandled promise rejection.
    });
  });
}

async function writeAuditEvent(params: LogAuditEventParams): Promise<void> {
  try {
    if (!params.organizationId) {
      throw new Error("logAuditEvent: organizationId is required");
    }
    if (!params.actor?.name) {
      throw new Error("logAuditEvent: actor.name is required");
    }
    if (!isValidAuditEventType(params.eventType)) {
      throw new Error(`logAuditEvent: unknown eventType "${params.eventType}"`);
    }

    const category: AuditEventCategoryId = getCategoryForEventType(params.eventType);
    const description = params.description?.trim() || defaultDescriptionFor(params.eventType);

    const q = `
      INSERT INTO audit_events
        (organization_id, team_id, actor_user_id, actor_name, category, event_type,
         description, old_value, new_value)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    await db.query(q, [
      params.organizationId,
      params.teamId ?? null,
      params.actor.userId ?? null,
      params.actor.name,
      category,
      params.eventType,
      description,
      params.oldValue ?? null,
      params.newValue ?? null,
    ]);
  } catch (error) {
    // Never rethrow: a failed audit write must not surface to, block, or roll back the
    // action that triggered it. Context mirrors the { userId, teamId, ... } shape already
    // used elsewhere (e.g. passport-local-login.ts) when calling log_error with extra info.
    log_error(error, {
      scope: "logAuditEvent",
      eventType: params.eventType,
      organizationId: params.organizationId,
    });
  }
}

function defaultDescriptionFor(eventType: AuditEventTypeId): string {
  const match = Object.values(AUDIT_EVENT_TYPE).find((e) => e.id === eventType);
  return match?.defaultLabel ?? eventType;
}

/**
 * Resolves {organizationId, teamId} for a user before a session (and therefore
 * req.user.organization_id/team_id) exists yet - i.e. during login itself. Every other call
 * site in this codebase (3.3-3.8) runs on an already-authenticated request and can just read
 * req.user.organization_id/team_id directly, since deserialize_user() (see
 * database/pg-migrations/1789740000000_add_is_guest_to_deserialize_user.js) already resolves
 * and attaches those on every request after login.
 *
 * Mirrors that same function's join exactly - `organizations.user_id = teams.user_id` (the
 * org is matched by the team's owner, not by a teams.organization_id column) - so this never
 * silently disagrees with what the rest of the app considers "the" organization for a team.
 *
 * Returns null if nothing resolves (e.g. an unknown email with no matching account at all) -
 * callers should skip logging in that case rather than writing a row with no real workspace.
 */
export async function resolveOrganizationIdForUserId(
  userId: string,
  preferredTeamId?: string | null
): Promise<{ organizationId: string; teamId: string } | null> {
  try {
    const q = `
      SELECT o.id AS organization_id, t.id AS team_id
      FROM users u
      INNER JOIN teams t ON t.id = COALESCE($2::UUID, u.active_team)
      LEFT JOIN organizations o ON o.user_id = t.user_id
      WHERE u.id = $1::UUID
      LIMIT 1;
    `;
    const result = await db.query(q, [userId, preferredTeamId ?? null]);
    const row = result.rows[0];
    if (!row?.organization_id || !row?.team_id) {
      return null;
    }
    return { organizationId: row.organization_id, teamId: row.team_id };
  } catch (error) {
    log_error(error, { scope: "resolveOrganizationIdForUserId", userId });
    return null;
  }
}

/**
 * Same resolution as {@link resolveOrganizationIdForUserId}, but starting from an email
 * address - needed for login_failed, where the attempt may fail before we're confident the
 * email belongs to a real account.
 */
export async function resolveOrganizationIdForEmail(
  email: string
): Promise<{ organizationId: string; teamId: string; userId: string } | null> {
  try {
    const q = `
      SELECT u.id AS user_id, o.id AS organization_id, t.id AS team_id
      FROM users u
      INNER JOIN teams t ON t.id = u.active_team
      LEFT JOIN organizations o ON o.user_id = t.user_id
      WHERE LOWER(u.email) = LOWER($1) AND u.is_deleted IS FALSE
      LIMIT 1;
    `;
    const result = await db.query(q, [email]);
    const row = result.rows[0];
    if (!row?.organization_id || !row?.team_id || !row?.user_id) {
      return null;
    }
    return { organizationId: row.organization_id, teamId: row.team_id, userId: row.user_id };
  } catch (error) {
    log_error(error, { scope: "resolveOrganizationIdForEmail" });
    return null;
  }
}

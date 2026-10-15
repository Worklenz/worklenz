import db from "../../config/db";
import { log_error } from "../../shared/utils";
import { AUDIT_EVENTS, AuditEventKey, PortalSide, Queryable } from "./types";

export interface AuditActor {
  side: PortalSide;
  name: string;
  /** Staff member who acted (internal side). */
  userId?: string | null;
  /** Client user who acted (client side). */
  contactId?: string | null;
}

export interface AuditEventInput {
  teamId: string;
  event: AuditEventKey;
  actor: AuditActor;
  clientId?: string | null;
  clientName?: string | null;
  projectId?: string | null;
  targetType?: string | null;
  targetId?: string | null;
  /** A short label such as "AP-000123 · Approve homepage wireframe v3". Never a comment body or internal note. */
  targetLabel?: string;
  /** Structured details (from/to values and the like). Must not contain comment text or internal notes. */
  metadata?: Record<string, unknown>;
}

/**
 * Appends one audit event. Pass the active transaction as `q` so the event commits or rolls back
 * with the change it records. The log is append-only (a trigger rejects UPDATE and DELETE).
 */
export async function recordAuditEvent(q: Queryable, input: AuditEventInput): Promise<void> {
  await q.query(
    `INSERT INTO client_portal_audit_events (
       team_id, client_id, project_id, actor_side, actor_user_id, actor_contact_id, actor_name,
       event_type, event_key, target_type, target_id, target_label, client_name, metadata
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)`,
    [
      input.teamId,
      input.clientId ?? null,
      input.projectId ?? null,
      input.actor.side,
      input.actor.userId ?? null,
      input.actor.contactId ?? null,
      input.actor.name,
      AUDIT_EVENTS[input.event],
      input.event,
      input.targetType ?? null,
      input.targetId ?? null,
      input.targetLabel ?? "",
      input.clientName ?? null,
      JSON.stringify(input.metadata ?? {}),
    ]
  );
}

/**
 * For an event that must not fail the action it describes (a client previewing or downloading a
 * file). Errors are logged and swallowed.
 */
export async function recordAuditEventSafely(input: AuditEventInput, q: Queryable = db): Promise<void> {
  try {
    await recordAuditEvent(q, input);
  } catch (error) {
    log_error(error);
  }
}

/** Resolves the display name of a staff member for audit and history entries. */
export async function getStaffName(q: Queryable, userId: string): Promise<string> {
  const result = await q.query(`SELECT name FROM users WHERE id = $1`, [userId]);
  return result.rows[0]?.name ?? "Team member";
}

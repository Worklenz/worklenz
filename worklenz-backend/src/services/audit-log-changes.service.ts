import { IPassportSession } from "../interfaces/passport-session";
import { AuditEventTypeId } from "../shared/audit-log-constants";
import { actorFromSessionUser, logAuditEvent } from "./audit-log.service";

/**
 * Field-level change logging for the workspace Audit Log (Audit log spec).
 *
 * Callers capture a snapshot of the record before saving and another after, then log one
 * audit entry per changed field with readable old → new values. Snapshots are compared after
 * every write has landed, so settings saved by separate statements in one request are all
 * covered and fields that were re-saved unchanged produce no entry.
 */

export type AuditSnapshot = Record<string, unknown>;

export interface AuditTrackedField {
  /** Column name in the snapshot row. */
  key: string;
  /** Label written into the entry description, e.g. "Status". */
  label: string;
}

export interface AuditFieldChange {
  label: string;
  oldValue: string | null;
  newValue: string | null;
}

interface LogAuditFieldChangesParams {
  user: IPassportSession | undefined;
  eventType: AuditEventTypeId;
  /** Who or what changed, e.g. `Project "Apollo"`; prefixed to each description. */
  subject: string;
  changes: AuditFieldChange[];
}

/** Normalizes a snapshot value so that null, undefined and blank strings compare equal. */
export const toAuditValue = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  const text = String(value).trim();
  return text === "" ? null : text;
};

export const diffAuditSnapshots = (
  before: AuditSnapshot,
  after: AuditSnapshot,
  fields: AuditTrackedField[]
): AuditFieldChange[] =>
  fields.reduce<AuditFieldChange[]>((changes, field) => {
    const oldValue = toAuditValue(before[field.key]);
    const newValue = toAuditValue(after[field.key]);
    if (oldValue !== newValue) {
      changes.push({ label: field.label, oldValue, newValue });
    }
    return changes;
  }, []);

export const logAuditFieldChanges = ({ user, eventType, subject, changes }: LogAuditFieldChangesParams): void => {
  if (!user?.organization_id) return;

  for (const change of changes) {
    logAuditEvent({
      organizationId: user.organization_id,
      teamId: user.team_id || null,
      actor: actorFromSessionUser(user),
      eventType,
      description: `${subject}: ${change.label} changed`,
      oldValue: change.oldValue,
      newValue: change.newValue,
    });
  }
};

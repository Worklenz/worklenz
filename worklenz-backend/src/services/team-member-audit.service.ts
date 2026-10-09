import db from "../config/db";
import { IPassportSession } from "../interfaces/passport-session";
import { AUDIT_EVENT_TYPE, AuditEventTypeId } from "../shared/audit-log-constants";
import { log_error } from "../shared/utils";
import {
  AuditSnapshot,
  AuditTrackedField,
  diffAuditSnapshots,
  logAuditFieldChanges,
} from "./audit-log-changes.service";
import { actorFromSessionUser, logAuditEvent } from "./audit-log.service";

/**
 * Team member and project member events for the workspace Audit Log (Audit log spec).
 * Every helper here swallows its own errors: audit logging must never fail the action.
 */

const TEAM_MEMBER_SNAPSHOT_SQL = `
  SELECT COALESCE(tmiv.name, tmiv.email) AS label,
         tmiv.name,
         jt.name AS job_title,
         d.name AS department,
         pr.name AS practice,
         COALESCE(tm.can_create_projects_from_templates, FALSE) AS can_create_projects_from_templates
  FROM team_members tm
         LEFT JOIN team_member_info_view tmiv ON tmiv.team_member_id = tm.id
         LEFT JOIN job_titles jt ON jt.id = tm.job_title_id
         LEFT JOIN departments d ON d.id = tm.department_id
         LEFT JOIN practices pr ON pr.id = tm.practice_id
  WHERE tm.id = $1::UUID
`;

const MEMBER_DETAIL_FIELDS: AuditTrackedField[] = [
  { key: "name", label: "Name" },
  { key: "job_title", label: "Job title" },
  { key: "department", label: "Department" },
  { key: "practice", label: "Practice" },
];

const MEMBER_PERMISSION_FIELDS: AuditTrackedField[] = [
  { key: "can_create_projects_from_templates", label: "Create projects from templates" },
];

const PROJECT_MEMBER_LABELS_SQL = `
  SELECT p.name AS project_name,
         COALESCE(tmiv.name, tmiv.email) AS member_label
  FROM projects p
         LEFT JOIN team_member_info_view tmiv ON tmiv.team_member_id = $2::UUID
  WHERE p.id = $1::UUID
`;

const PROJECT_MEMBER_LABELS_BY_ID_SQL = `
  SELECT p.name AS project_name,
         COALESCE(tmiv.name, tmiv.email) AS member_label
  FROM project_members pm
         JOIN projects p ON p.id = pm.project_id
         LEFT JOIN team_member_info_view tmiv ON tmiv.team_member_id = pm.team_member_id
  WHERE pm.id = $1::UUID
`;

export interface ProjectMemberLabels {
  project_name: string;
  member_label: string | null;
}

const FALLBACK_MEMBER_LABEL = "a member";

const queryFirstRow = async <T>(scope: string, sql: string, params: unknown[]): Promise<T | null> => {
  try {
    const result = await db.query(sql, params);
    return (result.rows[0] as T | undefined) ?? null;
  } catch (error) {
    log_error(error, { scope });
    return null;
  }
};

const logSessionAuditEvent = (
  user: IPassportSession | undefined,
  eventType: AuditEventTypeId,
  description: string
): void => {
  if (!user?.organization_id) return;
  logAuditEvent({
    organizationId: user.organization_id,
    teamId: user.team_id || null,
    actor: actorFromSessionUser(user),
    eventType,
    description,
  });
};

/** Snapshot of a team member's details and permissions; null when there's nothing to log against. */
export const captureTeamMember = async (
  user: IPassportSession | undefined,
  teamMemberId: string | null | undefined
): Promise<AuditSnapshot | null> => {
  if (!user?.organization_id || !teamMemberId) return null;
  return queryFirstRow<AuditSnapshot>("captureTeamMember", TEAM_MEMBER_SNAPSHOT_SQL, [teamMemberId]);
};

/** Logs `member_updated` for detail changes and `member_permission_changed` for permission changes. */
export const logTeamMemberChanges = async (
  user: IPassportSession | undefined,
  teamMemberId: string,
  before: AuditSnapshot | null
): Promise<void> => {
  if (!before) return;

  const after = await captureTeamMember(user, teamMemberId);
  if (!after) return;

  const subject = String(after.label || before.label || FALLBACK_MEMBER_LABEL);
  logAuditFieldChanges({
    user,
    eventType: AUDIT_EVENT_TYPE.MEMBER_UPDATED.id,
    subject,
    changes: diffAuditSnapshots(before, after, MEMBER_DETAIL_FIELDS),
  });
  logAuditFieldChanges({
    user,
    eventType: AUDIT_EVENT_TYPE.MEMBER_PERMISSION_CHANGED.id,
    subject,
    changes: diffAuditSnapshots(before, after, MEMBER_PERMISSION_FIELDS),
  });
};

/** Logs a one-off event about a team member, e.g. activated or invitation resent. */
export const logTeamMemberEvent = async (
  user: IPassportSession | undefined,
  eventType: AuditEventTypeId,
  teamMemberId: string | null | undefined,
  describe: (memberLabel: string) => string
): Promise<void> => {
  if (!user?.organization_id) return;

  const member = await captureTeamMember(user, teamMemberId);
  logSessionAuditEvent(user, eventType, describe(String(member?.label || FALLBACK_MEMBER_LABEL)));
};

/** Logs an event that isn't about one member, e.g. an invitation link being created. */
export const logTeamEvent = (
  user: IPassportSession | undefined,
  eventType: AuditEventTypeId,
  description: string
): void => logSessionAuditEvent(user, eventType, description);

/**
 * Resolves the project and member names for a project member row. Call before removing the
 * row, since the names can't be looked up once it's gone.
 */
export const getProjectMemberLabelsById = async (
  user: IPassportSession | undefined,
  projectMemberId: string
): Promise<ProjectMemberLabels | null> => {
  if (!user?.organization_id || !projectMemberId) return null;
  return queryFirstRow<ProjectMemberLabels>("getProjectMemberLabelsById", PROJECT_MEMBER_LABELS_BY_ID_SQL, [
    projectMemberId,
  ]);
};

export const logProjectMemberAdded = async (
  user: IPassportSession | undefined,
  projectId: string,
  teamMemberId: string
): Promise<void> => {
  if (!user?.organization_id) return;

  const labels = await queryFirstRow<ProjectMemberLabels>("logProjectMemberAdded", PROJECT_MEMBER_LABELS_SQL, [
    projectId,
    teamMemberId,
  ]);
  if (!labels) return;

  logSessionAuditEvent(
    user,
    AUDIT_EVENT_TYPE.PROJECT_MEMBER_ADDED.id,
    `Added ${labels.member_label || FALLBACK_MEMBER_LABEL} to project "${labels.project_name}"`
  );
};

export const logProjectMemberRemoved = (
  user: IPassportSession | undefined,
  labels: ProjectMemberLabels | null
): void => {
  if (!labels) return;
  logSessionAuditEvent(
    user,
    AUDIT_EVENT_TYPE.PROJECT_MEMBER_REMOVED.id,
    `Removed ${labels.member_label || FALLBACK_MEMBER_LABEL} from project "${labels.project_name}"`
  );
};

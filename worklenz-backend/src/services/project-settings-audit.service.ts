import db from "../config/db";
import { IPassportSession } from "../interfaces/passport-session";
import { AUDIT_EVENT_TYPE } from "../shared/audit-log-constants";
import { log_error } from "../shared/utils";
import {
  AuditSnapshot,
  AuditTrackedField,
  diffAuditSnapshots,
  logAuditFieldChanges,
} from "./audit-log-changes.service";

/**
 * Project settings changes for the workspace Audit Log (Audit log spec): one
 * `project_setting_changed` entry per field changed in project settings, whichever endpoint
 * saved it (the settings form, budget, currency or delivery confidence). The privacy toggle
 * keeps its own `project_privacy_changed` event and is deliberately not tracked here.
 */

const PROJECT_SETTINGS_SNAPSHOT_SQL = `
  SELECT p.name,
         p.key,
         p.color_code,
         p.notes,
         ps.name AS status,
         ph.name AS health,
         pp.name AS priority,
         pc.name AS category,
         c.name AS client,
         pf.name AS folder,
         p.start_date::TEXT AS start_date,
         p.end_date::TEXT AS end_date,
         p.estimated_working_days,
         p.estimated_man_days,
         p.hours_per_day,
         p.use_manual_progress,
         p.use_weighted_progress,
         p.use_time_progress,
         p.auto_assign_task_creator,
         p.restrict_task_creation,
         p.phase_assignees_enabled,
         p.auto_assign_subtask_phase,
         p.budget::TEXT AS budget,
         p.currency,
         pdc.status AS delivery_confidence,
         pdc.note AS delivery_confidence_note,
         manager.name AS project_manager,
         manager.finance_access AS project_manager_finance_access
  FROM projects p
         LEFT JOIN sys_project_statuses ps ON ps.id = p.status_id
         LEFT JOIN sys_project_healths ph ON ph.id = p.health_id
         LEFT JOIN sys_project_priorities pp ON pp.id = p.priority_id
         LEFT JOIN project_categories pc ON pc.id = p.category_id
         LEFT JOIN clients c ON c.id = p.client_id
         LEFT JOIN project_folders pf ON pf.id = p.folder_id
         LEFT JOIN project_delivery_confidence pdc ON pdc.project_id = p.id
         LEFT JOIN LATERAL (
           SELECT COALESCE(tmiv.name, tmiv.email) AS name,
                  COALESCE(pm.finance_access, FALSE) AS finance_access
           FROM project_members pm
                  LEFT JOIN team_member_info_view tmiv ON tmiv.team_member_id = pm.team_member_id
           WHERE pm.project_id = p.id
             AND pm.project_access_level_id = (
               SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER'
             )
           ORDER BY pm.created_at ASC
           LIMIT 1
         ) manager ON TRUE
  WHERE p.id = $1::UUID
    AND p.team_id = $2::UUID
`;

const PROJECT_SETTING_FIELDS: AuditTrackedField[] = [
  { key: "name", label: "Name" },
  { key: "key", label: "Key" },
  { key: "color_code", label: "Color" },
  { key: "notes", label: "Notes" },
  { key: "status", label: "Status" },
  { key: "health", label: "Health" },
  { key: "priority", label: "Priority" },
  { key: "category", label: "Category" },
  { key: "client", label: "Client" },
  { key: "folder", label: "Folder" },
  { key: "start_date", label: "Start date" },
  { key: "end_date", label: "End date" },
  { key: "estimated_working_days", label: "Estimated working days" },
  { key: "estimated_man_days", label: "Estimated man days" },
  { key: "hours_per_day", label: "Hours per day" },
  { key: "use_manual_progress", label: "Manual progress" },
  { key: "use_weighted_progress", label: "Weighted progress" },
  { key: "use_time_progress", label: "Time-based progress" },
  { key: "auto_assign_task_creator", label: "Auto-assign task creator" },
  { key: "restrict_task_creation", label: "Restrict task creation" },
  { key: "phase_assignees_enabled", label: "Phase assignees" },
  { key: "auto_assign_subtask_phase", label: "Auto-assign subtask phase" },
  { key: "project_manager", label: "Project manager" },
  { key: "project_manager_finance_access", label: "Project manager finance access" },
  { key: "budget", label: "Budget" },
  { key: "currency", label: "Currency" },
  { key: "delivery_confidence", label: "Delivery confidence" },
  { key: "delivery_confidence_note", label: "Delivery confidence note" },
];

/**
 * Snapshot of a project's settings with ids resolved to names. Returns null (and logs nothing
 * later) when the session has no workspace or the lookup fails, so it never blocks a save.
 */
export const captureProjectSettings = async (
  user: IPassportSession | undefined,
  projectId: string
): Promise<AuditSnapshot | null> => {
  if (!user?.organization_id || !user.team_id || !projectId) return null;

  try {
    const result = await db.query(PROJECT_SETTINGS_SNAPSHOT_SQL, [projectId, user.team_id]);
    return result.rows[0] ?? null;
  } catch (error) {
    log_error(error, { scope: "captureProjectSettings", projectId });
    return null;
  }
};

/** Compares `before` with the project's current settings and logs one entry per change. */
export const logProjectSettingChanges = async (
  user: IPassportSession | undefined,
  projectId: string,
  before: AuditSnapshot | null
): Promise<void> => {
  if (!before) return;

  const after = await captureProjectSettings(user, projectId);
  if (!after) return;

  logAuditFieldChanges({
    user,
    eventType: AUDIT_EVENT_TYPE.PROJECT_SETTING_CHANGED.id,
    subject: `Project "${after.name}"`,
    changes: diffAuditSnapshots(before, after, PROJECT_SETTING_FIELDS),
  });
};

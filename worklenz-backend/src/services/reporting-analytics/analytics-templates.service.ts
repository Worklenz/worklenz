import db from "../../config/db";
import {
  MAX_VELOCITY_TEMPLATES_PER_USER,
  MAX_WORKSPACE_VELOCITY_TEMPLATES,
  TEMPLATE_NAME_MAX_LENGTH,
} from "../../shared/reporting-analytics.constants";
import {
  getAnalyticsDashboardPermissions,
  resolveAnalyticsActorRole,
} from "../../shared/reporting-analytics-permissions";
import { IPassportSession } from "../../interfaces/passport-session";

export const VELOCITY_REPORT_KIND = "velocity";

export interface AnalyticsTemplateRow {
  id: string;
  team_id: string;
  owner_id: string;
  report_kind: string;
  name: string;
  is_workspace_shared: boolean;
  is_default: boolean;
  filters_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  owner_name?: string;
}

export class TemplateServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = "TemplateServiceError";
  }
}

function normalizeName(name: unknown): string {
  if (typeof name !== "string") {
    throw new TemplateServiceError("Template name is required");
  }
  const trimmed = name.trim();
  if (!trimmed) throw new TemplateServiceError("Template name is required");
  if (trimmed.length > TEMPLATE_NAME_MAX_LENGTH) {
    throw new TemplateServiceError(
      `Template name must be at most ${TEMPLATE_NAME_MAX_LENGTH} characters`
    );
  }
  return trimmed;
}

export async function listTemplates(
  teamId: string,
  userId: string,
  reportKind: string = VELOCITY_REPORT_KIND
): Promise<AnalyticsTemplateRow[]> {
  const result = await db.query(
    `SELECT t.id, t.team_id, t.owner_id, t.report_kind, t.name,
            t.is_workspace_shared, t.is_default, t.filters_json,
            t.created_at, t.updated_at,
            u.name AS owner_name
     FROM analytics_report_templates t
     LEFT JOIN users u ON u.id = t.owner_id
     WHERE t.team_id = $1::UUID
       AND t.report_kind = $2
       AND (t.owner_id = $3::UUID OR t.is_workspace_shared IS TRUE)
     ORDER BY t.is_default DESC, t.updated_at DESC`,
    [teamId, reportKind, userId]
  );
  return result.rows.map(mapRow);
}

export async function createTemplate(
  user: IPassportSession,
  input: {
    name: string;
    filters?: Record<string, unknown>;
    isWorkspaceShared?: boolean;
    isDefault?: boolean;
    reportKind?: string;
  }
): Promise<AnalyticsTemplateRow> {
  const teamId = user.team_id;
  const userId = user.id;
  if (!teamId || !userId) throw new TemplateServiceError("Unauthorized", 401);

  const reportKind = input.reportKind ?? VELOCITY_REPORT_KIND;
  const name = normalizeName(input.name);
  const filters = input.filters ?? {};

  let isShared = !!input.isWorkspaceShared;
  if (isShared) {
    const perms = getAnalyticsDashboardPermissions(user, {
      ownerId: userId,
      isShared: false,
    });
    if (!perms.canShare) {
      throw new TemplateServiceError("Not allowed to share templates", 403);
    }
    await assertWorkspaceShareCap(teamId, reportKind);
  }

  await assertUserCap(teamId, userId, reportKind);

  if (input.isDefault) {
    await clearDefault(userId, reportKind);
  }

  const result = await db.query(
    `INSERT INTO analytics_report_templates (
       team_id, owner_id, report_kind, name,
       is_workspace_shared, is_default, filters_json
     ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
     RETURNING id, team_id, owner_id, report_kind, name,
               is_workspace_shared, is_default, filters_json,
               created_at, updated_at`,
    [teamId, userId, reportKind, name, isShared, !!input.isDefault, JSON.stringify(filters)]
  );

  return mapRow({ ...result.rows[0], owner_name: user.name });
}

export async function renameTemplate(
  user: IPassportSession,
  templateId: string,
  nameRaw: string
): Promise<AnalyticsTemplateRow> {
  const template = await getOwnedOrAdminTemplate(user, templateId);
  const name = normalizeName(nameRaw);
  const result = await db.query(
    `UPDATE analytics_report_templates
     SET name = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1::UUID
     RETURNING id, team_id, owner_id, report_kind, name,
               is_workspace_shared, is_default, filters_json,
               created_at, updated_at`,
    [template.id, name]
  );
  return mapRow(result.rows[0]);
}

export async function deleteTemplate(
  user: IPassportSession,
  templateId: string
): Promise<void> {
  await getOwnedOrAdminTemplate(user, templateId);
  await db.query(`DELETE FROM analytics_report_templates WHERE id = $1::UUID`, [
    templateId,
  ]);
}

export async function setDefaultTemplate(
  user: IPassportSession,
  templateId: string
): Promise<AnalyticsTemplateRow> {
  const userId = user.id;
  if (!userId) throw new TemplateServiceError("Unauthorized", 401);

  const template = await getVisibleTemplate(user, templateId);
  if (template.owner_id !== userId) {
    throw new TemplateServiceError("Only the owner can set a template as default", 403);
  }

  await clearDefault(userId, template.report_kind);
  const result = await db.query(
    `UPDATE analytics_report_templates
     SET is_default = TRUE, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1::UUID
     RETURNING id, team_id, owner_id, report_kind, name,
               is_workspace_shared, is_default, filters_json,
               created_at, updated_at`,
    [templateId]
  );
  return mapRow(result.rows[0]);
}

export async function setTemplateShare(
  user: IPassportSession,
  templateId: string,
  isWorkspaceShared: boolean
): Promise<AnalyticsTemplateRow> {
  const template = await getOwnedOrAdminTemplate(user, templateId);
  const role = resolveAnalyticsActorRole(user);
  const canShare =
    role === "owner" || role === "admin" || role === "manager";
  if (!canShare) {
    throw new TemplateServiceError("Not allowed to share templates", 403);
  }

  if (isWorkspaceShared && !template.is_workspace_shared) {
    await assertWorkspaceShareCap(template.team_id, template.report_kind);
  }

  const result = await db.query(
    `UPDATE analytics_report_templates
     SET is_workspace_shared = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1::UUID
     RETURNING id, team_id, owner_id, report_kind, name,
               is_workspace_shared, is_default, filters_json,
               created_at, updated_at`,
    [templateId, isWorkspaceShared]
  );
  return mapRow(result.rows[0]);
}

async function assertUserCap(
  teamId: string,
  userId: string,
  reportKind: string
): Promise<void> {
  const result = await db.query(
    `SELECT COUNT(*)::INT AS count
     FROM analytics_report_templates
     WHERE team_id = $1::UUID AND owner_id = $2::UUID AND report_kind = $3`,
    [teamId, userId, reportKind]
  );
  if (Number(result.rows[0]?.count ?? 0) >= MAX_VELOCITY_TEMPLATES_PER_USER) {
    throw new TemplateServiceError(
      `You can save at most ${MAX_VELOCITY_TEMPLATES_PER_USER} templates`,
      400
    );
  }
}

async function assertWorkspaceShareCap(
  teamId: string,
  reportKind: string
): Promise<void> {
  const result = await db.query(
    `SELECT COUNT(*)::INT AS count
     FROM analytics_report_templates
     WHERE team_id = $1::UUID
       AND report_kind = $2
       AND is_workspace_shared IS TRUE`,
    [teamId, reportKind]
  );
  if (Number(result.rows[0]?.count ?? 0) >= MAX_WORKSPACE_VELOCITY_TEMPLATES) {
    throw new TemplateServiceError(
      `Workspace can share at most ${MAX_WORKSPACE_VELOCITY_TEMPLATES} templates`,
      400
    );
  }
}

async function clearDefault(userId: string, reportKind: string): Promise<void> {
  await db.query(
    `UPDATE analytics_report_templates
     SET is_default = FALSE, updated_at = CURRENT_TIMESTAMP
     WHERE owner_id = $1::UUID AND report_kind = $2 AND is_default IS TRUE`,
    [userId, reportKind]
  );
}

async function getVisibleTemplate(
  user: IPassportSession,
  templateId: string
): Promise<AnalyticsTemplateRow> {
  const teamId = user.team_id;
  const userId = user.id;
  if (!teamId || !userId) throw new TemplateServiceError("Unauthorized", 401);

  const result = await db.query(
    `SELECT id, team_id, owner_id, report_kind, name,
            is_workspace_shared, is_default, filters_json,
            created_at, updated_at
     FROM analytics_report_templates
     WHERE id = $1::UUID
       AND team_id = $2::UUID
       AND (owner_id = $3::UUID OR is_workspace_shared IS TRUE)`,
    [templateId, teamId, userId]
  );
  if (!result.rows[0]) throw new TemplateServiceError("Template not found", 404);
  return mapRow(result.rows[0]);
}

async function getOwnedOrAdminTemplate(
  user: IPassportSession,
  templateId: string
): Promise<AnalyticsTemplateRow> {
  const template = await getVisibleTemplate(user, templateId);
  const role = resolveAnalyticsActorRole(user);
  const isAdmin = role === "owner" || role === "admin";
  if (template.owner_id !== user.id && !isAdmin) {
    throw new TemplateServiceError("Not allowed to modify this template", 403);
  }
  return template;
}

function mapRow(row: Record<string, unknown>): AnalyticsTemplateRow {
  const filters =
    typeof row.filters_json === "string"
      ? (JSON.parse(row.filters_json) as Record<string, unknown>)
      : ((row.filters_json as Record<string, unknown>) ?? {});

  return {
    id: String(row.id),
    team_id: String(row.team_id),
    owner_id: String(row.owner_id),
    report_kind: String(row.report_kind),
    name: String(row.name),
    is_workspace_shared: !!row.is_workspace_shared,
    is_default: !!row.is_default,
    filters_json: filters,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
    owner_name: row.owner_name ? String(row.owner_name) : undefined,
  };
}

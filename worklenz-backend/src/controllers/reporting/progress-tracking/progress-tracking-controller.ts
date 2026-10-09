import HandleExceptions from "../../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../../interfaces/worklenz-response";
import { ServerResponse } from "../../../models/server-response";
import db from "../../../config/db";
import ReportingControllerBase from "../reporting-controller-base";
import { getEffectiveTeamRole, TEAM_ROLE_NAMES } from "../../../shared/team-permissions";
import { captureProjectSettings, logProjectSettingChanges } from "../../../services/project-settings-audit.service";
import {
  buildProgressTrackingListQuery,
  parseDeliveryConfidenceNote,
  parseDeliveryConfidenceStatus,
} from "./progress-tracking-query";

/**
 * Percent complete matches Project Insights' done-category count:
 * non-archived tasks whose status category is done, divided by non-archived
 * tasks (parents and subtasks). Zero tasks yield NULL, which the UI shows
 * as "No tasks yet" rather than 0%.
 *
 * Blocked count is non-archived, not-done tasks that still have a blocked_by
 * dependency whose related task is also not done.
 */
const PORTFOLIO_CTE = `
WITH visible_projects AS (
  SELECT p.id, p.name, c.name AS client_name, p.created_at
  FROM projects p
  LEFT JOIN clients c ON c.id = p.client_id
  WHERE p.team_id = $1::uuid
    AND NOT EXISTS (
      SELECT 1
      FROM archived_projects ap
      WHERE ap.project_id = p.id
        AND ap.user_id = $2::uuid
    )
),
task_stats AS (
  SELECT t.project_id,
         COUNT(*) FILTER (WHERE t.archived IS FALSE)::int AS total_tasks,
         COUNT(*) FILTER (WHERE t.archived IS FALSE AND stsc.is_done IS TRUE)::int AS done_tasks
  FROM tasks t
         INNER JOIN task_statuses ts ON ts.id = t.status_id
         INNER JOIN sys_task_status_categories stsc ON stsc.id = ts.category_id
  WHERE t.project_id IN (SELECT id FROM visible_projects)
  GROUP BY t.project_id
),
blocked_stats AS (
  SELECT t.project_id, COUNT(DISTINCT t.id)::int AS blocked_count
  FROM tasks t
         INNER JOIN task_statuses ts ON ts.id = t.status_id
         INNER JOIN sys_task_status_categories stsc
                    ON stsc.id = ts.category_id AND stsc.is_done IS NOT TRUE
         INNER JOIN task_dependencies td
                    ON td.task_id = t.id AND td.dependency_type = 'blocked_by'::dependency_type
         INNER JOIN tasks blocker ON blocker.id = td.related_task_id AND blocker.archived IS FALSE
         INNER JOIN task_statuses bts ON bts.id = blocker.status_id
         INNER JOIN sys_task_status_categories bstsc
                    ON bstsc.id = bts.category_id AND bstsc.is_done IS NOT TRUE
  WHERE t.archived IS FALSE
    AND t.project_id IN (SELECT id FROM visible_projects)
  GROUP BY t.project_id
),
portfolio AS (
  SELECT v.id,
         v.name,
         v.client_name,
         v.created_at,
         COALESCE(ts.total_tasks, 0) AS total_tasks,
         COALESCE(ts.done_tasks, 0) AS done_tasks,
         CASE
           WHEN COALESCE(ts.total_tasks, 0) = 0 THEN NULL
           ELSE ROUND((ts.done_tasks::numeric / ts.total_tasks::numeric) * 100)::int
         END AS percent_complete,
         COALESCE(bs.blocked_count, 0) AS blocked_count,
         pdc.status AS confidence,
         pdc.note AS confidence_note,
         pdc.updated_at AS confidence_updated_at,
         updater.name AS confidence_updated_by_name,
         CASE pdc.status
           WHEN 'red' THEN 1
           WHEN 'amber' THEN 2
           WHEN 'green' THEN 3
           ELSE 4
         END AS confidence_rank
  FROM visible_projects v
         LEFT JOIN task_stats ts ON ts.project_id = v.id
         LEFT JOIN blocked_stats bs ON bs.project_id = v.id
         LEFT JOIN project_delivery_confidence pdc ON pdc.project_id = v.id
         LEFT JOIN users updater ON updater.id = pdc.updated_by
)
`;

const SUMMARY_SQL = `
SELECT COUNT(*) FILTER (WHERE ap.project_id IS NULL)::int AS total,
       COUNT(*) FILTER (WHERE ap.project_id IS NULL AND pdc.status = 'green')::int AS on_track,
       COUNT(*) FILTER (WHERE ap.project_id IS NULL AND pdc.status = 'amber')::int AS at_risk,
       COUNT(*) FILTER (WHERE ap.project_id IS NULL AND pdc.status = 'red')::int AS off_track,
       COUNT(*) FILTER (WHERE ap.project_id IS NULL AND pdc.status IS NULL)::int AS not_set,
       COUNT(*) FILTER (WHERE ap.project_id IS NOT NULL)::int AS archived_excluded
FROM projects p
       LEFT JOIN project_delivery_confidence pdc ON pdc.project_id = p.id
       LEFT JOIN archived_projects ap ON ap.project_id = p.id AND ap.user_id = $2::uuid
WHERE p.team_id = $1::uuid
`;

interface PortfolioRow {
  id: string;
  name: string;
  client_name: string | null;
  total_tasks: number;
  done_tasks: number;
  percent_complete: number | null;
  blocked_count: number;
  confidence: "green" | "amber" | "red" | null;
  confidence_note: string | null;
  confidence_updated_at: string | null;
  confidence_updated_by_name: string | null;
}

const toInt = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const mapProject = (row: PortfolioRow) => ({
  id: row.id,
  name: row.name,
  client_name: row.client_name,
  total_tasks: toInt(row.total_tasks),
  done_tasks: toInt(row.done_tasks),
  percent_complete: row.percent_complete === null || row.percent_complete === undefined
    ? null
    : toInt(row.percent_complete),
  blocked_count: toInt(row.blocked_count),
  confidence: row.confidence ?? null,
  confidence_note: row.confidence_note ?? null,
  confidence_updated_at: row.confidence_updated_at ?? null,
  confidence_updated_by_name: row.confidence_updated_by_name ?? null,
  can_edit: false,
});

export default class ProgressTrackingController extends ReportingControllerBase {
  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = this.getCurrentTeamId(req);
    const userId = req.user?.id;
    if (!teamId || !userId) {
      return res.status(401).send(new ServerResponse(false, null, "You are not authorized to perform this action"));
    }

    const pagination = (req as IWorkLenzRequest & {
      pagination?: { page: number; pageSize: number; offset: number };
    }).pagination ?? { page: 1, pageSize: 20, offset: 0 };

    const listQuery = buildProgressTrackingListQuery({
      search: typeof req.query.search === "string" ? req.query.search : "",
      confidence: typeof req.query.confidence === "string" ? req.query.confidence : undefined,
      percentRange: typeof req.query.percent_range === "string" ? req.query.percent_range : undefined,
      hasBlockers: req.query.has_blockers === "true",
      sortField: typeof req.query.field === "string" ? req.query.field : undefined,
      sortOrder: typeof req.query.order === "string" ? req.query.order : undefined,
    }, 3);

    const limitIndex = 3 + listQuery.params.length;
    const offsetIndex = limitIndex + 1;
    const filterParams = [teamId, userId, ...listQuery.params];
    const countSql = `
      ${PORTFOLIO_CTE}
      SELECT COUNT(*)::int AS total
      FROM portfolio
      WHERE ${listQuery.whereSql}
    `;
    const pageSql = `
      ${PORTFOLIO_CTE}
      SELECT id,
             name,
             client_name,
             total_tasks,
             done_tasks,
             percent_complete,
             blocked_count,
             confidence,
             confidence_note,
             confidence_updated_at,
             confidence_updated_by_name
      FROM portfolio
      WHERE ${listQuery.whereSql}
      ORDER BY ${listQuery.orderBySql}
      LIMIT $${limitIndex} OFFSET $${offsetIndex}
    `;

    const [summaryResult, countResult, pageResult] = await Promise.all([
      db.query(SUMMARY_SQL, [teamId, userId]),
      db.query(countSql, filterParams),
      db.query(pageSql, [...filterParams, pagination.pageSize, pagination.offset]),
    ]);

    const summaryRow = summaryResult.rows[0] || {};
    const projects = pageResult.rows.map(mapProject);

    return res.status(200).send(new ServerResponse(true, {
      projects,
      total: toInt(countResult.rows[0]?.total),
      page: pagination.page,
      page_size: pagination.pageSize,
      summary: {
        total: toInt(summaryRow.total),
        on_track: toInt(summaryRow.on_track),
        at_risk: toInt(summaryRow.at_risk),
        off_track: toInt(summaryRow.off_track),
        not_set: toInt(summaryRow.not_set),
        archived_excluded: toInt(summaryRow.archived_excluded),
      },
    }));
  }

  @HandleExceptions()
  public static async getByProject(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = this.getCurrentTeamId(req);
    const userId = req.user?.id;
    if (!teamId || !userId) {
      return res.status(401).send(new ServerResponse(false, null, "You are not authorized to perform this action"));
    }

    const result = await db.query(
      `SELECT pdc.status AS confidence,
              pdc.note AS confidence_note,
              pdc.updated_at AS confidence_updated_at,
              u.name AS confidence_updated_by_name
       FROM projects p
              LEFT JOIN project_delivery_confidence pdc ON pdc.project_id = p.id
              LEFT JOIN users u ON u.id = pdc.updated_by
       WHERE p.id = $1::uuid
         AND p.team_id = $2::uuid`,
      [req.params.id, teamId]
    );

    if (!result.rows[0]) {
      return res.status(404).send(new ServerResponse(false, null, "Project not found"));
    }

    const row = result.rows[0];
    return res.status(200).send(new ServerResponse(true, {
      confidence: row.confidence ?? null,
      confidence_note: row.confidence_note ?? null,
      confidence_updated_at: row.confidence_updated_at ?? null,
      confidence_updated_by_name: row.confidence_updated_by_name ?? null,
    }));
  }

  @HandleExceptions()
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = this.getCurrentTeamId(req);
    const userId = req.user?.id;
    if (!teamId || !userId) {
      return res.status(401).send(new ServerResponse(false, null, "You are not authorized to perform this action"));
    }

    const projectId = req.params.id || req.params.projectId;
    if (!projectId) {
      return res.status(400).send(new ServerResponse(false, null, "Project is required"));
    }
    const body = req.body ?? {};
    const hasStatus = Object.prototype.hasOwnProperty.call(body, "status");
    const hasNote = Object.prototype.hasOwnProperty.call(body, "note");
    if (!hasStatus && !hasNote) {
      return res.status(400).send(new ServerResponse(false, null, "Status or note is required"));
    }

    const projectResult = await db.query(
      `SELECT id FROM projects WHERE id = $1::uuid AND team_id = $2::uuid`,
      [projectId, teamId]
    );
    if (!projectResult.rows[0]) {
      return res.status(404).send(new ServerResponse(false, null, "Project not found"));
    }

    const allowed = await this.canSetDeliveryConfidence(req, projectId);
    if (!allowed) {
      return res.status(403).send(new ServerResponse(false, null, "Only an Admin, Owner, or Project Manager can set Delivery Confidence"));
    }

    const settingsBefore = await captureProjectSettings(req.user, projectId);
    const existingResult = await db.query(
      `SELECT status, note FROM project_delivery_confidence WHERE project_id = $1::uuid`,
      [projectId]
    );
    const existing = existingResult.rows[0] as { status: string | null; note: string | null } | undefined;

    let nextStatus: string | null = existing?.status ?? null;
    let nextNote: string | null = existing?.note ?? null;

    if (hasStatus) {
      const parsed = parseDeliveryConfidenceStatus(body.status);
      if (!parsed.ok) {
        return res.status(400).send(new ServerResponse(false, null, "Status must be green, amber, red, or unset"));
      }
      nextStatus = parsed.status;
    }

    if (hasNote) {
      const parsed = parseDeliveryConfidenceNote(body.note);
      if (!parsed.ok) {
        return res.status(400).send(new ServerResponse(false, null, "Note must be 280 characters or fewer"));
      }
      nextNote = parsed.note;
    }

    const saved = await db.query(
      `WITH upserted AS (
         INSERT INTO project_delivery_confidence (project_id, status, note, updated_by, updated_at)
         VALUES ($1::uuid, $2, $3, $4::uuid, CURRENT_TIMESTAMP)
         ON CONFLICT (project_id) DO UPDATE
           SET status = EXCLUDED.status,
               note = EXCLUDED.note,
               updated_by = EXCLUDED.updated_by,
               updated_at = CURRENT_TIMESTAMP
         RETURNING project_id, status, note, updated_at, updated_by
       )
       SELECT upserted.project_id AS id,
              upserted.status AS confidence,
              upserted.note AS confidence_note,
              upserted.updated_at AS confidence_updated_at,
              u.name AS confidence_updated_by_name
       FROM upserted
              LEFT JOIN users u ON u.id = upserted.updated_by`,
      [projectId, nextStatus, nextNote, userId]
    );

    const row = saved.rows[0];
    await logProjectSettingChanges(req.user, projectId, settingsBefore);
    return res.status(200).send(new ServerResponse(true, {
      id: row.id,
      confidence: row.confidence ?? null,
      confidence_note: row.confidence_note ?? null,
      confidence_updated_at: row.confidence_updated_at,
      confidence_updated_by_name: row.confidence_updated_by_name ?? null,
      can_edit: false,
    }));
  }

  private static async canSetDeliveryConfidence(req: IWorkLenzRequest, projectId: string): Promise<boolean> {
    const role = getEffectiveTeamRole(req.user);
    if (role === TEAM_ROLE_NAMES.OWNER || role === TEAM_ROLE_NAMES.ADMIN) return true;

    const managers = await db.query(
      `SELECT team_member_id
       FROM project_members
       WHERE project_id = $1::uuid
         AND project_access_level_id = (SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER')`,
      [projectId]
    );
    return managers.rows.some(row => row.team_member_id === req.user?.team_member_id);
  }
}

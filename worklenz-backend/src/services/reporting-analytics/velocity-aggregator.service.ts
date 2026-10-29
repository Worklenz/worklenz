import db from "../../config/db";
import { buildSprintScopeTasksFrom } from "../../shared/sprint-report-scope";
import { log_error } from "../../shared/utils";
import { invalidateAnalyticsCache } from "../../redis/analytics-cache";

export type VelocityBucketKind = "sprint" | "phase" | "mixed";

export interface VelocityMemberBreakdownRow {
  team_member_id: string;
  name: string;
  committed_points: number;
  completed_points: number;
  committed_issue_count: number;
  completed_issue_count: number;
}

interface PhaseSnapshotRow {
  id: string;
  name: string;
  project_id: string;
  team_id: string;
  project_type: string;
  sprint_status: string;
  start_date: Date | null;
  end_date: Date | null;
  completed_at: Date | null;
  created_at: Date | null;
  committed_points: number | null;
  completed_points: number | null;
  committed_issue_count: number | null;
  completed_issue_count: number | null;
}

interface LivePhaseMetrics {
  committed_points: number;
  completed_points: number;
  committed_issue_count: number;
  completed_issue_count: number;
}

/**
 * Builds member breakdown with proportional split across assignees
 * so stacked totals match sprint/phase committed/completed totals.
 */
async function computeMemberBreakdown(
  phaseId: string
): Promise<VelocityMemberBreakdownRow[]> {
  const result = await db.query(
    `WITH scope AS (
       SELECT t.id, COALESCE(t.story_points, 0)::FLOAT AS points,
              COALESCE(cat.is_done, FALSE) AS is_done
       FROM (${buildSprintScopeTasksFrom("$1::UUID")}) t
       LEFT JOIN task_statuses ts ON ts.id = t.status_id
       LEFT JOIN sys_task_status_categories cat ON cat.id = ts.category_id
     ),
     assignee_counts AS (
       SELECT s.id AS task_id, s.points, s.is_done, COUNT(ta.team_member_id)::INT AS assignee_count
       FROM scope s
       LEFT JOIN tasks_assignees ta ON ta.task_id = s.id
       GROUP BY s.id, s.points, s.is_done
     ),
     shares AS (
       SELECT ta.team_member_id,
              CASE WHEN ac.assignee_count > 0 THEN ac.points / ac.assignee_count ELSE 0 END AS point_share,
              CASE WHEN ac.assignee_count > 0 THEN 1.0 / ac.assignee_count ELSE 0 END AS issue_share,
              ac.is_done
       FROM assignee_counts ac
       INNER JOIN tasks_assignees ta ON ta.task_id = ac.task_id
       WHERE ac.assignee_count > 0
     )
     SELECT s.team_member_id,
            COALESCE(
              NULLIF(TRIM(tmiv.name), ''),
              (SELECT ei.name FROM email_invitations ei WHERE ei.team_member_id = s.team_member_id LIMIT 1),
              'Unknown'
            ) AS name,
            COALESCE(SUM(s.point_share), 0)::FLOAT AS committed_points,
            COALESCE(SUM(s.point_share) FILTER (WHERE s.is_done IS TRUE), 0)::FLOAT AS completed_points,
            COALESCE(SUM(s.issue_share), 0)::FLOAT AS committed_issue_count,
            COALESCE(SUM(s.issue_share) FILTER (WHERE s.is_done IS TRUE), 0)::FLOAT AS completed_issue_count
     FROM shares s
     LEFT JOIN team_member_info_view tmiv ON tmiv.team_member_id = s.team_member_id
     GROUP BY s.team_member_id, tmiv.name
     ORDER BY name ASC;`,
    [phaseId]
  );

  return result.rows.map((row: Record<string, unknown>) => ({
    team_member_id: String(row.team_member_id),
    name: String(row.name ?? "Unknown"),
    committed_points: Number(row.committed_points ?? 0),
    completed_points: Number(row.completed_points ?? 0),
    committed_issue_count: Math.round(Number(row.committed_issue_count ?? 0) * 100) / 100,
    completed_issue_count: Math.round(Number(row.completed_issue_count ?? 0) * 100) / 100,
  }));
}

/** Live committed/completed metrics from tasks assigned to a phase (general projects). */
async function computeLivePhaseMetrics(phaseId: string): Promise<LivePhaseMetrics> {
  const result = await db.query(
    `SELECT
       COALESCE(SUM(t.story_points), 0)::FLOAT AS committed_points,
       COALESCE(SUM(t.story_points) FILTER (WHERE cat.is_done IS TRUE), 0)::FLOAT AS completed_points,
       COUNT(*)::INT AS committed_issue_count,
       COUNT(*) FILTER (WHERE cat.is_done IS TRUE)::INT AS completed_issue_count
     FROM (${buildSprintScopeTasksFrom("$1::UUID")}) t
     LEFT JOIN task_statuses ts ON ts.id = t.status_id
     LEFT JOIN sys_task_status_categories cat ON cat.id = ts.category_id`,
    [phaseId]
  );

  const row = result.rows[0] ?? {};
  return {
    committed_points: Number(row.committed_points ?? 0),
    completed_points: Number(row.completed_points ?? 0),
    committed_issue_count: Number(row.committed_issue_count ?? 0),
    completed_issue_count: Number(row.completed_issue_count ?? 0),
  };
}

function commitmentAccuracy(committed: number, completed: number): number | null {
  if (!committed || committed <= 0) return null;
  return Math.round((completed / committed) * 10000) / 100;
}

function isSoftwareProject(projectType: string | null | undefined): boolean {
  return projectType === "software";
}

/** Upsert velocity cache for one sprint/phase and invalidate Redis keys. */
export async function upsertVelocityForSprint(
  projectId: string,
  sprintId: string
): Promise<void> {
  const phaseResult = await db.query(
    `SELECT pp.id, pp.name, pp.project_id, p.team_id,
            COALESCE(p.project_type, 'general') AS project_type,
            pp.sprint_status,
            pp.start_date, pp.end_date, pp.completed_at, pp.created_at,
            pp.committed_points, pp.completed_points,
            pp.committed_issue_count, pp.completed_issue_count
     FROM project_phases pp
     INNER JOIN projects p ON p.id = pp.project_id
     WHERE pp.id = $1::UUID
       AND pp.project_id = $2::UUID`,
    [sprintId, projectId]
  );

  const phase = phaseResult.rows[0] as PhaseSnapshotRow | undefined;
  if (!phase) return;

  const software = isSoftwareProject(phase.project_type);

  // Software velocity is based on completed sprints only.
  if (software && phase.sprint_status !== "completed") return;

  let committedPoints: number;
  let completedPoints: number;
  let committedIssues: number;
  let completedIssues: number;

  if (software) {
    committedPoints = Number(phase.committed_points ?? 0);
    completedPoints = Number(phase.completed_points ?? 0);
    committedIssues = Number(phase.committed_issue_count ?? 0);
    completedIssues = Number(phase.completed_issue_count ?? 0);
  } else {
    // General projects: phases are the sprint equivalent — compute live from tasks.
    const live = await computeLivePhaseMetrics(sprintId);
    committedPoints = live.committed_points;
    completedPoints = live.completed_points;
    committedIssues = live.committed_issue_count;
    completedIssues = live.completed_issue_count;
  }

  const memberBreakdown = await computeMemberBreakdown(sprintId);
  const completedAt =
    phase.completed_at ?? phase.end_date ?? phase.start_date ?? phase.created_at ?? null;

  await db.query(
    `INSERT INTO velocity_sprint_cache (
       team_id, project_id, sprint_id, sprint_name,
       start_date, end_date, completed_at,
       committed_points, completed_points,
       committed_issue_count, completed_issue_count,
       commitment_accuracy, member_breakdown, computed_at
     ) VALUES (
       $1, $2, $3, $4,
       $5, $6, $7,
       $8, $9,
       $10, $11,
       $12, $13::jsonb, CURRENT_TIMESTAMP
     )
     ON CONFLICT (sprint_id) DO UPDATE SET
       team_id = EXCLUDED.team_id,
       project_id = EXCLUDED.project_id,
       sprint_name = EXCLUDED.sprint_name,
       start_date = EXCLUDED.start_date,
       end_date = EXCLUDED.end_date,
       completed_at = EXCLUDED.completed_at,
       committed_points = EXCLUDED.committed_points,
       completed_points = EXCLUDED.completed_points,
       committed_issue_count = EXCLUDED.committed_issue_count,
       completed_issue_count = EXCLUDED.completed_issue_count,
       commitment_accuracy = EXCLUDED.commitment_accuracy,
       member_breakdown = EXCLUDED.member_breakdown,
       computed_at = CURRENT_TIMESTAMP`,
    [
      phase.team_id,
      phase.project_id,
      phase.id,
      phase.name,
      phase.start_date,
      phase.end_date,
      completedAt,
      committedPoints,
      completedPoints,
      committedIssues,
      completedIssues,
      commitmentAccuracy(committedPoints, completedPoints),
      JSON.stringify(memberBreakdown),
    ]
  );

  await invalidateAnalyticsCache("velocity", phase.team_id);
}

/** Fire-and-forget wrapper for sprint-complete hook. */
export function scheduleVelocityUpsert(projectId: string, sprintId: string): void {
  void upsertVelocityForSprint(projectId, sprintId).catch(err => {
    log_error(err);
  });
}

/**
 * Backfill / refresh cache rows for a project.
 * - Software: completed sprints missing from cache
 * - General: all phases that have tasks (live metrics refreshed each run)
 */
export async function backfillProjectVelocity(projectId: string): Promise<number> {
  const projectResult = await db.query(
    `SELECT COALESCE(project_type, 'general') AS project_type FROM projects WHERE id = $1::UUID`,
    [projectId]
  );
  const projectType = String(projectResult.rows[0]?.project_type ?? "general");
  const software = isSoftwareProject(projectType);

  const phaseResult = software
    ? await db.query(
        `SELECT pp.id
         FROM project_phases pp
         WHERE pp.project_id = $1::UUID
           AND pp.sprint_status = 'completed'
           AND NOT EXISTS (
             SELECT 1 FROM velocity_sprint_cache vsc WHERE vsc.sprint_id = pp.id
           )`,
        [projectId]
      )
    : await db.query(
        `SELECT pp.id
         FROM project_phases pp
         WHERE pp.project_id = $1::UUID
           AND EXISTS (
             SELECT 1
             FROM task_phase tp
             INNER JOIN tasks t ON t.id = tp.task_id AND t.archived IS FALSE
             WHERE tp.phase_id = pp.id
           )
         ORDER BY COALESCE(pp.end_date, pp.start_date, pp.created_at) ASC NULLS LAST,
                  pp.sort_index ASC`,
        [projectId]
      );

  let count = 0;
  for (const row of phaseResult.rows) {
    await upsertVelocityForSprint(projectId, row.id);
    count += 1;
  }
  return count;
}

/** Backfill gaps for multiple projects (series endpoint). */
export async function backfillVelocityGaps(projectIds: string[]): Promise<void> {
  for (const projectId of projectIds) {
    await backfillProjectVelocity(projectId);
  }
}

/** Resolve UI bucket label from the selected projects' types. */
export async function resolveVelocityBucket(
  projectIds: string[]
): Promise<VelocityBucketKind> {
  if (projectIds.length === 0) return "sprint";

  const result = await db.query(
    `SELECT DISTINCT COALESCE(project_type, 'general') AS project_type
     FROM projects
     WHERE id = ANY($1::UUID[])`,
    [projectIds]
  );

  const types = new Set(
    result.rows.map((row: { project_type: string }) =>
      isSoftwareProject(row.project_type) ? "software" : "general"
    )
  );

  if (types.has("software") && types.has("general")) return "mixed";
  if (types.has("general")) return "phase";
  return "sprint";
}

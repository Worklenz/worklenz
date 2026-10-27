import db from "../../config/db";
import { buildSprintScopeTasksFrom } from "../../shared/sprint-report-scope";
import { log_error } from "../../shared/utils";
import { invalidateAnalyticsCache } from "../../redis/analytics-cache";

export interface VelocityMemberBreakdownRow {
  team_member_id: string;
  name: string;
  committed_points: number;
  completed_points: number;
  committed_issue_count: number;
  completed_issue_count: number;
}

interface SprintSnapshotRow {
  id: string;
  name: string;
  project_id: string;
  team_id: string;
  start_date: Date | null;
  end_date: Date | null;
  completed_at: Date | null;
  committed_points: number | null;
  completed_points: number | null;
  committed_issue_count: number | null;
  completed_issue_count: number | null;
}

/**
 * Builds member breakdown with proportional split across assignees
 * so stacked totals match sprint committed/completed totals.
 */
async function computeMemberBreakdown(
  sprintId: string
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
    [sprintId]
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

function commitmentAccuracy(committed: number, completed: number): number | null {
  if (!committed || committed <= 0) return null;
  return Math.round((completed / committed) * 10000) / 100;
}

/** Upsert velocity cache for one completed sprint and invalidate Redis keys. */
export async function upsertVelocityForSprint(
  projectId: string,
  sprintId: string
): Promise<void> {
  const sprintResult = await db.query(
    `SELECT pp.id, pp.name, pp.project_id, p.team_id,
            pp.start_date, pp.end_date, pp.completed_at,
            pp.committed_points, pp.completed_points,
            pp.committed_issue_count, pp.completed_issue_count
     FROM project_phases pp
     INNER JOIN projects p ON p.id = pp.project_id
     WHERE pp.id = $1::UUID
       AND pp.project_id = $2::UUID
       AND pp.sprint_status = 'completed'`,
    [sprintId, projectId]
  );

  const sprint = sprintResult.rows[0] as SprintSnapshotRow | undefined;
  if (!sprint) return;

  const committedPoints = Number(sprint.committed_points ?? 0);
  const completedPoints = Number(sprint.completed_points ?? 0);
  const committedIssues = Number(sprint.committed_issue_count ?? 0);
  const completedIssues = Number(sprint.completed_issue_count ?? 0);
  const memberBreakdown = await computeMemberBreakdown(sprintId);

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
      sprint.team_id,
      sprint.project_id,
      sprint.id,
      sprint.name,
      sprint.start_date,
      sprint.end_date,
      sprint.completed_at,
      committedPoints,
      completedPoints,
      committedIssues,
      completedIssues,
      commitmentAccuracy(committedPoints, completedPoints),
      JSON.stringify(memberBreakdown),
    ]
  );

  await invalidateAnalyticsCache("velocity", sprint.team_id);
}

/** Fire-and-forget wrapper for sprint-complete hook. */
export function scheduleVelocityUpsert(projectId: string, sprintId: string): void {
  void upsertVelocityForSprint(projectId, sprintId).catch(err => {
    log_error(err);
  });
}

/** Backfill missing cache rows for completed sprints in a project. */
export async function backfillProjectVelocity(projectId: string): Promise<number> {
  const missing = await db.query(
    `SELECT pp.id
     FROM project_phases pp
     WHERE pp.project_id = $1::UUID
       AND pp.sprint_status = 'completed'
       AND NOT EXISTS (
         SELECT 1 FROM velocity_sprint_cache vsc WHERE vsc.sprint_id = pp.id
       )`,
    [projectId]
  );

  let count = 0;
  for (const row of missing.rows) {
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

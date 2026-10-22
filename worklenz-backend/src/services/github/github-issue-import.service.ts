import db from "../../config/db";
import { advanceBacklogIssuesToTodo } from "../../shared/software-sprint-utils";
import { IGithubIssue } from "./github-app.service";
import {
  mapLabelsToIssueType,
  renderImportedDescription,
} from "./github-issue-mapping";

export interface IImportTarget {
  projectId: string;
  repositoryId: string;
  repositoryFullName: string;
  /** User recorded as reporter. */
  actorId: string;
  /** Sprint to plan the issue into; null sends it to the backlog. */
  phaseId: string | null;
}

export type ImportOutcome =
  | { status: "imported"; taskId: string; taskKey: string }
  | { status: "skipped"; reason: "already_imported" | "no_status" | "project_not_found" };

export const issueLabelNames = (issue: IGithubIssue): string[] =>
  issue.labels
    .map(label => (typeof label === "string" ? label : label.name || ""))
    .filter(Boolean);

/** Create one Worklenz issue from a GitHub issue and link them. Idempotent per issue number. */
export async function importGithubIssue(
  issue: IGithubIssue,
  target: IImportTarget,
): Promise<ImportOutcome> {
  const existing = await db.query(
    `SELECT 1 FROM github_issue_links WHERE repository_id = $1 AND issue_number = $2`,
    [target.repositoryId, issue.number],
  );
  if (existing.rowCount) return { status: "skipped", reason: "already_imported" };

  const client = await db.pool.connect();
  let taskId: string;
  try {
    await client.query("BEGIN");

    const project = await client.query(`SELECT team_id FROM projects WHERE id = $1`, [target.projectId]);
    if (!project.rowCount) {
      await client.query("ROLLBACK");
      return { status: "skipped", reason: "project_not_found" };
    }
    const status = await client.query(
      `SELECT id FROM task_statuses WHERE project_id = $1 ORDER BY sort_order LIMIT 1`,
      [target.projectId],
    );
    if (!status.rowCount) {
      await client.query("ROLLBACK");
      return { status: "skipped", reason: "no_status" };
    }

    const created = await client.query(`SELECT create_task($1) AS task;`, [
      JSON.stringify({
        name: issue.title.trim().slice(0, 250) || `GitHub issue #${issue.number}`,
        description: renderImportedDescription(issue.body, {
          fullName: target.repositoryFullName,
          number: issue.number,
          url: issue.html_url,
        }),
        project_id: target.projectId,
        reporter_id: target.actorId,
        team_id: project.rows[0].team_id,
        status_id: status.rows[0].id,
        phase_id: target.phaseId,
        parent_task_id: null,
        total_minutes: 0,
        assignees: [],
      }),
    ]);
    taskId = created.rows[0]?.task?.task?.id;
    if (!taskId) throw new Error("Task was not created");

    // Rank last in every grouped view, as the manual create flow does.
    await client.query(
      `UPDATE tasks
       SET issue_type = $2,
           status_sort_order = next_rank.value,
           priority_sort_order = next_rank.value,
           phase_sort_order = next_rank.value,
           member_sort_order = next_rank.value
       FROM (
         SELECT COALESCE(MAX(GREATEST(
                  COALESCE(sort_order, 0), COALESCE(status_sort_order, 0),
                  COALESCE(priority_sort_order, 0), COALESCE(phase_sort_order, 0),
                  COALESCE(member_sort_order, 0))), 0) + 1 AS value
         FROM tasks WHERE project_id = $3 AND id <> $1
       ) next_rank
       WHERE tasks.id = $1`,
      [taskId, mapLabelsToIssueType(issueLabelNames(issue)), target.projectId],
    );

    await client.query(
      `INSERT INTO github_issue_links (task_id, repository_id, issue_number, state, html_url, last_synced_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [taskId, target.repositoryId, issue.number, issue.state, issue.html_url],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    // Unique violation: another import won the race.
    if ((error as { code?: string }).code === "23505") {
      return { status: "skipped", reason: "already_imported" };
    }
    throw error;
  } finally {
    client.release();
  }

  if (target.phaseId) await advanceBacklogIssuesToTodo([taskId]);

  const key = await db.query(
    `SELECT CONCAT(p.key, '-', t.task_no) AS task_key
     FROM tasks t JOIN projects p ON p.id = t.project_id WHERE t.id = $1`,
    [taskId],
  );
  return { status: "imported", taskId, taskKey: key.rows[0].task_key };
}

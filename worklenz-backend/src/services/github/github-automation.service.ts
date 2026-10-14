import db from "../../config/db";
import { IO } from "../../shared/io";
import { SocketEvents } from "../../socket.io/events";
import { TASK_STATUS_COLOR_ALPHA } from "../../shared/constants";
import { log_error } from "../../shared/utils";
import TasksControllerV2 from "../../controllers/tasks-controller-v2";
import {
  insertToActivityLogs,
} from "../activity-logs/activity-logs.service";
import {
  IActivityLogAttributeTypes,
  IActivityLogChangeType,
} from "../activity-logs/interfaces";
import {
  GithubStatusMap,
  ITaskGitState,
  resolveReachedEvent,
  resolveTargetStatus,
} from "./github-transition-rules";

interface ITaskContext {
  id: string;
  project_id: string;
  parent_task_id: string | null;
  status_id: string;
  status_is_done: boolean;
  archived: boolean;
  settings: { status_map?: GithubStatusMap } | null;
  linked_by: string | null;
}

/** Aggregate Git state for a task across every linked repository. */
async function loadGitState(taskId: string): Promise<ITaskGitState> {
  const result = await db.query(
    `SELECT
       COALESCE(JSON_AGG(JSON_BUILD_OBJECT('merged', p.merged))
         FILTER (WHERE l.link_type = 'pull_request' AND l.closes), '[]'::JSON) AS closing,
       COUNT(*) FILTER (WHERE l.link_type = 'pull_request' AND p.state = 'open' AND NOT p.is_draft)::INT AS open_prs,
       COUNT(*) FILTER (WHERE l.link_type = 'pull_request' AND p.state = 'open' AND p.is_draft)::INT AS draft_prs,
       COUNT(*) FILTER (WHERE l.link_type = 'branch' AND NOT b.is_deleted)::INT AS branches
     FROM github_task_links l
     LEFT JOIN github_pull_requests p ON p.id = l.pull_request_id
     LEFT JOIN github_branches b ON b.id = l.branch_id
     WHERE l.task_id = $1`,
    [taskId],
  );
  const row = result.rows[0];
  return {
    closingPullRequests: row.closing,
    openPullRequests: row.open_prs,
    draftPullRequests: row.draft_prs,
    activeBranches: row.branches,
  };
}

async function resolveActorId(
  context: ITaskContext,
  repositoryId: string,
  authorLogin?: string | null,
): Promise<string | null> {
  if (authorLogin) {
    const linked = await db.query(
      `SELECT user_id FROM github_user_links WHERE LOWER(github_login) = LOWER($1) LIMIT 1`,
      [authorLogin],
    );
    if (linked.rowCount) return linked.rows[0].user_id;
  }
  if (context.linked_by) return context.linked_by;

  const fallback = await db.query(
    `SELECT i.connected_by
     FROM github_repositories r JOIN github_integrations i ON i.id = r.integration_id
     WHERE r.id = $1`,
    [repositoryId],
  );
  return fallback.rows[0]?.connected_by ?? null;
}

/** Socket-less equivalent of the on_task_status_change flow. */
async function applyStatusTransition(
  context: ITaskContext,
  statusId: string,
  actorId: string,
): Promise<void> {
  const result = await db.query(`SELECT handle_on_task_status_change($1, $2, $3) AS res;`, [
    actorId,
    context.id,
    statusId,
  ]);
  const change = result.rows[0].res;

  if (change.status_category?.is_done) {
    await db.query(
      `UPDATE tasks SET progress_value = 100, manual_progress = TRUE
       WHERE id = $1 AND (progress_value IS DISTINCT FROM 100)`,
      [context.id],
    );
  } else {
    await db.query(
      `UPDATE tasks SET manual_progress = FALSE, progress_value = NULL WHERE id = $1`,
      [context.id],
    );
  }

  await insertToActivityLogs({
    task_id: context.id,
    attribute_type: IActivityLogAttributeTypes.STATUS,
    user_id: actorId,
    log_type: IActivityLogChangeType.UPDATE,
    old_value: context.status_id,
    new_value: statusId,
  });

  const ratio = await TasksControllerV2.getTaskCompleteRatio(context.parent_task_id || context.id);
  const status = await db.query(`SELECT name FROM task_statuses WHERE id = $1`, [statusId]);

  IO.getInstance()
    ?.to(context.project_id)
    .emit(SocketEvents.TASK_STATUS_CHANGE.toString(), {
      id: context.id,
      parent_task: context.parent_task_id,
      color_code: `${change.color_code}${TASK_STATUS_COLOR_ALPHA}`,
      color_code_dark: change.color_code_dark,
      complete_ratio: ratio?.ratio,
      completed_count: ratio?.total_completed,
      total_tasks_count: ratio?.total_tasks,
      status_id: statusId,
      status_name: status.rows[0]?.name,
      completed_at: change.completed_at,
      statusCategory: change.status_category,
      completed_deps: true,
    });
}

/**
 * Re-evaluate tasks after Git activity in a repository and apply the repo's status mapping.
 * Failures on one task never block the others.
 */
export async function reconcileTasks(
  taskIds: string[],
  repositoryId: string,
  authorLogin?: string | null,
): Promise<void> {
  for (const taskId of new Set(taskIds)) {
    try {
      const contextResult = await db.query(
        `SELECT t.id, t.project_id, t.parent_task_id, t.status_id, t.archived,
                COALESCE(c.is_done, FALSE) AS status_is_done,
                pr.settings, pr.linked_by
         FROM tasks t
         JOIN task_statuses s ON s.id = t.status_id
         LEFT JOIN sys_task_status_categories c ON c.id = s.category_id
         JOIN github_project_repositories pr
           ON pr.project_id = t.project_id AND pr.repository_id = $2
         WHERE t.id = $1`,
        [taskId, repositoryId],
      );
      const context: ITaskContext | undefined = contextResult.rows[0];
      if (!context || context.archived) continue;

      const statusMap = context.settings?.status_map;
      if (!statusMap || !Object.values(statusMap).some(Boolean)) continue;

      const mappedIds = Object.values(statusMap).filter((v): v is string => !!v);
      const doneRows = await db.query(
        `SELECT s.id
         FROM task_statuses s JOIN sys_task_status_categories c ON c.id = s.category_id
         WHERE s.id = ANY($1::UUID[]) AND s.project_id = $2 AND c.is_done IS TRUE`,
        [mappedIds, context.project_id],
      );
      const doneIds = new Set<string>(doneRows.rows.map(r => r.id));

      const target = resolveTargetStatus({
        event: resolveReachedEvent(await loadGitState(taskId)),
        statusMap,
        currentStatusId: context.status_id,
        currentStatusIsDone: context.status_is_done,
        isDoneStatus: id => doneIds.has(id),
      });
      if (!target) continue;

      // Respect blocking dependencies when finishing the issue.
      if (doneIds.has(target)) {
        const canContinue = await TasksControllerV2.checkForCompletedDependencies(taskId, target);
        if (!canContinue) continue;
      }

      const actorId = await resolveActorId(context, repositoryId, authorLogin);
      if (!actorId) continue;

      await applyStatusTransition(context, target, actorId);
    } catch (error) {
      log_error(error);
    }
  }
}

/** Tell clients with the project open that GitHub activity changed for these tasks. */
export async function notifyGithubActivity(taskIds: string[]): Promise<void> {
  if (!taskIds.length) return;
  try {
    const result = await db.query(
      `SELECT project_id, ARRAY_AGG(id) AS task_ids
       FROM tasks WHERE id = ANY($1::UUID[]) GROUP BY project_id`,
      [[...new Set(taskIds)]],
    );
    for (const row of result.rows) {
      IO.getInstance()
        ?.to(row.project_id)
        .emit(SocketEvents.GITHUB_TASK_ACTIVITY.toString(), { task_ids: row.task_ids });
    }
  } catch (error) {
    log_error(error);
  }
}

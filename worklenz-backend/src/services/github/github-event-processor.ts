import db from "../../config/db";
import { parseIssueKeys } from "./github-issue-key-parser";
import {
  closeTaskForClosedIssue,
  notifyGithubActivity,
  reconcileTasks,
} from "./github-automation.service";
import { matchesLabelFilter } from "./github-issue-mapping";
import { importGithubIssue, issueLabelNames } from "./github-issue-import.service";
import { IGithubIssue } from "./github-app.service";

type Json = Record<string, any>;

interface ILinkedProject {
  project_id: string;
  project_key: string;
}

const MAX_COMMITS_PER_PUSH = 100;

async function tasksLinkedToBranch(repositoryId: string, branchName: string): Promise<string[]> {
  const result = await db.query(
    `SELECT l.task_id FROM github_task_links l
     JOIN github_branches b ON b.id = l.branch_id
     WHERE b.repository_id = $1 AND b.name = $2`,
    [repositoryId, branchName],
  );
  return result.rows.map(r => r.task_id);
}

async function tasksLinkedToPullRequest(repositoryId: string, number: number): Promise<string[]> {
  const result = await db.query(
    `SELECT l.task_id FROM github_task_links l
     JOIN github_pull_requests p ON p.id = l.pull_request_id
     WHERE p.repository_id = $1 AND p.number = $2`,
    [repositoryId, number],
  );
  return result.rows.map(r => r.task_id);
}

async function applyAutomation(taskIds: string[], repositoryId: string, authorLogin?: string | null) {
  if (!taskIds.length) return;
  await reconcileTasks(taskIds, repositoryId, authorLogin);
  await notifyGithubActivity(taskIds);
}

/** Repository row for a webhook payload; created on first sight when the integration is known. */
async function resolveRepository(payload: Json): Promise<{ id: string; integration_id: string } | null> {
  const repo = payload.repository;
  const installationId = payload.installation?.id;
  if (!repo?.id || !installationId) return null;

  const integration = await db.query(
    `SELECT id FROM github_integrations WHERE installation_id = $1 AND status = 'active' LIMIT 1`,
    [installationId],
  );
  if (!integration.rowCount) return null;

  const result = await db.query(
    `INSERT INTO github_repositories (integration_id, github_repo_id, full_name, default_branch, is_private)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (integration_id, github_repo_id)
     DO UPDATE SET full_name = EXCLUDED.full_name,
                   default_branch = EXCLUDED.default_branch,
                   is_private = EXCLUDED.is_private,
                   is_available = TRUE,
                   updated_at = NOW()
     RETURNING id, integration_id`,
    [integration.rows[0].id, repo.id, repo.full_name, repo.default_branch || "main", !!repo.private],
  );
  return result.rows[0];
}

async function getLinkedProjects(repositoryId: string): Promise<ILinkedProject[]> {
  const result = await db.query(
    `SELECT pr.project_id, p.key AS project_key
     FROM github_project_repositories pr
     JOIN projects p ON p.id = pr.project_id
     WHERE pr.repository_id = $1 AND p.project_type = 'software'`,
    [repositoryId],
  );
  return result.rows;
}

/** Map parsed keys to task ids within the repo's linked projects. */
async function resolveTasks(
  text: Array<string | null | undefined>,
  projects: ILinkedProject[],
): Promise<Array<{ taskId: string; closes: boolean }>> {
  if (!projects.length) return [];
  const keyToProject = new Map(projects.map(p => [p.project_key.toUpperCase(), p.project_id]));
  const parsed = text.flatMap(t => parseIssueKeys(t, keyToProject.keys()));
  if (!parsed.length) return [];

  const merged = new Map<string, { projectId: string; taskNo: number; closes: boolean }>();
  for (const item of parsed) {
    const id = `${item.projectKey}-${item.taskNo}`;
    const existing = merged.get(id);
    if (existing) existing.closes = existing.closes || item.closes;
    else merged.set(id, { projectId: keyToProject.get(item.projectKey)!, taskNo: item.taskNo, closes: item.closes });
  }

  const items = [...merged.values()];
  const result = await db.query(
    `SELECT t.id, i.closes
     FROM json_to_recordset($1::json) AS i(project_id UUID, task_no BIGINT, closes BOOLEAN)
     JOIN tasks t ON t.project_id = i.project_id AND t.task_no = i.task_no`,
    [JSON.stringify(items.map(i => ({ project_id: i.projectId, task_no: i.taskNo, closes: i.closes })))],
  );
  return result.rows.map(r => ({ taskId: r.id, closes: r.closes }));
}

async function linkTasks(
  tasks: Array<{ taskId: string; closes: boolean }>,
  target: { type: "branch" | "pull_request" | "commit"; id: string },
): Promise<void> {
  const column = target.type === "branch" ? "branch_id" : target.type === "pull_request" ? "pull_request_id" : "commit_id";
  const conflict = column;
  for (const task of tasks) {
    await db.query(
      `INSERT INTO github_task_links (task_id, link_type, ${column}, closes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (task_id, ${conflict}) WHERE ${column} IS NOT NULL
       DO UPDATE SET closes = github_task_links.closes OR EXCLUDED.closes`,
      [task.taskId, target.type, target.id, task.closes],
    );
  }
}

async function upsertBranch(repositoryId: string, name: string, sha?: string | null): Promise<string> {
  const result = await db.query(
    `INSERT INTO github_branches (repository_id, name, head_sha)
     VALUES ($1, $2, $3)
     ON CONFLICT (repository_id, name)
     DO UPDATE SET head_sha = COALESCE(EXCLUDED.head_sha, github_branches.head_sha),
                   is_deleted = FALSE, updated_at = NOW()
     RETURNING id`,
    [repositoryId, name, sha || null],
  );
  return result.rows[0].id;
}

async function handlePush(payload: Json): Promise<void> {
  const repository = await resolveRepository(payload);
  if (!repository) return;

  const ref: string = payload.ref || "";
  const branchName = ref.startsWith("refs/heads/") ? ref.slice("refs/heads/".length) : null;
  const projects = await getLinkedProjects(repository.id);
  if (!projects.length) return;

  const pusher: string | null = payload.pusher?.name || payload.sender?.login || null;
  const affected: string[] = [];

  if (branchName && payload.deleted) {
    await db.query(
      `UPDATE github_branches SET is_deleted = TRUE, updated_at = NOW()
       WHERE repository_id = $1 AND name = $2`,
      [repository.id, branchName],
    );
    await applyAutomation(await tasksLinkedToBranch(repository.id, branchName), repository.id, pusher);
    return;
  }

  if (branchName) {
    const branchTasks = await resolveTasks([branchName], projects);
    if (branchTasks.length) {
      const branchId = await upsertBranch(repository.id, branchName, payload.after);
      await linkTasks(branchTasks, { type: "branch", id: branchId });
      affected.push(...branchTasks.map(t => t.taskId));
    }
  }

  const commits: Json[] = Array.isArray(payload.commits) ? payload.commits.slice(0, MAX_COMMITS_PER_PUSH) : [];
  for (const commit of commits) {
    const tasks = await resolveTasks([commit.message], projects);
    if (!tasks.length) continue;
    const stored = await db.query(
      `INSERT INTO github_commits (repository_id, sha, message, author_name, author_login, html_url, committed_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (repository_id, sha) DO UPDATE SET message = EXCLUDED.message
       RETURNING id`,
      [
        repository.id,
        commit.id,
        String(commit.message || "").slice(0, 2000),
        commit.author?.name || null,
        commit.author?.username || null,
        commit.url || null,
        commit.timestamp || null,
      ],
    );
    await linkTasks(tasks, { type: "commit", id: stored.rows[0].id });
    affected.push(...tasks.map(t => t.taskId));
  }

  await applyAutomation(affected, repository.id, pusher);
}

async function handleBranchCreateDelete(eventType: string, payload: Json): Promise<void> {
  if (payload.ref_type !== "branch") return;
  const repository = await resolveRepository(payload);
  if (!repository) return;

  if (eventType === "delete") {
    await db.query(
      `UPDATE github_branches SET is_deleted = TRUE, updated_at = NOW()
       WHERE repository_id = $1 AND name = $2`,
      [repository.id, payload.ref],
    );
    await applyAutomation(
      await tasksLinkedToBranch(repository.id, payload.ref),
      repository.id,
      payload.sender?.login,
    );
    return;
  }

  const projects = await getLinkedProjects(repository.id);
  const tasks = await resolveTasks([payload.ref], projects);
  if (!tasks.length) return;
  const branchId = await upsertBranch(repository.id, payload.ref);
  await linkTasks(tasks, { type: "branch", id: branchId });
  await applyAutomation(tasks.map(t => t.taskId), repository.id, payload.sender?.login);
}

async function handlePullRequest(payload: Json): Promise<void> {
  const pr = payload.pull_request;
  if (!pr) return;
  const repository = await resolveRepository(payload);
  if (!repository) return;

  const projects = await getLinkedProjects(repository.id);
  const tasks = await resolveTasks([pr.title, pr.body, pr.head?.ref], projects);

  // Only store PRs that reference an issue, or that we already track.
  const existing = await db.query(
    `SELECT id FROM github_pull_requests WHERE repository_id = $1 AND number = $2`,
    [repository.id, pr.number],
  );
  if (!tasks.length && !existing.rowCount) return;

  // Event ordering is not guaranteed; never let an older event overwrite newer state.
  const result = await db.query(
    `INSERT INTO github_pull_requests
       (repository_id, number, title, body, state, is_draft, merged, head_branch, base_branch,
        author_login, author_avatar_url, html_url, opened_at, merged_at, closed_at, last_event_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
     ON CONFLICT (repository_id, number) DO UPDATE SET
       title = EXCLUDED.title, body = EXCLUDED.body, state = EXCLUDED.state,
       is_draft = EXCLUDED.is_draft, merged = EXCLUDED.merged,
       head_branch = EXCLUDED.head_branch, base_branch = EXCLUDED.base_branch,
       merged_at = EXCLUDED.merged_at, closed_at = EXCLUDED.closed_at,
       last_event_at = EXCLUDED.last_event_at
     WHERE github_pull_requests.last_event_at <= EXCLUDED.last_event_at
     RETURNING id`,
    [
      repository.id,
      pr.number,
      String(pr.title || "").slice(0, 500),
      pr.body ? String(pr.body).slice(0, 10000) : null,
      pr.state === "closed" ? "closed" : "open",
      !!pr.draft,
      !!pr.merged,
      pr.head?.ref || null,
      pr.base?.ref || null,
      pr.user?.login || null,
      pr.user?.avatar_url || null,
      pr.html_url,
      pr.created_at || null,
      pr.merged_at || null,
      pr.closed_at || null,
      pr.updated_at || new Date().toISOString(),
    ],
  );

  const prId = result.rows[0]?.id ?? existing.rows[0]?.id;
  if (prId && tasks.length) await linkTasks(tasks, { type: "pull_request", id: prId });

  // Reconcile every issue tied to this PR, including links made by earlier events.
  const linked = await tasksLinkedToPullRequest(repository.id, pr.number);
  await applyAutomation(linked, repository.id, pr.merged ? pr.merged_by?.login || pr.user?.login : pr.user?.login);
}

async function handlePullRequestReview(payload: Json): Promise<void> {
  const pr = payload.pull_request;
  const review = payload.review;
  const repo = payload.repository;
  if (!pr || !review || !repo?.id) return;

  const state = String(review.state || "").toLowerCase();
  const reviewState =
    state === "approved" ? "approved" : state === "changes_requested" ? "changes_requested" : null;
  if (!reviewState && state !== "dismissed") return;

  const updated = await db.query(
    `UPDATE github_pull_requests p SET review_state = $3
     FROM github_repositories r
     WHERE p.repository_id = r.id AND r.github_repo_id = $1 AND p.number = $2
     RETURNING p.repository_id`,
    [repo.id, pr.number, reviewState],
  );
  if (updated.rowCount) {
    await notifyGithubActivity(await tasksLinkedToPullRequest(updated.rows[0].repository_id, pr.number));
  }
}

interface IImportSettings {
  auto_import?: boolean;
  labels?: string[];
  default_phase_id?: string | null;
  close_on_issue_close?: boolean;
}

/** Issue opened/labeled/closed/reopened: auto-import, keep link state, close linked issues. */
async function handleIssues(payload: Json): Promise<void> {
  const issue = payload.issue as IGithubIssue | undefined;
  if (!issue || issue.pull_request) return;
  const action: string = payload.action;
  if (!["opened", "labeled", "closed", "reopened"].includes(action)) return;

  const repository = await resolveRepository(payload);
  if (!repository) return;

  if (action === "closed" || action === "reopened") {
    const updated = await db.query(
      `UPDATE github_issue_links SET state = $3, last_synced_at = NOW()
       WHERE repository_id = $1 AND issue_number = $2
       RETURNING task_id`,
      [repository.id, issue.number, action === "closed" ? "closed" : "open"],
    );
    if (action === "closed") {
      for (const row of updated.rows) await closeTaskForClosedIssue(row.task_id, repository.id);
    }
    await notifyGithubActivity(updated.rows.map(r => r.task_id));
    return;
  }

  // opened / labeled: auto-import into every linked project that asks for it.
  const links = await db.query(
    `SELECT pr.project_id, pr.linked_by, pr.settings, r.full_name, i.connected_by
     FROM github_project_repositories pr
     JOIN github_repositories r ON r.id = pr.repository_id
     JOIN github_integrations i ON i.id = r.integration_id
     JOIN projects p ON p.id = pr.project_id
     WHERE pr.repository_id = $1 AND p.project_type = 'software'`,
    [repository.id],
  );

  for (const link of links.rows) {
    const settings: IImportSettings = link.settings?.import || {};
    if (!settings.auto_import) continue;
    if (!matchesLabelFilter(issueLabelNames(issue), settings.labels)) continue;

    const actorId = link.linked_by || link.connected_by;
    if (!actorId) continue;

    const outcome = await importGithubIssue(issue, {
      projectId: link.project_id,
      repositoryId: repository.id,
      repositoryFullName: link.full_name,
      actorId,
      phaseId: settings.default_phase_id || null,
    });
    if (outcome.status === "imported") await notifyGithubActivity([outcome.taskId]);
  }
}

async function handleInstallation(payload: Json): Promise<void> {
  const installationId = payload.installation?.id;
  if (!installationId) return;
  const status =
    payload.action === "deleted" ? "disconnected" : payload.action === "suspend" ? "suspended" : payload.action === "unsuspend" ? "active" : null;
  if (!status) return;
  await db.query(
    `UPDATE github_integrations SET status = $2, updated_at = NOW()
     WHERE installation_id = $1 AND status <> 'disconnected'`,
    [installationId, status],
  );
}

async function handleInstallationRepositories(payload: Json): Promise<void> {
  const installationId = payload.installation?.id;
  if (!installationId) return;
  const integration = await db.query(
    `SELECT id FROM github_integrations WHERE installation_id = $1 AND status <> 'disconnected' LIMIT 1`,
    [installationId],
  );
  if (!integration.rowCount) return;
  const integrationId = integration.rows[0].id;

  for (const repo of payload.repositories_added || []) {
    await db.query(
      `INSERT INTO github_repositories (integration_id, github_repo_id, full_name, is_private)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (integration_id, github_repo_id)
       DO UPDATE SET full_name = EXCLUDED.full_name, is_available = TRUE, updated_at = NOW()`,
      [integrationId, repo.id, repo.full_name, !!repo.private],
    );
  }
  for (const repo of payload.repositories_removed || []) {
    await db.query(
      `UPDATE github_repositories SET is_available = FALSE, updated_at = NOW()
       WHERE integration_id = $1 AND github_repo_id = $2`,
      [integrationId, repo.id],
    );
  }
}

/** Returns "ignored" for events we deliberately do not act on. */
export async function processGithubEvent(eventType: string, payload: Json): Promise<"processed" | "ignored"> {
  switch (eventType) {
    case "push":
      await handlePush(payload);
      return "processed";
    case "create":
    case "delete":
      await handleBranchCreateDelete(eventType, payload);
      return "processed";
    case "pull_request":
      await handlePullRequest(payload);
      return "processed";
    case "pull_request_review":
      await handlePullRequestReview(payload);
      return "processed";
    case "issues":
      await handleIssues(payload);
      return "processed";
    case "installation":
      await handleInstallation(payload);
      return "processed";
    case "installation_repositories":
      await handleInstallationRepositories(payload);
      return "processed";
    default:
      return "ignored";
  }
}

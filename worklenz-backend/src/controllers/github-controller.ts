import jwt from "jsonwebtoken";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import db from "../config/db";
import { GithubAppService } from "../services/github/github-app.service";
import { getProjectAccessForRequest } from "../shared/project-access";
import { log_error } from "../shared/utils";
import { isValidUuid } from "../shared/validation-helpers";
import { IO } from "../shared/io";
import { SocketEvents } from "../socket.io/events";
import { isValidBranchName } from "../services/github/github-branch-name";
import {
  buildDefaultStatusMap,
  GITHUB_TRANSITION_EVENTS,
  GithubStatusMap,
  IProjectStatusOption,
} from "../services/github/github-transition-rules";
import { GithubApiError } from "../services/github/github-app.service";
import { notifyGithubActivity, reconcileTasks } from "../services/github/github-automation.service";
import { importGithubIssue, issueLabelNames } from "../services/github/github-issue-import.service";

const STATE_PURPOSE = "github-install";
const STATE_TTL = "15m";

const getStateSecret = (): string =>
  process.env.COOKIE_SECRET || process.env.SESSION_SECRET || process.env.ENCRYPTION_KEY || "";

const canManageTeam = (req: IWorkLenzRequest): boolean => !!(req.user?.owner || req.user?.is_admin);

function getFrontendOrigin(): string {
  const raw = process.env.FRONTEND_URL || process.env.APP_URL || "http://localhost:5173";
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return `${url.protocol}//${url.host}`;
  } catch {
    return "http://localhost:5173";
  }
}

async function getActiveIntegration(teamId: string) {
  const result = await db.query(
    `SELECT id, installation_id, account_login, account_type, account_avatar_url, status, connected_at
     FROM github_integrations
     WHERE team_id = $1 AND status <> 'disconnected'
     LIMIT 1`,
    [teamId],
  );
  return result.rows[0] || null;
}

async function syncRepositories(integrationId: string, installationId: number): Promise<number> {
  const repos = await GithubAppService.listInstallationRepositories(installationId);
  const ids = repos.map(r => r.id);

  for (const repo of repos) {
    await db.query(
      `INSERT INTO github_repositories (integration_id, github_repo_id, full_name, default_branch, is_private)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (integration_id, github_repo_id)
       DO UPDATE SET full_name = EXCLUDED.full_name, default_branch = EXCLUDED.default_branch,
                     is_private = EXCLUDED.is_private, is_available = TRUE, updated_at = NOW()`,
      [integrationId, repo.id, repo.full_name, repo.default_branch || "main", repo.private],
    );
  }
  await db.query(
    `UPDATE github_repositories SET is_available = FALSE, updated_at = NOW()
     WHERE integration_id = $1 AND NOT (github_repo_id = ANY($2::BIGINT[]))`,
    [integrationId, ids],
  );
  return repos.length;
}

async function getOpenSprints(projectId: string) {
  const result = await db.query(
    `SELECT id, name, sprint_status FROM project_phases
     WHERE project_id = $1 AND sprint_status IN ('planned', 'active')
     ORDER BY sort_index, created_at`,
    [projectId],
  );
  return result.rows as Array<{ id: string; name: string; sprint_status: string }>;
}

/** A repository link of this project, with what the GitHub API needs. Null when not found. */
async function getProjectLink(projectId: string, linkId: string, teamId: string) {
  if (!isValidUuid(linkId)) return null;
  const result = await db.query(
    `SELECT pr.id, pr.repository_id, r.full_name, i.installation_id
     FROM github_project_repositories pr
     JOIN github_repositories r ON r.id = pr.repository_id
     JOIN github_integrations i ON i.id = r.integration_id
     WHERE pr.id = $1 AND pr.project_id = $2 AND i.team_id = $3 AND i.status = 'active'`,
    [linkId, projectId, teamId],
  );
  const row = result.rows[0];
  return row
    ? {
        id: row.id as string,
        repositoryId: row.repository_id as string,
        fullName: row.full_name as string,
        installationId: Number(row.installation_id),
      }
    : null;
}

async function getTeamOwnerName(teamId: string): Promise<string | null> {
  const result = await db.query(
    `SELECT u.name FROM teams t JOIN users u ON u.id = t.user_id WHERE t.id = $1`,
    [teamId],
  );
  return result.rows[0]?.name ?? null;
}

async function getProjectStatuses(projectId: string): Promise<IProjectStatusOption[]> {
  const result = await db.query(
    `SELECT s.id, s.name,
            COALESCE(c.is_todo, FALSE) AS is_todo,
            COALESCE(c.is_doing, FALSE) AS is_doing,
            COALESCE(c.is_done, FALSE) AS is_done
     FROM task_statuses s
     LEFT JOIN sys_task_status_categories c ON c.id = s.category_id
     WHERE s.project_id = $1
     ORDER BY s.sort_order`,
    [projectId],
  );
  return result.rows;
}

/**
 * Shared checks for task-scoped branch endpoints: software task in the caller's team, caller can
 * work on tasks, and the repository is linked to the task's project with an active installation.
 * Sends the error response itself and returns null when a check fails.
 */
async function resolveTaskRepository(
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  taskId: string,
  repositoryId: string,
): Promise<{ fullName: string; installationId: number } | null> {
  const task = await db.query(
    `SELECT t.project_id FROM tasks t JOIN projects p ON p.id = t.project_id
     WHERE t.id = $1 AND p.team_id = $2 AND p.project_type = 'software'`,
    [taskId, req.user?.team_id],
  );
  if (!task.rowCount) {
    res.status(404).send(new ServerResponse(false, null, "Task not found"));
    return null;
  }

  const access = await getProjectAccessForRequest(req, task.rows[0].project_id);
  if (!access.permissions.tasks) {
    res.status(403).send(new ServerResponse(false, null, "You are not authorized to perform this action"));
    return null;
  }

  const repo = await db.query(
    `SELECT r.full_name, i.installation_id
     FROM github_project_repositories pr
     JOIN github_repositories r ON r.id = pr.repository_id
     JOIN github_integrations i ON i.id = r.integration_id
     WHERE pr.project_id = $1 AND r.id = $2 AND i.status = 'active' AND r.is_available = TRUE`,
    [task.rows[0].project_id, repositoryId],
  );
  if (!repo.rowCount) {
    res.status(404).send(new ServerResponse(false, null, "Repository not found"));
    return null;
  }
  return { fullName: repo.rows[0].full_name, installationId: Number(repo.rows[0].installation_id) };
}

export default class GithubController extends WorklenzControllerBase {
  /** Connection state for the team (Settings > Integrations). */
  @HandleExceptions()
  public static async getStatus(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    if (!teamId) return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));

    const configured = GithubAppService.isConfigured();
    const integration = configured ? await getActiveIntegration(teamId) : null;

    let repositoryCount = 0;
    if (integration) {
      const count = await db.query(
        `SELECT COUNT(*)::INT AS count FROM github_repositories
         WHERE integration_id = $1 AND is_available = TRUE`,
        [integration.id],
      );
      repositoryCount = count.rows[0].count;
    }

    return res.status(200).send(
      new ServerResponse(true, {
        configured,
        connected: !!integration,
        can_manage: canManageTeam(req),
        integration: integration && {
          account_login: integration.account_login,
          account_type: integration.account_type,
          account_avatar_url: integration.account_avatar_url,
          status: integration.status,
          connected_at: integration.connected_at,
          repository_count: repositoryCount,
        },
      }),
    );
  }

  @HandleExceptions()
  public static async getInstallUrl(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const config = GithubAppService.getConfig();
    if (!config) return res.status(503).send(new ServerResponse(false, null, "GitHub integration is not configured"));
    if (!canManageTeam(req)) {
      return res.status(403).send(new ServerResponse(false, null, "Only team owners and admins can connect GitHub"));
    }
    const secret = getStateSecret();
    if (!secret) return res.status(500).send(new ServerResponse(false, null, "Server is missing a signing secret"));

    // Optional: send the user back to this project's settings after installing.
    let projectId: string | null = null;
    const requestedProject = req.query.project_id;
    if (typeof requestedProject === "string" && isValidUuid(requestedProject)) {
      const owned = await db.query(
        `SELECT 1 FROM projects WHERE id = $1 AND team_id = $2 AND project_type = 'software'`,
        [requestedProject, req.user?.team_id],
      );
      if (owned.rowCount) projectId = requestedProject;
    }

    const state = jwt.sign(
      { purpose: STATE_PURPOSE, team_id: req.user?.team_id, user_id: req.user?.id, project_id: projectId },
      secret,
      { expiresIn: STATE_TTL },
    );
    const url = `https://github.com/apps/${config.slug}/installations/new?state=${encodeURIComponent(state)}`;
    return res.status(200).send(new ServerResponse(true, { url }));
  }

  /** Redirect target after the GitHub App install (browser navigation, session cookie present). */
  public static async installCallback(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    // Where to land afterwards; set once the signed state is verified (never taken from the query).
    let returnProjectId: string | null = null;
    const back = (status: string, reason?: string) => {
      const target = new URL(
        returnProjectId
          ? `${getFrontendOrigin()}/worklenz/projects/${returnProjectId}`
          : `${getFrontendOrigin()}/worklenz/settings/integrations`,
      );
      if (returnProjectId) {
        target.searchParams.set("open_settings", "1");
        target.searchParams.set("settings_section", "integrations");
      }
      target.searchParams.set("github", status);
      if (reason) target.searchParams.set("reason", reason);
      return res.redirect(target.toString());
    };

    try {
      const { installation_id, code, state, setup_action } = req.query as Record<string, string | undefined>;
      if (setup_action === "request") return back("requested");

      // "Redirect on update" (repositories added/removed) comes back without our signed state.
      // Accept it only to re-sync an installation this team has already connected.
      if (!state) {
        const updatedId = parseInt(installation_id || "", 10);
        if (setup_action !== "update" || !code || !Number.isSafeInteger(updatedId) || !canManageTeam(req)) {
          return back("error", "invalid_state");
        }
        const existing = await db.query(
          `SELECT id FROM github_integrations
           WHERE team_id = $1 AND installation_id = $2 AND status <> 'disconnected'`,
          [req.user?.team_id, updatedId],
        );
        if (!existing.rowCount || !(await GithubAppService.userCanAccessInstallation(code, updatedId))) {
          return back("error", "forbidden");
        }
        await syncRepositories(existing.rows[0].id, updatedId);
        return back("success");
      }

      const secret = getStateSecret();
      let claims: { purpose?: string; team_id?: string; user_id?: string; project_id?: string | null };
      try {
        claims = jwt.verify(state || "", secret) as typeof claims;
      } catch {
        return back("error", "invalid_state");
      }

      if (
        claims.purpose !== STATE_PURPOSE ||
        claims.team_id !== req.user?.team_id ||
        claims.user_id !== req.user?.id ||
        !canManageTeam(req)
      ) {
        return back("error", "forbidden");
      }

      if (claims.project_id && isValidUuid(claims.project_id)) returnProjectId = claims.project_id;

      const installationId = parseInt(installation_id || "", 10);
      if (!Number.isSafeInteger(installationId) || !code) return back("error", "invalid_request");

      if (!(await GithubAppService.userCanAccessInstallation(code, installationId))) {
        return back("error", "forbidden");
      }

      const installation = await GithubAppService.getInstallation(installationId);

      const taken = await db.query(
        `SELECT team_id FROM github_integrations
         WHERE installation_id = $1 AND status <> 'disconnected' AND team_id <> $2`,
        [installationId, req.user?.team_id],
      );
      if (taken.rowCount) return back("error", "already_connected");

      const current = await getActiveIntegration(req.user!.team_id!);
      if (current && Number(current.installation_id) !== installationId) {
        return back("error", "team_already_connected");
      }

      // Reactivate a previous connection for the same installation to keep project links.
      const result = await db.query(
        `WITH reactivated AS (
           UPDATE github_integrations
           SET status = 'active', account_login = $3, account_type = $4, account_avatar_url = $5,
               connected_by = $6, connected_at = NOW(), updated_at = NOW()
           WHERE team_id = $1 AND installation_id = $2
           RETURNING id
         ), inserted AS (
           INSERT INTO github_integrations
             (team_id, installation_id, account_login, account_type, account_avatar_url, connected_by)
           SELECT $1, $2, $3, $4, $5, $6 WHERE NOT EXISTS (SELECT 1 FROM reactivated)
           RETURNING id
         )
         SELECT id FROM reactivated UNION ALL SELECT id FROM inserted`,
        [
          req.user?.team_id,
          installationId,
          installation.account.login,
          installation.account.type,
          installation.account.avatar_url || null,
          req.user?.id,
        ],
      );

      await syncRepositories(result.rows[0].id, installationId);
      return back("success");
    } catch (error) {
      log_error(error);
      return back("error", "server_error");
    }
  }

  @HandleExceptions()
  public static async disconnect(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    if (!canManageTeam(req)) {
      return res.status(403).send(new ServerResponse(false, null, "Only team owners and admins can disconnect GitHub"));
    }
    await db.query(
      `UPDATE github_integrations SET status = 'disconnected', updated_at = NOW()
       WHERE team_id = $1 AND status <> 'disconnected'`,
      [req.user?.team_id],
    );
    return res.status(200).send(new ServerResponse(true, null));
  }

  @HandleExceptions()
  public static async refreshRepositories(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    if (!canManageTeam(req)) {
      return res.status(403).send(new ServerResponse(false, null, "Only team owners and admins can refresh repositories"));
    }
    const integration = await getActiveIntegration(req.user!.team_id!);
    if (!integration) return res.status(404).send(new ServerResponse(false, null, "GitHub is not connected"));
    const count = await syncRepositories(integration.id, Number(integration.installation_id));
    return res.status(200).send(new ServerResponse(true, { repository_count: count }));
  }

  /** Linked repositories for a project plus the repositories still available to link. */
  @HandleExceptions()
  public static async getProjectRepositories(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { projectId } = req.params;
    const integration = await getActiveIntegration(req.user!.team_id!);

    const linked = await db.query(
      `SELECT pr.id, pr.repository_id, r.full_name, r.is_private, r.is_available,
              COALESCE(pr.default_base_branch, r.default_branch) AS default_base_branch,
              r.default_branch, pr.settings, pr.created_at
       FROM github_project_repositories pr
       JOIN github_repositories r ON r.id = pr.repository_id
       WHERE pr.project_id = $1
       ORDER BY r.full_name`,
      [projectId],
    );

    const available = integration
      ? await db.query(
          `SELECT r.id, r.full_name, r.is_private, r.default_branch
           FROM github_repositories r
           WHERE r.integration_id = $1 AND r.is_available = TRUE
             AND NOT EXISTS (
               SELECT 1 FROM github_project_repositories pr
               WHERE pr.repository_id = r.id AND pr.project_id = $2)
           ORDER BY r.full_name`,
          [integration.id, projectId],
        )
      : { rows: [] };

    return res.status(200).send(
      new ServerResponse(true, {
        connected: !!integration,
        configured: GithubAppService.isConfigured(),
        linked: linked.rows,
        available: available.rows,
        statuses: await getProjectStatuses(projectId),
        sprints: await getOpenSprints(projectId),
        can_connect: canManageTeam(req),
        owner_name: integration ? null : await getTeamOwnerName(req.user?.team_id as string),
      }),
    );
  }

  @HandleExceptions()
  public static async linkRepository(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { projectId } = req.params;
    const { repository_id, default_base_branch } = req.body as { repository_id?: string; default_base_branch?: string };
    if (!repository_id) return res.status(400).send(new ServerResponse(false, null, "repository_id is required"));
    if (default_base_branch && !isValidBranchName(default_base_branch)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid branch name"));
    }

    const project = await db.query(`SELECT project_type FROM projects WHERE id = $1 AND team_id = $2`, [
      projectId,
      req.user?.team_id,
    ]);
    if (project.rows[0]?.project_type !== "software") {
      return res.status(400).send(new ServerResponse(false, null, "GitHub can only be linked to software projects"));
    }

    // The repository must belong to this team's installation.
    const repo = await db.query(
      `SELECT r.id FROM github_repositories r
       JOIN github_integrations i ON i.id = r.integration_id
       WHERE r.id = $1 AND i.team_id = $2 AND i.status = 'active' AND r.is_available = TRUE`,
      [repository_id, req.user?.team_id],
    );
    if (!repo.rowCount) return res.status(404).send(new ServerResponse(false, null, "Repository not found"));

    const defaultStatusMap = buildDefaultStatusMap(await getProjectStatuses(projectId));
    const result = await db.query(
      `INSERT INTO github_project_repositories (project_id, repository_id, default_base_branch, linked_by, settings)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (project_id, repository_id) DO NOTHING
       RETURNING id`,
      [
        projectId,
        repository_id,
        default_base_branch || null,
        req.user?.id,
        JSON.stringify({ status_map: defaultStatusMap }),
      ],
    );
    return res.status(200).send(new ServerResponse(true, { id: result.rows[0]?.id ?? null }));
  }

  @HandleExceptions()
  public static async updateRepositoryLink(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { projectId, linkId } = req.params;
    const body = req.body as {
      default_base_branch?: string | null;
      status_map?: Record<string, string | null>;
      import_settings?: {
        auto_import?: boolean;
        labels?: unknown;
        default_phase_id?: string | null;
        close_on_issue_close?: boolean;
      };
    };

    const updates: string[] = [];
    const values: unknown[] = [linkId, projectId];
    // status_map and import settings both live in `settings`; compose one assignment.
    let settingsExpr = "COALESCE(settings, '{}'::JSONB)";

    if ("default_base_branch" in body) {
      const branch = body.default_base_branch || null;
      if (branch && !isValidBranchName(branch)) {
        return res.status(400).send(new ServerResponse(false, null, "Invalid branch name"));
      }
      values.push(branch);
      updates.push(`default_base_branch = $${values.length}`);
    }

    if (body.status_map) {
      const statuses = await getProjectStatuses(projectId);
      const validIds = new Set(statuses.map(s => s.id));
      const statusMap: GithubStatusMap = {};
      for (const event of GITHUB_TRANSITION_EVENTS) {
        const value = body.status_map[event];
        if (value && !validIds.has(value)) {
          return res.status(400).send(new ServerResponse(false, null, `Invalid status for ${event}`));
        }
        statusMap[event] = value || null;
      }
      values.push(JSON.stringify(statusMap));
      settingsExpr = `jsonb_set(${settingsExpr}, '{status_map}', $${values.length}::JSONB, TRUE)`;
    }

    if (body.import_settings) {
      const raw = body.import_settings;
      const labels = Array.isArray(raw.labels)
        ? raw.labels.filter((l): l is string => typeof l === "string").map(l => l.trim()).filter(Boolean)
        : [];
      if (labels.length > 20 || labels.some(l => l.length > 50)) {
        return res.status(400).send(new ServerResponse(false, null, "Too many or too long labels"));
      }
      let phaseId: string | null = null;
      if (raw.default_phase_id) {
        const phase = await db.query(
          `SELECT 1 FROM project_phases
           WHERE id = $1 AND project_id = $2 AND sprint_status IN ('planned', 'active')`,
          [raw.default_phase_id, projectId],
        );
        if (!phase.rowCount) return res.status(400).send(new ServerResponse(false, null, "Sprint not found"));
        phaseId = raw.default_phase_id;
      }
      values.push(
        JSON.stringify({
          auto_import: !!raw.auto_import,
          labels,
          default_phase_id: phaseId,
          close_on_issue_close: !!raw.close_on_issue_close,
        }),
      );
      settingsExpr = `jsonb_set(${settingsExpr}, '{import}', $${values.length}::JSONB, TRUE)`;
    }

    if (body.status_map || body.import_settings) updates.push(`settings = ${settingsExpr}`);

    if (!updates.length) return res.status(400).send(new ServerResponse(false, null, "Nothing to update"));

    const result = await db.query(
      `UPDATE github_project_repositories
       SET ${updates.join(", ")}, updated_at = NOW()
       WHERE id = $1 AND project_id = $2
       RETURNING id`,
      values,
    );
    if (!result.rowCount) return res.status(404).send(new ServerResponse(false, null, "Link not found"));
    return res.status(200).send(new ServerResponse(true, null));
  }

  @HandleExceptions()
  public static async unlinkRepository(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { projectId, linkId } = req.params;
    await db.query(`DELETE FROM github_project_repositories WHERE id = $1 AND project_id = $2`, [linkId, projectId]);
    return res.status(200).send(new ServerResponse(true, null));
  }

  /** Branches, pull requests and commits linked to a task (Development panel). */
  @HandleExceptions()
  public static async getTaskDevelopment(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const taskId = req.params.id;

    const task = await db.query(
      `SELECT t.project_id, t.name, p.project_type, CONCAT(p.key, '-', t.task_no) AS task_key
       FROM tasks t JOIN projects p ON p.id = t.project_id
       WHERE t.id = $1 AND p.team_id = $2`,
      [taskId, req.user?.team_id],
    );
    if (!task.rowCount) return res.status(404).send(new ServerResponse(false, null, "Task not found"));

    const access = await getProjectAccessForRequest(req, task.rows[0].project_id);
    if (!access.permissions.tasks) {
      return res.status(403).send(new ServerResponse(false, null, "You are not authorized to perform this action"));
    }

    const [branches, pullRequests, commits, repos] = await Promise.all([
      db.query(
        `SELECT b.id, b.name, b.is_deleted, r.full_name AS repository,
                'https://github.com/' || r.full_name || '/tree/' || b.name AS html_url
         FROM github_task_links l
         JOIN github_branches b ON b.id = l.branch_id
         JOIN github_repositories r ON r.id = b.repository_id
         WHERE l.task_id = $1 ORDER BY b.updated_at DESC`,
        [taskId],
      ),
      db.query(
        `SELECT p.id, p.number, p.title, p.state, p.is_draft, p.merged, p.review_state,
                p.head_branch, p.base_branch, p.author_login, p.author_avatar_url, p.html_url,
                p.opened_at, p.merged_at, p.closed_at, l.closes, r.full_name AS repository
         FROM github_task_links l
         JOIN github_pull_requests p ON p.id = l.pull_request_id
         JOIN github_repositories r ON r.id = p.repository_id
         WHERE l.task_id = $1 ORDER BY p.last_event_at DESC`,
        [taskId],
      ),
      db.query(
        `SELECT c.id, c.sha, c.message, c.author_name, c.author_login, c.html_url, c.committed_at,
                r.full_name AS repository
         FROM github_task_links l
         JOIN github_commits c ON c.id = l.commit_id
         JOIN github_repositories r ON r.id = c.repository_id
         WHERE l.task_id = $1 ORDER BY c.committed_at DESC NULLS LAST LIMIT 50`,
        [taskId],
      ),
      db.query(
        `SELECT pr.repository_id, r.full_name,
                COALESCE(pr.default_base_branch, r.default_branch) AS default_base_branch
         FROM github_project_repositories pr
         JOIN github_repositories r ON r.id = pr.repository_id
         WHERE pr.project_id = $1 AND r.is_available = TRUE
         ORDER BY r.full_name`,
        [task.rows[0].project_id],
      ),
    ]);

    return res.status(200).send(
      new ServerResponse(true, {
        has_linked_repositories: repos.rowCount! > 0,
        repositories: repos.rows,
        task_key: task.rows[0].task_key,
        task_name: task.rows[0].name,
        branches: branches.rows,
        pull_requests: pullRequests.rows,
        commits: commits.rows,
      }),
    );
  }

  /** Create a branch on GitHub from the issue and link it. */
  @HandleExceptions()
  public static async createBranch(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const taskId = req.params.id;
    const { repository_id, name, base_branch } = req.body as {
      repository_id?: string;
      name?: string;
      base_branch?: string;
    };

    if (!repository_id || !isValidBranchName(name) || !isValidBranchName(base_branch)) {
      return res.status(400).send(new ServerResponse(false, null, "A valid repository, branch name and base branch are required"));
    }

    const target = await resolveTaskRepository(req, res, taskId, repository_id);
    if (!target) return res;
    const { fullName, installationId } = target;

    try {
      const sha = await GithubAppService.getBranchSha(installationId, fullName, base_branch);
      await GithubAppService.createBranch(installationId, fullName, name, sha);
    } catch (error) {
      if (error instanceof GithubApiError) {
        if (error.status === 422) {
          return res.status(409).send(new ServerResponse(false, null, "A branch with this name already exists"));
        }
        if (error.status === 404) {
          return res.status(404).send(new ServerResponse(false, null, "Base branch not found"));
        }
        if (error.status === 403) {
          return res.status(403).send(
            new ServerResponse(false, null, "The GitHub App needs Contents write permission to create branches"),
          );
        }
      }
      throw error;
    }

    const branch = await db.query(
      `INSERT INTO github_branches (repository_id, name)
       VALUES ($1, $2)
       ON CONFLICT (repository_id, name) DO UPDATE SET is_deleted = FALSE, updated_at = NOW()
       RETURNING id`,
      [repository_id, name],
    );
    await db.query(
      `INSERT INTO github_task_links (task_id, link_type, branch_id)
       VALUES ($1, 'branch', $2)
       ON CONFLICT (task_id, branch_id) WHERE branch_id IS NOT NULL DO NOTHING`,
      [taskId, branch.rows[0].id],
    );

    await reconcileTasks([taskId], repository_id);
    await notifyGithubActivity([taskId]);

    return res.status(200).send(
      new ServerResponse(true, {
        name,
        html_url: `https://github.com/${fullName}/tree/${name}`,
        checkout_command: `git fetch origin && git checkout -b ${name} origin/${name}`,
      }),
    );
  }

  /** Branches of a linked repository, for the Create Branch base-branch picker. */
  @HandleExceptions()
  public static async listRepositoryBranches(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const taskId = req.params.id;
    const repositoryId = req.query.repository_id;
    if (typeof repositoryId !== "string" || !isValidUuid(repositoryId)) {
      return res.status(400).send(new ServerResponse(false, null, "repository_id is required"));
    }

    const target = await resolveTaskRepository(req, res, taskId, repositoryId);
    if (!target) return res;

    const result = await GithubAppService.listBranches(target.installationId, target.fullName);
    return res.status(200).send(new ServerResponse(true, result));
  }

  /** Open/closed GitHub issues of a linked repository, flagged when already imported. */
  @HandleExceptions()
  public static async listRepositoryIssues(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { projectId, linkId } = req.params;
    const link = await getProjectLink(projectId, linkId, req.user?.team_id as string);
    if (!link) return res.status(404).send(new ServerResponse(false, null, "Repository link not found"));

    const stateParam = req.query.state;
    const state = stateParam === "closed" || stateParam === "all" ? stateParam : "open";
    const page = Math.min(Math.max(parseInt(String(req.query.page || "1"), 10) || 1, 1), 50);
    const labels = typeof req.query.labels === "string"
      ? req.query.labels.split(",").map(l => l.trim()).filter(Boolean).slice(0, 10)
      : [];

    const { issues, hasMore } = await GithubAppService.listIssues(link.installationId, link.fullName, {
      state,
      labels,
      page,
    });

    const imported = await db.query(
      `SELECT l.issue_number, CONCAT(p.key, '-', t.task_no) AS task_key
       FROM github_issue_links l
       JOIN tasks t ON t.id = l.task_id
       JOIN projects p ON p.id = t.project_id
       WHERE l.repository_id = $1 AND l.issue_number = ANY($2::INT[])`,
      [link.repositoryId, issues.map(i => i.number)],
    );
    const importedByNumber = new Map<number, string>(imported.rows.map(r => [r.issue_number, r.task_key]));

    return res.status(200).send(
      new ServerResponse(true, {
        has_more: hasMore,
        issues: issues.map(issue => ({
          number: issue.number,
          title: issue.title,
          state: issue.state,
          html_url: issue.html_url,
          labels: issueLabelNames(issue),
          assignee_login: issue.assignee?.login ?? null,
          created_at: issue.created_at,
          imported_task_key: importedByNumber.get(issue.number) ?? null,
        })),
      }),
    );
  }

  /** Import selected GitHub issues into the backlog or a sprint. */
  @HandleExceptions()
  public static async importRepositoryIssues(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { projectId, linkId } = req.params;
    const body = req.body as { numbers?: unknown; phase_id?: string | null };
    const link = await getProjectLink(projectId, linkId, req.user?.team_id as string);
    if (!link) return res.status(404).send(new ServerResponse(false, null, "Repository link not found"));

    const numbers = Array.isArray(body.numbers)
      ? [...new Set(body.numbers.filter((n): n is number => Number.isSafeInteger(n) && n > 0))]
      : [];
    if (!numbers.length || numbers.length > 50) {
      return res.status(400).send(new ServerResponse(false, null, "Select between 1 and 50 issues"));
    }

    let phaseId: string | null = null;
    if (body.phase_id) {
      const phase = await db.query(
        `SELECT 1 FROM project_phases
         WHERE id = $1 AND project_id = $2 AND sprint_status IN ('planned', 'active')`,
        [body.phase_id, projectId],
      );
      if (!phase.rowCount) return res.status(400).send(new ServerResponse(false, null, "Sprint not found"));
      phaseId = body.phase_id;
    }

    const imported: Array<{ number: number; task_key: string }> = [];
    const skipped: Array<{ number: number; reason: string }> = [];
    const importedTaskIds: string[] = [];

    for (const number of numbers) {
      try {
        const issue = await GithubAppService.getIssue(link.installationId, link.fullName, number);
        if (issue.pull_request) {
          skipped.push({ number, reason: "pull_request" });
          continue;
        }
        const outcome = await importGithubIssue(issue, {
          projectId,
          repositoryId: link.repositoryId,
          repositoryFullName: link.fullName,
          actorId: req.user?.id as string,
          phaseId,
        });
        if (outcome.status === "imported") {
          imported.push({ number, task_key: outcome.taskKey });
          importedTaskIds.push(outcome.taskId);
        } else {
          skipped.push({ number, reason: outcome.reason });
        }
      } catch (error) {
        log_error(error);
        skipped.push({ number, reason: "failed" });
      }
    }

    if (importedTaskIds.length) {
      IO.getInstance()?.to(projectId).emit(SocketEvents.PROJECT_UPDATES_AVAILABLE.toString());
      await notifyGithubActivity(importedTaskIds);
    }

    return res.status(200).send(new ServerResponse(true, { imported, skipped }));
  }

  /** Webhook health for the team: counts, last delivery and recent failures (owners/admins). */
  @HandleExceptions()
  public static async getSyncStatus(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    if (!canManageTeam(req)) {
      return res.status(403).send(new ServerResponse(false, null, "Only team owners and admins can view sync status"));
    }
    const integration = await db.query(
      `SELECT installation_id FROM github_integrations
       WHERE team_id = $1 AND status <> 'disconnected' LIMIT 1`,
      [req.user?.team_id],
    );
    if (!integration.rowCount) {
      return res.status(200).send(
        new ServerResponse(true, { connected: false, counts: {}, last_event_at: null, failed: [] }),
      );
    }
    const installationId = integration.rows[0].installation_id;

    const [counts, last, failed] = await Promise.all([
      db.query(
        `SELECT status, COUNT(*)::INT AS count FROM github_webhook_events
         WHERE installation_id = $1 AND received_at > NOW() - INTERVAL '7 days'
         GROUP BY status`,
        [installationId],
      ),
      db.query(
        `SELECT MAX(received_at) AS last_event_at FROM github_webhook_events WHERE installation_id = $1`,
        [installationId],
      ),
      db.query(
        `SELECT id, event_type, error_message, attempts, received_at
         FROM github_webhook_events
         WHERE installation_id = $1 AND status = 'failed'
         ORDER BY received_at DESC LIMIT 20`,
        [installationId],
      ),
    ]);

    return res.status(200).send(
      new ServerResponse(true, {
        connected: true,
        counts: Object.fromEntries(counts.rows.map(r => [r.status, r.count])),
        last_event_at: last.rows[0]?.last_event_at ?? null,
        failed: failed.rows,
      }),
    );
  }

  @HandleExceptions()
  public static async retryEvent(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    if (!canManageTeam(req)) {
      return res.status(403).send(new ServerResponse(false, null, "Only team owners and admins can retry events"));
    }
    const result = await db.query(
      `UPDATE github_webhook_events e
       SET status = 'pending', attempts = 0, error_message = NULL, next_attempt_at = NOW()
       FROM github_integrations i
       WHERE e.id = $1 AND e.status = 'failed'
         AND i.installation_id = e.installation_id AND i.team_id = $2
       RETURNING e.id`,
      [req.params.id, req.user?.team_id],
    );
    if (!result.rowCount) return res.status(404).send(new ServerResponse(false, null, "Event not found"));
    return res.status(200).send(new ServerResponse(true, null));
  }
}

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

const STATE_PURPOSE = "github-install";
const STATE_TTL = "15m";
const BRANCH_NAME_PATTERN = /^[A-Za-z0-9._/-]{1,255}$/;

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

    const state = jwt.sign(
      { purpose: STATE_PURPOSE, team_id: req.user?.team_id, user_id: req.user?.id },
      secret,
      { expiresIn: STATE_TTL },
    );
    const url = `https://github.com/apps/${config.slug}/installations/new?state=${encodeURIComponent(state)}`;
    return res.status(200).send(new ServerResponse(true, { url }));
  }

  /** Redirect target after the GitHub App install (browser navigation, session cookie present). */
  public static async installCallback(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const back = (status: string, reason?: string) => {
      const target = new URL(`${getFrontendOrigin()}/worklenz/settings/integrations`);
      target.searchParams.set("github", status);
      if (reason) target.searchParams.set("reason", reason);
      return res.redirect(target.toString());
    };

    try {
      const { installation_id, code, state, setup_action } = req.query as Record<string, string | undefined>;
      if (setup_action === "request") return back("requested");

      const secret = getStateSecret();
      let claims: { purpose?: string; team_id?: string; user_id?: string };
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
      }),
    );
  }

  @HandleExceptions()
  public static async linkRepository(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { projectId } = req.params;
    const { repository_id, default_base_branch } = req.body as { repository_id?: string; default_base_branch?: string };
    if (!repository_id) return res.status(400).send(new ServerResponse(false, null, "repository_id is required"));
    if (default_base_branch && !BRANCH_NAME_PATTERN.test(default_base_branch)) {
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

    const result = await db.query(
      `INSERT INTO github_project_repositories (project_id, repository_id, default_base_branch, linked_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (project_id, repository_id) DO NOTHING
       RETURNING id`,
      [projectId, repository_id, default_base_branch || null, req.user?.id],
    );
    return res.status(200).send(new ServerResponse(true, { id: result.rows[0]?.id ?? null }));
  }

  @HandleExceptions()
  public static async updateRepositoryLink(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { projectId, linkId } = req.params;
    const { default_base_branch } = req.body as { default_base_branch?: string | null };
    if (default_base_branch && !BRANCH_NAME_PATTERN.test(default_base_branch)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid branch name"));
    }
    const result = await db.query(
      `UPDATE github_project_repositories
       SET default_base_branch = $3, updated_at = NOW()
       WHERE id = $1 AND project_id = $2
       RETURNING id`,
      [linkId, projectId, default_base_branch || null],
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
      `SELECT t.project_id, p.project_type
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
        `SELECT COUNT(*)::INT AS count FROM github_project_repositories WHERE project_id = $1`,
        [task.rows[0].project_id],
      ),
    ]);

    return res.status(200).send(
      new ServerResponse(true, {
        has_linked_repositories: repos.rows[0].count > 0,
        branches: branches.rows,
        pull_requests: pullRequests.rows,
        commits: commits.rows,
      }),
    );
  }
}

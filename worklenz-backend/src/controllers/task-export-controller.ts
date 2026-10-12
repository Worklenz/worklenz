import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import TaskExportService from "../services/task-export/task-export.service";
import { TaskExportOptions } from "../services/task-export/types";
import db from "../config/db";

export default class TaskExportController extends WorklenzControllerBase {
  private static async assertProjectInTeam(
    projectId: string,
    teamId: string
  ): Promise<boolean> {
    const { rowCount } = await db.query(
      `SELECT 1 FROM projects WHERE id = $1::UUID AND team_id = $2::UUID LIMIT 1`,
      [projectId, teamId]
    );
    return (rowCount || 0) > 0;
  }

  private static parseOptions(body: Record<string, unknown>): TaskExportOptions {
    return TaskExportService.normalizeOptions({
      include_tasks: Boolean(body.include_tasks),
      include_comments: Boolean(body.include_comments),
      include_files: Boolean(body.include_files),
      scope: body.scope === "filtered" ? "filtered" : "project",
      task_ids: Array.isArray(body.task_ids)
        ? (body.task_ids as string[])
        : null,
    });
  }

  /**
   * Full project export from Task Export tab.
   * Sync CSV/ZIP when files are not included; async job when files are included.
   */
  @HandleExceptions()
  public static async create(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse | void> {
    const projectId = req.params.projectId;
    const userId = req.user?.id;
    const teamId = req.user?.team_id;

    if (!userId || !teamId) {
      return res
        .status(401)
        .send(new ServerResponse(false, null, "Unauthorized"));
    }

    if (!(await this.assertProjectInTeam(projectId, teamId))) {
      return res
        .status(404)
        .send(new ServerResponse(false, null, "Project not found"));
    }

    const options = this.parseOptions((req.body || {}) as Record<string, unknown>);
    if (
      !options.include_tasks &&
      !options.include_comments &&
      !options.include_files
    ) {
      return res
        .status(400)
        .send(
          new ServerResponse(
            false,
            null,
            "Select at least one of Tasks, Task Comments, or Files"
          )
        );
    }

    // Full-project export: never honor client task_ids (filtered uses createFiltered).
    const projectOptions = {
      ...options,
      scope: "project" as const,
      task_ids: null,
    };

    // Async path when bundling files
    if (projectOptions.include_files) {
      if (await TaskExportService.hasActiveAsyncJob(projectId)) {
        return res.status(409).send(
          new ServerResponse(
            false,
            null,
            "An export is already in progress for this project. Wait for it to finish before starting another."
          )
        );
      }

      try {
        const job = await TaskExportService.createJob({
          teamId,
          projectId,
          createdBy: userId,
          options: projectOptions,
        });

        return res.status(202).send(
          new ServerResponse(true, {
            mode: "async",
            job: TaskExportService.toPublicJob(job),
          })
        );
      } catch (error: unknown) {
        if (TaskExportService.isActiveJobConflict(error)) {
          return res.status(409).send(
            new ServerResponse(
              false,
              null,
              "An export is already in progress for this project. Wait for it to finish before starting another."
            )
          );
        }
        throw error;
      }
    }

    // Sync path — generate and stream download
    const artifact = await TaskExportService.buildExportArtifact(projectId, {
      ...projectOptions,
      include_files: false,
    });

    await TaskExportService.appendAuditLog({
      teamId,
      projectId,
      actorId: userId,
      action: "sync_exported",
      message: "Synchronous task export downloaded",
      context: artifact.stats,
    });

    res.setHeader("Content-Type", artifact.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${artifact.fileName}"`
    );
    res.setHeader("Content-Length", String(artifact.buffer.length));
    res.status(200).send(artifact.buffer);
  }

  /**
   * Filtered List/Board export — tasks CSV only, sync.
   */
  @HandleExceptions()
  public static async createFiltered(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse | void> {
    const projectId = req.params.projectId;
    const userId = req.user?.id;
    const teamId = req.user?.team_id;

    if (!userId || !teamId) {
      return res
        .status(401)
        .send(new ServerResponse(false, null, "Unauthorized"));
    }

    if (!(await this.assertProjectInTeam(projectId, teamId))) {
      return res
        .status(404)
        .send(new ServerResponse(false, null, "Project not found"));
    }

    const taskIds = Array.isArray(req.body?.task_ids)
      ? (req.body.task_ids as string[]).filter(Boolean)
      : [];

    if (taskIds.length === 0) {
      return res
        .status(400)
        .send(
          new ServerResponse(
            false,
            null,
            "No tasks match current filters"
          )
        );
    }

    const artifact = await TaskExportService.buildExportArtifact(projectId, {
      include_tasks: true,
      include_comments: false,
      include_files: false,
      scope: "filtered",
      task_ids: taskIds,
    });

    await TaskExportService.appendAuditLog({
      teamId,
      projectId,
      actorId: userId,
      action: "sync_exported",
      message: "Filtered task export downloaded",
      context: { ...artifact.stats, task_ids_count: taskIds.length },
    });

    res.setHeader("Content-Type", artifact.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${artifact.fileName}"`
    );
    res.setHeader("Content-Length", String(artifact.buffer.length));
    res.status(200).send(artifact.buffer);
  }

  @HandleExceptions()
  public static async list(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const projectId = req.params.projectId;
    const teamId = req.user?.team_id;

    if (!teamId || !(await this.assertProjectInTeam(projectId, teamId))) {
      return res
        .status(404)
        .send(new ServerResponse(false, null, "Project not found"));
    }

    const jobs = await TaskExportService.listJobsForProject(projectId);
    return res
      .status(200)
      .send(
        new ServerResponse(
          true,
          jobs.map((job) => TaskExportService.toPublicJob(job))
        )
      );
  }

  @HandleExceptions()
  public static async get(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const projectId = req.params.projectId;
    const jobId = req.params.jobId;
    const teamId = req.user?.team_id;

    if (!teamId || !(await this.assertProjectInTeam(projectId, teamId))) {
      return res
        .status(404)
        .send(new ServerResponse(false, null, "Project not found"));
    }

    const job = await TaskExportService.getJob(jobId);
    if (!job || job.project_id !== projectId) {
      return res
        .status(404)
        .send(new ServerResponse(false, null, "Export not found"));
    }

    return res
      .status(200)
      .send(new ServerResponse(true, TaskExportService.toPublicJob(job)));
  }

  /**
   * Re-checks export permission (via middleware) then issues a short-lived URL.
   */
  @HandleExceptions()
  public static async download(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const projectId = req.params.projectId;
    const jobId = req.params.jobId;
    const userId = req.user?.id;
    const teamId = req.user?.team_id;

    if (!userId || !teamId) {
      return res
        .status(401)
        .send(new ServerResponse(false, null, "Unauthorized"));
    }

    if (!(await this.assertProjectInTeam(projectId, teamId))) {
      return res
        .status(404)
        .send(new ServerResponse(false, null, "Project not found"));
    }

    const job = await TaskExportService.getJob(jobId);
    if (!job || job.project_id !== projectId) {
      return res
        .status(404)
        .send(new ServerResponse(false, null, "Export not found"));
    }

    // Requester must still be authorized (middleware) — also require same team
    if (job.team_id !== teamId) {
      return res
        .status(401)
        .send(
          new ServerResponse(
            false,
            null,
            "You are not authorized to perform this action"
          )
        );
    }

    const download = await TaskExportService.getDownloadUrl(job, userId);
    if (!download) {
      return res
        .status(410)
        .send(
          new ServerResponse(
            false,
            null,
            "Export is no longer available for download"
          )
        );
    }

    return res.status(200).send(new ServerResponse(true, download));
  }
}

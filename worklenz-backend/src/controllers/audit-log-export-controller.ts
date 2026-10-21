import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { buildAuditEventsWhereClause, parseAuditLogFilters } from "../shared/audit-log-query";
import { getAuditLogExportFileName } from "../shared/audit-log-csv";
import { AUDIT_LOG_EXPORT_SYNC_ROW_CAP } from "../services/audit-log-export/types";
import * as AuditLogExportService from "../services/audit-log-export/audit-log-export.service";

/**
 * CSV export for the Audit Log (Audit log spec, task 5).
 *
 * Mounted under /api/v1/admin-center/organization/audit-log/export (see
 * routes/apis/admin-center-api-router.ts), guarded by the same auditLogAccessValidator as
 * the read endpoint (task 4.4) - exporting is strictly a superset of viewing, so there is no
 * separate permission tier for it.
 */
export default class AuditLogExportController extends WorklenzControllerBase {
  /**
   * Task 5.1 + 5.2: POST /organization/audit-log/export
   *
   * Accepts the exact same filter query params as GET /organization/audit-log (task 4) -
   * see shared/audit-log-query.ts - so the export always honors whatever the user currently
   * has filtered/searched on screen.
   *
   * - Below AUDIT_LOG_EXPORT_SYNC_ROW_CAP matching rows: streams the CSV back immediately
   *   (200, Content-Disposition attachment) — task 5.1.
   * - At or above the cap: queues a background job and returns 202 with the job's public
   *   shape; the caller polls GET .../export/:jobId and then
   *   GET .../export/:jobId/download once status is "ready" — task 5.2.
   */
  @HandleExceptions()
  public static async create(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse | void> {
    const organizationId = req.user?.organization_id;
    const userId = req.user?.id;
    if (!organizationId || !userId) {
      return res.status(200).send(new ServerResponse(false, null, "Organization not found"));
    }

    const filters = parseAuditLogFilters(
      { ...req.query, ...req.body } as Record<string, unknown>,
      req.user?.timezone_name
    );
    const { whereClause, params } = buildAuditEventsWhereClause(organizationId, filters);

    const countResult = await db.query(
      `SELECT COUNT(*) AS total FROM audit_events WHERE ${whereClause};`,
      params
    );
    const total = +(countResult.rows[0]?.total || 0);

    // Sync path (5.1) — small enough to generate and stream within the request itself.
    if (total <= AUDIT_LOG_EXPORT_SYNC_ROW_CAP) {
      const { buffer } = await AuditLogExportService.buildExportCsv(organizationId, filters);
      const fileName = getAuditLogExportFileName();

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.setHeader("Content-Length", String(buffer.length));
      res.status(200).send(buffer);
      return;
    }

    // Async path (5.2) — over the threshold, queue a job instead of blocking the request.
    if (await AuditLogExportService.hasActiveAsyncJob(organizationId)) {
      return res.status(409).send(
        new ServerResponse(
          false,
          null,
          "An audit log export is already in progress for this workspace. Wait for it to finish before starting another."
        )
      );
    }

    try {
      const job = await AuditLogExportService.createJob({ organizationId, createdBy: userId, filters });
      return res.status(202).send(
        new ServerResponse(true, { mode: "async", job: AuditLogExportService.toPublicJob(job) })
      );
    } catch (error: unknown) {
      if (AuditLogExportService.isActiveJobConflict(error)) {
        return res.status(409).send(
          new ServerResponse(
            false,
            null,
            "An audit log export is already in progress for this workspace. Wait for it to finish before starting another."
          )
        );
      }
      throw error;
    }
  }

  /** GET /organization/audit-log/export/latest — body is null when there is no recent job. */
  @HandleExceptions()
  public static async latest(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_id;
    if (!organizationId) {
      return res.status(200).send(new ServerResponse(false, null, "Organization not found"));
    }

    const job = await AuditLogExportService.getLatestJob(organizationId);
    return res.status(200).send(new ServerResponse(true, job ? AuditLogExportService.toPublicJob(job) : null));
  }

  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_id;
    const jobId = req.params.jobId;

    const job = await AuditLogExportService.getJob(jobId);
    if (!job || job.organization_id !== organizationId) {
      return res.status(404).send(new ServerResponse(false, null, "Export not found"));
    }

    return res.status(200).send(new ServerResponse(true, AuditLogExportService.toPublicJob(job)));
  }

  @HandleExceptions()
  public static async download(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_id;
    const jobId = req.params.jobId;

    const job = await AuditLogExportService.getJob(jobId);
    if (!job || job.organization_id !== organizationId) {
      return res.status(404).send(new ServerResponse(false, null, "Export not found"));
    }

    const download = await AuditLogExportService.getDownloadUrl(job);
    if (!download) {
      return res.status(410).send(new ServerResponse(false, null, "Export is no longer available for download"));
    }

    return res.status(200).send(new ServerResponse(true, download));
  }
}

import AuditLogExportController from "../controllers/audit-log-export-controller";
import db from "../config/db";
import * as AuditLogExportService from "../services/audit-log-export/audit-log-export.service";
import { AUDIT_LOG_EXPORT_SYNC_ROW_CAP } from "../services/audit-log-export/types";
import { createMockRequest, createMockResponse } from "./utils/express-mock";

jest.mock("../config/db", () => ({
  query: jest.fn(),
}));

jest.mock("../services/audit-log-export/audit-log-export.service");

const SESSION_USER = { id: "user-1", organization_id: "org-1", team_id: "team-1" };

describe("AuditLogExportController.create", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("streams a CSV synchronously when the matching row count is under the sync cap", async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ total: String(AUDIT_LOG_EXPORT_SYNC_ROW_CAP) }] });
    (AuditLogExportService.buildExportCsv as jest.Mock).mockResolvedValue({
      buffer: Buffer.from("csv-content"),
      rowCount: AUDIT_LOG_EXPORT_SYNC_ROW_CAP,
      truncated: false,
    });

    const req = createMockRequest({ user: SESSION_USER, query: {} });
    const res = createMockResponse();

    await AuditLogExportController.create(req, res);

    expect(AuditLogExportService.createJob).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/csv; charset=utf-8");
    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      expect.stringContaining("attachment; filename=")
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(Buffer.from("csv-content"));
  });

  it("queues a background job and returns 202 when over the sync cap", async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ total: String(AUDIT_LOG_EXPORT_SYNC_ROW_CAP + 1) }] });
    (AuditLogExportService.hasActiveAsyncJob as jest.Mock).mockResolvedValue(false);
    (AuditLogExportService.createJob as jest.Mock).mockResolvedValue({ id: "job-1", status: "queued" });
    (AuditLogExportService.toPublicJob as jest.Mock).mockReturnValue({ id: "job-1", status: "queued" });

    const req = createMockRequest({ user: SESSION_USER, query: {} });
    const res = createMockResponse();

    await AuditLogExportController.create(req, res);

    expect(AuditLogExportService.buildExportCsv).not.toHaveBeenCalled();
    expect(AuditLogExportService.createJob).toHaveBeenCalledWith({
      organizationId: "org-1",
      createdBy: "user-1",
      filters: expect.any(Object),
    });
    expect(res.statusCode).toBe(202);
    expect(res.body.done).toBe(true);
    expect(res.body.body).toEqual({ mode: "async", job: { id: "job-1", status: "queued" } });
  });

  it("returns 409 when an export is already in progress for the organization", async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ total: String(AUDIT_LOG_EXPORT_SYNC_ROW_CAP + 1) }] });
    (AuditLogExportService.hasActiveAsyncJob as jest.Mock).mockResolvedValue(true);

    const req = createMockRequest({ user: SESSION_USER, query: {} });
    const res = createMockResponse();

    await AuditLogExportController.create(req, res);

    expect(AuditLogExportService.createJob).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(409);
    expect(res.body.done).toBe(false);
  });

  it("returns 409 on a unique-index race from createJob itself", async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ total: String(AUDIT_LOG_EXPORT_SYNC_ROW_CAP + 1) }] });
    (AuditLogExportService.hasActiveAsyncJob as jest.Mock).mockResolvedValue(false);
    (AuditLogExportService.createJob as jest.Mock).mockRejectedValue({ code: "23505" });
    (AuditLogExportService.isActiveJobConflict as jest.Mock).mockReturnValue(true);

    const req = createMockRequest({ user: SESSION_USER, query: {} });
    const res = createMockResponse();

    await AuditLogExportController.create(req, res);

    expect(res.statusCode).toBe(409);
  });

  it("returns 200 with done=false when organization_id is missing from the session", async () => {
    const req = createMockRequest({ user: { id: "user-1" } });
    const res = createMockResponse();

    await AuditLogExportController.create(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.done).toBe(false);
    expect(db.query).not.toHaveBeenCalled();
  });

  it("applies the exact same filters as the list endpoint to the COUNT query", async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [{ total: "0" }] });
    (AuditLogExportService.buildExportCsv as jest.Mock).mockResolvedValue({
      buffer: Buffer.from(""),
      rowCount: 0,
      truncated: false,
    });

    const req = createMockRequest({
      user: SESSION_USER,
      query: { category: "access,user", start_date: "2026-09-01" },
    });
    const res = createMockResponse();

    await AuditLogExportController.create(req, res);

    const [sql, params] = (db.query as jest.Mock).mock.calls[0];
    expect(sql).toContain("organization_id = $1");
    expect(sql).toContain("created_at >= $2::DATE");
    expect(sql).toContain("category = ANY($3::TEXT[])");
    expect(params[0]).toBe("org-1");
    expect(params[1]).toBe("2026-09-01");
    expect(params[2]).toEqual(["access", "user"]);
  });
});

describe("AuditLogExportController.get", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 404 when the job doesn't belong to the caller's organization", async () => {
    (AuditLogExportService.getJob as jest.Mock).mockResolvedValue({ id: "job-1", organization_id: "org-OTHER" });

    const req = createMockRequest({ user: SESSION_USER, params: { jobId: "job-1" } });
    const res = createMockResponse();

    await AuditLogExportController.get(req, res);

    expect(res.statusCode).toBe(404);
  });

  it("returns the public job shape when it belongs to the caller's organization", async () => {
    (AuditLogExportService.getJob as jest.Mock).mockResolvedValue({ id: "job-1", organization_id: "org-1" });
    (AuditLogExportService.toPublicJob as jest.Mock).mockReturnValue({ id: "job-1", status: "ready" });

    const req = createMockRequest({ user: SESSION_USER, params: { jobId: "job-1" } });
    const res = createMockResponse();

    await AuditLogExportController.get(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.body).toEqual({ id: "job-1", status: "ready" });
  });
});

describe("AuditLogExportController.download", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 410 when the download is no longer available", async () => {
    (AuditLogExportService.getJob as jest.Mock).mockResolvedValue({ id: "job-1", organization_id: "org-1" });
    (AuditLogExportService.getDownloadUrl as jest.Mock).mockResolvedValue(null);

    const req = createMockRequest({ user: SESSION_USER, params: { jobId: "job-1" } });
    const res = createMockResponse();

    await AuditLogExportController.download(req, res);

    expect(res.statusCode).toBe(410);
  });

  it("returns the presigned download url when available", async () => {
    (AuditLogExportService.getJob as jest.Mock).mockResolvedValue({ id: "job-1", organization_id: "org-1" });
    (AuditLogExportService.getDownloadUrl as jest.Mock).mockResolvedValue({
      url: "https://signed",
      expires_in: 3600,
      file_name: "audit-log-export-2026-10-06.csv",
    });

    const req = createMockRequest({ user: SESSION_USER, params: { jobId: "job-1" } });
    const res = createMockResponse();

    await AuditLogExportController.download(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.body.url).toBe("https://signed");
  });
});

describe("AuditLogExportController.latest", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns the organization's most recent job in its public shape", async () => {
    (AuditLogExportService.getLatestJob as jest.Mock).mockResolvedValue({ id: "job-1", organization_id: "org-1" });
    (AuditLogExportService.toPublicJob as jest.Mock).mockReturnValue({ id: "job-1", status: "processing" });
    const req = createMockRequest({ user: SESSION_USER });
    const res = createMockResponse();

    await AuditLogExportController.latest(req, res);

    expect(AuditLogExportService.getLatestJob).toHaveBeenCalledWith("org-1");
    expect(res.body.body).toEqual({ id: "job-1", status: "processing" });
  });

  it("returns a null body when there is no recent job", async () => {
    (AuditLogExportService.getLatestJob as jest.Mock).mockResolvedValue(null);
    const req = createMockRequest({ user: SESSION_USER });
    const res = createMockResponse();

    await AuditLogExportController.latest(req, res);

    expect(res.body.done).toBe(true);
    expect(res.body.body).toBeNull();
  });
});

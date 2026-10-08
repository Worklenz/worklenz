import db from "../config/db";
import * as storage from "../shared/storage";
import * as AuditLogExportService from "../services/audit-log-export/audit-log-export.service";
import { AUDIT_LOG_EXPORT_MAX_ROWS } from "../services/audit-log-export/types";

jest.mock("../config/db", () => ({
  query: jest.fn(),
}));

jest.mock("../shared/storage", () => ({
  getAuditLogExportStorageKey: jest.fn(() => "secure/organizations/org-1/audit-log-exports/job-1.csv"),
  uploadBuffer: jest.fn(),
  createPresignedUrlWithClient: jest.fn(),
}));

const EMPTY_FILTERS = { startDate: "", endDate: "", categories: [], actorUserIds: [], search: "" };

const JOB_ROW = {
  id: "job-1",
  organization_id: "org-1",
  created_by: "user-1",
  status: "queued",
  filters: JSON.stringify(EMPTY_FILTERS),
  row_count: null,
  storage_key: null,
  file_name: null,
  size_bytes: null,
  error_message: null,
  expires_at: null,
  created_at: "2026-10-01T00:00:00.000Z",
  updated_at: "2026-10-01T00:00:00.000Z",
};

describe("AuditLogExportService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createJob", () => {
    it("inserts a queued job with the given filters", async () => {
      (db.query as jest.Mock).mockResolvedValue({ rows: [JOB_ROW] });

      const job = await AuditLogExportService.createJob({
        organizationId: "org-1",
        createdBy: "user-1",
        filters: EMPTY_FILTERS,
      });

      const [sql, params] = (db.query as jest.Mock).mock.calls[0];
      expect(sql).toContain("INSERT INTO audit_log_export_jobs");
      expect(sql).toContain("'queued'");
      expect(params[0]).toBe("org-1");
      expect(params[1]).toBe("user-1");
      expect(JSON.parse(params[2])).toEqual(EMPTY_FILTERS);
      expect(job.id).toBe("job-1");
      expect(job.status).toBe("queued");
    });
  });

  describe("isActiveJobConflict", () => {
    it("returns true for a unique-violation error code", () => {
      expect(AuditLogExportService.isActiveJobConflict({ code: "23505" })).toBe(true);
    });

    it("returns false for any other error", () => {
      expect(AuditLogExportService.isActiveJobConflict({ code: "22P02" })).toBe(false);
      expect(AuditLogExportService.isActiveJobConflict(new Error("boom"))).toBe(false);
      expect(AuditLogExportService.isActiveJobConflict(null)).toBe(false);
    });
  });

  describe("getLatestJob", () => {
    it("queries the organization's newest job from the last 24 hours", async () => {
      (db.query as jest.Mock).mockResolvedValue({
        rows: [{ id: "job-1", organization_id: "org-1", created_by: "user-1", status: "ready", filters: {} }],
      });

      const job = await AuditLogExportService.getLatestJob("org-1");

      const [sql, params] = (db.query as jest.Mock).mock.calls[0];
      expect(sql).toMatch(/created_at > NOW\(\) - INTERVAL '24 hours'/);
      expect(sql).toMatch(/ORDER BY created_at DESC\s+LIMIT 1/);
      expect(params).toEqual(["org-1"]);
      expect(job?.id).toBe("job-1");
    });

    it("returns null when there is no recent job", async () => {
      (db.query as jest.Mock).mockResolvedValue({ rows: [] });
      await expect(AuditLogExportService.getLatestJob("org-1")).resolves.toBeNull();
    });
  });

  describe("hasActiveAsyncJob", () => {
    it("returns true when a queued/processing job exists", async () => {
      (db.query as jest.Mock).mockResolvedValue({ rowCount: 1 });
      await expect(AuditLogExportService.hasActiveAsyncJob("org-1")).resolves.toBe(true);
    });

    it("returns false when no active job exists", async () => {
      (db.query as jest.Mock).mockResolvedValue({ rowCount: 0 });
      await expect(AuditLogExportService.hasActiveAsyncJob("org-1")).resolves.toBe(false);
    });
  });

  describe("buildExportCsv", () => {
    it("queries with the organization scope and a LIMIT one over the row cap", async () => {
      (db.query as jest.Mock).mockResolvedValue({
        rows: [
          {
            created_at: "2026-10-01T10:00:00.000Z",
            actor_name: "Ruwan Perera",
            category: "lifecycle",
            event_type: "project_created",
            description: "Created project X",
          },
        ],
      });

      const { buffer, rowCount, truncated } = await AuditLogExportService.buildExportCsv("org-1", EMPTY_FILTERS);

      const [sql, params] = (db.query as jest.Mock).mock.calls[0];
      expect(sql).toContain("organization_id = $1");
      expect(sql).toContain("ORDER BY created_at DESC, id DESC");
      expect(params[params.length - 1]).toBe(AUDIT_LOG_EXPORT_MAX_ROWS + 1);
      expect(rowCount).toBe(1);
      expect(truncated).toBe(false);
      expect(buffer.toString("utf8")).toContain("Created project X");
    });

    it("truncates and appends a note when the result exceeds the max row cap", async () => {
      const rows = Array.from({ length: AUDIT_LOG_EXPORT_MAX_ROWS + 1 }, (_, i) => ({
        created_at: "2026-10-01T10:00:00.000Z",
        actor_name: "Actor",
        category: "lifecycle",
        event_type: "project_created",
        description: `Row ${i}`,
      }));
      (db.query as jest.Mock).mockResolvedValue({ rows });

      const { rowCount, truncated, buffer } = await AuditLogExportService.buildExportCsv("org-1", EMPTY_FILTERS);

      expect(rowCount).toBe(AUDIT_LOG_EXPORT_MAX_ROWS);
      expect(truncated).toBe(true);
      expect(buffer.toString("utf8")).toContain("Export limited to the first");
    });
  });

  describe("processJob", () => {
    it("builds the CSV, uploads it, and marks the job ready with stats", async () => {
      (db.query as jest.Mock)
        .mockResolvedValueOnce({
          rows: [
            {
              created_at: "2026-10-01T10:00:00.000Z",
              actor_name: "Ruwan Perera",
              category: "lifecycle",
              event_type: "project_created",
              description: "Created project X",
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [{ ...JOB_ROW, status: "ready" }] });
      (storage.uploadBuffer as jest.Mock).mockResolvedValue("https://storage/example.csv");

      await AuditLogExportService.processJob({
        id: "job-1",
        organization_id: "org-1",
        created_by: "user-1",
        status: "processing",
        filters: EMPTY_FILTERS,
        row_count: null,
        storage_key: null,
        file_name: null,
        size_bytes: null,
        error_message: null,
        expires_at: null,
        created_at: "2026-10-01T00:00:00.000Z",
        updated_at: "2026-10-01T00:00:00.000Z",
      });

      expect(storage.uploadBuffer).toHaveBeenCalledWith(
        expect.any(Buffer),
        "text/csv",
        "secure/organizations/org-1/audit-log-exports/job-1.csv"
      );

      const [updateSql, updateParams] = (db.query as jest.Mock).mock.calls[1];
      expect(updateSql).toContain("UPDATE audit_log_export_jobs");
      expect(updateParams[1]).toBe("ready");
    });

    it("marks the job failed and rethrows when the upload fails", async () => {
      (db.query as jest.Mock)
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ ...JOB_ROW, status: "failed" }] });
      (storage.uploadBuffer as jest.Mock).mockResolvedValue(null);

      await expect(
        AuditLogExportService.processJob({
          id: "job-1",
          organization_id: "org-1",
          created_by: "user-1",
          status: "processing",
          filters: EMPTY_FILTERS,
          row_count: null,
          storage_key: null,
          file_name: null,
          size_bytes: null,
          error_message: null,
          expires_at: null,
          created_at: "2026-10-01T00:00:00.000Z",
          updated_at: "2026-10-01T00:00:00.000Z",
        })
      ).rejects.toThrow("Failed to upload audit log export artifact to storage");

      const [, updateParams] = (db.query as jest.Mock).mock.calls[1];
      expect(updateParams[1]).toBe("failed");
    });
  });

  describe("isDownloadAvailable", () => {
    it("is false when not ready", () => {
      expect(AuditLogExportService.isDownloadAvailable({ status: "queued", storage_key: "k", expires_at: null })).toBe(
        false
      );
    });

    it("is false without a storage key", () => {
      expect(AuditLogExportService.isDownloadAvailable({ status: "ready", storage_key: null, expires_at: null })).toBe(
        false
      );
    });

    it("is false once past the expiry window", () => {
      const past = new Date(Date.now() - 1000).toISOString();
      expect(
        AuditLogExportService.isDownloadAvailable({ status: "ready", storage_key: "k", expires_at: past })
      ).toBe(false);
    });

    it("is true when ready, present, and unexpired", () => {
      const future = new Date(Date.now() + 1000 * 60 * 60).toISOString();
      expect(
        AuditLogExportService.isDownloadAvailable({ status: "ready", storage_key: "k", expires_at: future })
      ).toBe(true);
    });
  });

  describe("getDownloadUrl", () => {
    it("returns null when the job isn't downloadable", async () => {
      const result = await AuditLogExportService.getDownloadUrl({ ...JOB_ROW, status: "queued" } as any);
      expect(result).toBeNull();
      expect(storage.createPresignedUrlWithClient).not.toHaveBeenCalled();
    });

    it("returns a presigned url for a ready job", async () => {
      (storage.createPresignedUrlWithClient as jest.Mock).mockResolvedValue("https://signed-url");
      const future = new Date(Date.now() + 1000 * 60 * 60).toISOString();

      const result = await AuditLogExportService.getDownloadUrl({
        ...JOB_ROW,
        status: "ready",
        storage_key: "k",
        file_name: "audit-log-export-2026-10-06.csv",
        expires_at: future,
      } as any);

      expect(result).toEqual({
        url: "https://signed-url",
        expires_in: 3600,
        file_name: "audit-log-export-2026-10-06.csv",
      });
    });
  });

  describe("toPublicJob", () => {
    it("exposes only the public-safe fields plus a derived can_download flag", () => {
      const publicJob = AuditLogExportService.toPublicJob({ ...JOB_ROW, status: "queued" } as any);
      expect(publicJob).toEqual({
        id: "job-1",
        status: "queued",
        row_count: null,
        file_name: null,
        size_bytes: null,
        error_message: null,
        expires_at: null,
        created_at: "2026-10-01T00:00:00.000Z",
        can_download: false,
      });
      expect((publicJob as any).organization_id).toBeUndefined();
      expect((publicJob as any).created_by).toBeUndefined();
    });
  });
});

/**
 * Phase 6 — Testing & acceptance (TE-34 … TE-38).
 * TE-33 permission decision: task-export-access-validator.spec.ts
 * TE-33 UI + Flows 3–5: frontend filtered-task-export-button.test.tsx
 */
jest.mock("../services/task-export/task-export-bundler", () => ({
  collectAttachmentZipEntries: jest.fn(),
}));
jest.mock("../services/task-export/task-export-data", () => ({
  fetchAttachmentsForExport: jest.fn(),
  fetchCommentsForExport: jest.fn(),
  fetchProjectCustomFields: jest.fn(),
  fetchTasksForExport: jest.fn(),
}));

jest.unmock("../shared/csv-utils");
jest.unmock("../shared/sanitize-filename");
jest.unmock("../services/task-export-csv/columns");
jest.unmock("../services/task-export-csv/custom-fields");
jest.unmock("../services/task-export-csv/formatters");
jest.unmock("../services/task-export-csv/task-export-csv.service");
jest.unmock("../services/task-export-csv/types");
jest.unmock("../services/task-export-csv/index");
jest.unmock("../services/task-export/task-export-options");
jest.unmock("../services/task-export/task-export-availability");
jest.unmock("../services/task-export/task-export-public");
jest.unmock("../services/task-export/task-export-zip");
jest.unmock("../services/task-export/task-export-artifact");
jest.unmock("../services/task-export/types");
// Keep task-export-bundler mocked (avoids AWS SDK via storage.ts).
jest.unmock("./fixtures/task-export-csv.fixtures");
jest.unmock("moment");
jest.unmock("archiver");
jest.unmock("stream");

import moment from "moment";
import { CSV_UTF8_BOM } from "../shared/csv-utils";
import {
  buildTaskExportHeaders,
  generateCommentsCsv,
  generateTasksCsv,
  getStandardTaskExportHeaders,
  getTaskCommentsExportHeaders,
  TASK_COMMENTS_EXPORT_COLUMNS,
  TASK_EXPORT_STANDARD_COLUMNS,
} from "../services/task-export-csv";
import { buildTaskExportArtifact } from "../services/task-export/task-export-artifact";
import {
  isTaskExportDownloadAvailable,
  isTaskExportPastRetention,
  TASK_EXPORT_NON_DOWNLOADABLE_STATUSES,
} from "../services/task-export/task-export-availability";
import { toPublicTaskExportJob } from "../services/task-export/task-export-public";
import {
  buildUniqueAttachmentZipPath,
  createZipBuffer,
} from "../services/task-export/task-export-zip";
import {
  TASK_EXPORT_RETENTION_DAYS,
  TaskExportJob,
} from "../services/task-export/types";
import {
  fetchAttachmentsForExport,
  fetchCommentsForExport,
  fetchProjectCustomFields,
  fetchTasksForExport,
} from "../services/task-export/task-export-data";
import { collectAttachmentZipEntries } from "../services/task-export/task-export-bundler";
import {
  FIXTURE_COMMENTS,
  FIXTURE_CUSTOM_FIELDS,
  FIXTURE_TASK_ESCAPING,
  FIXTURE_TASK_PLAIN,
  FIXTURE_TASK_UNICODE,
} from "./fixtures/task-export-csv.fixtures";

const countTaskIdCells = (csv: string, taskKeys: string[]): number => {
  const body = csv.replace(CSV_UTF8_BOM, "");
  return taskKeys.reduce((sum, key) => {
    const matches = body.match(new RegExp(`"${key}"`, "g"));
    return sum + (matches ? matches.length : 0);
  }, 0);
};

const readyJob = (overrides: Partial<TaskExportJob> = {}): TaskExportJob => ({
  id: "job-1",
  team_id: "team-1",
  project_id: "proj-1",
  created_by: "user-1",
  status: "ready",
  options: {
    include_tasks: true,
    include_comments: false,
    include_files: true,
    scope: "project",
    task_ids: null,
  },
  stats: {},
  storage_key: "exports/team/proj/job.zip",
  file_name: "task-export.zip",
  content_type: "application/zip",
  size_bytes: 100,
  error_message: null,
  expires_at: moment.utc().add(3, "days").toISOString(),
  created_at: moment.utc().toISOString(),
  updated_at: moment.utc().toISOString(),
  ...overrides,
});

describe("TE-34: CSV correctness (Acceptance Criteria)", () => {
  it("Tasks CSV includes every standard column from Requirements", () => {
    expect(TASK_EXPORT_STANDARD_COLUMNS).toHaveLength(19);
    expect(getStandardTaskExportHeaders()).toEqual([
      "Task ID",
      "Task Name",
      "Description",
      "Status",
      "Priority",
      "Phase",
      "Assignee(s)",
      "Reporter",
      "Labels",
      "Start Date",
      "Due Date",
      "Completed Date",
      "Estimated Time",
      "Time Spent",
      "Progress %",
      "Parent Task",
      "Is Subtask",
      "Created At",
      "Updated At",
    ]);
  });

  it("Tasks CSV appends one column per project custom field", () => {
    const headers = buildTaskExportHeaders(FIXTURE_CUSTOM_FIELDS);
    expect(headers.slice(19)).toEqual([
      "Story Points",
      "Client Ref",
      "Approved",
      "Reviewers",
    ]);
  });

  it("Task Comments CSV is separate and joins via Task ID on every row", () => {
    expect(TASK_COMMENTS_EXPORT_COLUMNS.map((c) => c.header)).toEqual(
      getTaskCommentsExportHeaders()
    );
    expect(getTaskCommentsExportHeaders()[0]).toBe("Task ID");
    expect(getTaskCommentsExportHeaders()).toContain("Attachments");

    const tasksCsv = generateTasksCsv(
      [FIXTURE_TASK_PLAIN, FIXTURE_TASK_ESCAPING],
      []
    );
    const commentsCsv = generateCommentsCsv(FIXTURE_COMMENTS);

    expect(tasksCsv).not.toEqual(commentsCsv);
    expect(commentsCsv).toContain('"ACME-1"');
    expect(commentsCsv).toContain('"ACME-2"');
    expect(tasksCsv).toContain('"ACME-1"');
    expect(tasksCsv).toContain('"ACME-2"');
  });

  it("escapes commas, quotes, and line breaks for Excel/Sheets", () => {
    const csv = generateTasksCsv([FIXTURE_TASK_ESCAPING], FIXTURE_CUSTOM_FIELDS);
    expect(csv.startsWith(CSV_UTF8_BOM)).toBe(true);
    expect(csv).toContain('"Task with ""quotes"", commas, and\nnewlines"');
    expect(csv).toContain('"Value, with ""comma"""');
  });
});

describe("TE-35: ZIP structure (folder-per-task, no collisions)", () => {
  it("places each attachment under its task key folder", () => {
    const used = new Set<string>();
    expect(buildUniqueAttachmentZipPath("ACME-1", "a.png", used)).toBe(
      "ACME-1/a.png"
    );
    expect(buildUniqueAttachmentZipPath("ACME-2", "a.png", used)).toBe(
      "ACME-2/a.png"
    );
  });

  it("avoids filename collisions within the same task folder", () => {
    const used = new Set<string>();
    expect(buildUniqueAttachmentZipPath("T-1", "doc.pdf", used)).toBe(
      "T-1/doc.pdf"
    );
    expect(buildUniqueAttachmentZipPath("T-1", "doc.pdf", used)).toBe(
      "T-1/doc (1).pdf"
    );
  });

  it("bundles CSVs + attachment paths without empty dirs", async () => {
    const buffer = await createZipBuffer([
      { path: "tasks.csv", data: "id\n" },
      { path: "comments.csv", data: "id\n" },
      { path: "ACME-1/shot.png", data: Buffer.from("img") },
      { path: "ACME-empty/", data: "" },
    ]);
    const raw = buffer.toString("binary");
    expect(raw).toContain("tasks.csv");
    expect(raw).toContain("comments.csv");
    expect(raw).toContain("ACME-1/shot.png");
    expect(raw).not.toContain("ACME-empty/");
  });
});

describe("TE-36: Retention / expiry (download stops after window)", () => {
  it(`uses a ${TASK_EXPORT_RETENTION_DAYS}-day retention window`, () => {
    expect(TASK_EXPORT_RETENTION_DAYS).toBe(7);
  });

  it("marks past expires_at as past retention", () => {
    expect(
      isTaskExportPastRetention(moment.utc().subtract(1, "minute").toISOString())
    ).toBe(true);
    expect(
      isTaskExportPastRetention(moment.utc().add(1, "day").toISOString())
    ).toBe(false);
  });

  it("download_available is false after retention and for non-ready statuses", () => {
    expect(isTaskExportDownloadAvailable(readyJob())).toBe(true);
    expect(
      isTaskExportDownloadAvailable(
        readyJob({
          expires_at: moment.utc().subtract(1, "hour").toISOString(),
        })
      )
    ).toBe(false);

    for (const status of TASK_EXPORT_NON_DOWNLOADABLE_STATUSES) {
      expect(isTaskExportDownloadAvailable(readyJob({ status }))).toBe(false);
    }
  });

  it("toPublicTaskExportJob.download_available mirrors retention gate", () => {
    expect(toPublicTaskExportJob(readyJob()).download_available).toBe(true);

    const expired = toPublicTaskExportJob(
      readyJob({
        expires_at: moment.utc().subtract(8, "days").toISOString(),
      })
    );
    expect(expired.download_available).toBe(false);
    // Until cleanup cron runs, status_raw may still be ready — UI must use download_available
    expect(expired.status_raw).toBe("ready");
    expect(expired.status).toBe("Ready");
  });
});

describe("TE-37: Filtered-export count verification", () => {
  beforeEach(() => {
    (fetchProjectCustomFields as jest.Mock).mockResolvedValue([]);
    (fetchCommentsForExport as jest.Mock).mockResolvedValue([]);
    (fetchAttachmentsForExport as jest.Mock).mockResolvedValue([]);
  });

  it("CSV task_count and Task ID cells match the filtered task set size", async () => {
    const filtered = [FIXTURE_TASK_PLAIN, FIXTURE_TASK_UNICODE];
    (fetchTasksForExport as jest.Mock).mockResolvedValue(filtered);

    const taskIds = ["id-plain", "id-unicode"];
    const artifact = await buildTaskExportArtifact("proj-1", {
      include_tasks: true,
      include_comments: false,
      include_files: false,
      scope: "filtered",
      task_ids: taskIds,
    });

    expect(fetchTasksForExport).toHaveBeenCalledWith("proj-1", taskIds);
    expect(artifact.stats.task_count).toBe(filtered.length);
    expect(artifact.contentType).toContain("csv");

    const csv = artifact.buffer.toString("utf8");
    expect(countTaskIdCells(csv, ["ACME-1", "ACME-3"])).toBe(2);
    expect(csv).not.toContain("ACME-2");
  });
});

describe("TE-38: User flows (spec Flows 1–2 via buildTaskExportArtifact)", () => {
  beforeEach(() => {
    (fetchProjectCustomFields as jest.Mock).mockResolvedValue(
      FIXTURE_CUSTOM_FIELDS
    );
    (fetchTasksForExport as jest.Mock).mockResolvedValue([
      FIXTURE_TASK_PLAIN,
      FIXTURE_TASK_ESCAPING,
    ]);
    (fetchCommentsForExport as jest.Mock).mockResolvedValue(FIXTURE_COMMENTS);
    (fetchAttachmentsForExport as jest.Mock).mockResolvedValue([]);
  });

  it("Flow 1 — Tasks + Comments, no Files → sync ZIP with both CSVs", async () => {
    const artifact = await buildTaskExportArtifact("proj-1", {
      include_tasks: true,
      include_comments: true,
      include_files: false,
      scope: "project",
      task_ids: null,
    });

    expect(artifact.contentType).toBe("application/zip");
    expect(artifact.fileName).toMatch(/\.zip$/);
    const raw = artifact.buffer.toString("binary");
    expect(raw).toContain("tasks.csv");
    expect(raw).toContain("comments.csv");
    expect(artifact.stats.task_count).toBe(2);
    expect(artifact.stats.comment_count).toBe(2);
  });

  it("Flow 2 — Files included → ZIP contains attachment folders", async () => {
    (fetchAttachmentsForExport as jest.Mock).mockResolvedValue([
      {
        id: "att-1",
        name: "design.png",
        type: "image/png",
        size: 4,
        task_id: "t1",
        task_key: "ACME-1",
        team_id: "team-1",
        project_id: "proj-1",
      },
    ]);
    (collectAttachmentZipEntries as jest.Mock).mockResolvedValue({
      entries: [{ path: "ACME-1/design.png", data: Buffer.from("img") }],
      totalBytes: 3,
      fileCount: 1,
      skippedMissing: 0,
    });

    const artifact = await buildTaskExportArtifact("proj-1", {
      include_tasks: true,
      include_comments: true,
      include_files: true,
      scope: "project",
      task_ids: null,
    });

    expect(fetchAttachmentsForExport).toHaveBeenCalledWith("proj-1", null);
    expect(collectAttachmentZipEntries).toHaveBeenCalled();
    expect(artifact.contentType).toBe("application/zip");
    expect(artifact.stats.file_count).toBe(1);
    const raw = artifact.buffer.toString("binary");
    expect(raw).toContain("tasks.csv");
    expect(raw).toContain("comments.csv");
    expect(raw).toContain("ACME-1/design.png");
  });

  it("Tasks-only sync path returns a single CSV (not a background job artifact shape)", async () => {
    const artifact = await buildTaskExportArtifact("proj-1", {
      include_tasks: true,
      include_comments: false,
      include_files: false,
      scope: "project",
      task_ids: null,
    });

    expect(artifact.contentType).toContain("csv");
    expect(artifact.fileName).toBe("tasks.csv");
  });
});

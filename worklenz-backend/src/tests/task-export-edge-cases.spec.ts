/**
 * Phase 5 — Task Export edge cases (TE-29 … TE-32).
 * Locks behavior that already lives in CSV / ZIP / options helpers.
 */
jest.unmock("../shared/csv-utils");
jest.unmock("../services/task-export-csv/columns");
jest.unmock("../services/task-export-csv/custom-fields");
jest.unmock("../services/task-export-csv/formatters");
jest.unmock("../services/task-export-csv/task-export-csv.service");
jest.unmock("../services/task-export-csv/types");
jest.unmock("../services/task-export-csv/index");
jest.unmock("../services/task-export/task-export-options");
jest.unmock("../services/task-export/task-export-zip");
jest.unmock("../services/task-export/types");
jest.unmock("../shared/sanitize-filename");
jest.unmock("./fixtures/task-export-csv.fixtures");
jest.unmock("moment");
jest.unmock("archiver");
jest.unmock("stream");

import { CSV_UTF8_BOM } from "../shared/csv-utils";
import {
  buildTaskExportHeaders,
  generateCommentsCsv,
  generateTasksCsv,
  getStandardTaskExportHeaders,
  mapCommentToExportRow,
} from "../services/task-export-csv";
import {
  normalizeTaskExportOptions,
  TASK_EXPORT_PERSISTED_OPTION_KEYS,
} from "../services/task-export/task-export-options";
import { createZipBuffer } from "../services/task-export/task-export-zip";
import {
  FIXTURE_COMMENTS,
  FIXTURE_CUSTOM_FIELDS,
  FIXTURE_TASK_PLAIN,
} from "./fixtures/task-export-csv.fixtures";

describe("TE-29: zero custom fields → no empty columns", () => {
  it("buildTaskExportHeaders returns only the 19 standard headers", () => {
    expect(buildTaskExportHeaders([])).toEqual(getStandardTaskExportHeaders());
    expect(buildTaskExportHeaders([])).toHaveLength(19);
  });

  it("generateTasksCsv does not invent blank custom-field columns", () => {
    const csv = generateTasksCsv([FIXTURE_TASK_PLAIN], []);
    const headerLine = csv.replace(CSV_UTF8_BOM, "").split("\n")[0];
    const cells = headerLine.split(",");

    expect(cells).toHaveLength(19);
    expect(headerLine).not.toMatch(/Story Points|Client Ref|Approved|Reviewers/);
    // Even if the task object carries custom_column_values, empty defs → no columns
    expect(FIXTURE_TASK_PLAIN.custom_column_values?.story_points).toBe(5);
  });

  it("still adds real custom columns when the project has field definitions", () => {
    const headers = buildTaskExportHeaders(FIXTURE_CUSTOM_FIELDS);
    expect(headers.length).toBe(19 + FIXTURE_CUSTOM_FIELDS.length);
  });
});

describe("TE-30: zero comments on a task → omitted from Comments CSV", () => {
  it("empty comment list yields header-only CSV (no blank data row)", () => {
    const csv = generateCommentsCsv([]);
    const lines = csv.replace(CSV_UTF8_BOM, "").split("\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('"Task ID"');
    expect(lines[0]).toContain('"Comment Text"');
  });

  it("only emits one row per comment — never a placeholder for comment-less tasks", () => {
    // FIXTURE_COMMENTS covers ACME-1 and ACME-2 only; ACME-3 must not appear.
    // Embedded newlines in comment text mean we cannot count physical lines.
    const csv = generateCommentsCsv(FIXTURE_COMMENTS);
    const body = csv.replace(CSV_UTF8_BOM, "");

    expect(body.match(/"ACME-1"/g)).toHaveLength(1);
    expect(body.match(/"ACME-2"/g)).toHaveLength(1);
    expect(body).not.toContain('"ACME-3"');

    for (const comment of FIXTURE_COMMENTS) {
      const row = mapCommentToExportRow(comment);
      expect(row[0]).toBeTruthy();
      expect(row[3]).toBeTruthy(); // Comment Text
    }
  });
});

describe("TE-31: zero attachments → no empty folder in ZIP", () => {
  it("skips directory-only paths so empty task folders are never created", async () => {
    const buffer = await createZipBuffer([
      { path: "tasks.csv", data: "id\n1\n" },
      { path: "ACME-orphan/", data: Buffer.alloc(0) },
      { path: "ACME-1/file.txt", data: Buffer.from("ok") },
    ]);

    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);

    // Local file headers embed the entry name as ASCII after the fixed header.
    const asString = buffer.toString("binary");
    expect(asString).toContain("tasks.csv");
    expect(asString).toContain("ACME-1/file.txt");
    expect(asString).not.toContain("ACME-orphan/");
  });

  it("does not invent task folders when only CSV entries are present", async () => {
    const buffer = await createZipBuffer([
      { path: "tasks.csv", data: "a\n" },
      { path: "comments.csv", data: "b\n" },
    ]);
    const asString = buffer.toString("binary");
    expect(asString).toContain("tasks.csv");
    expect(asString).toContain("comments.csv");
    expect(asString).not.toMatch(/ACME-\d+\//);
  });
});

describe("TE-32: custom field values snapshot at generation time", () => {
  it("normalizeTaskExportOptions keeps only selection/scope keys", () => {
    const normalized = normalizeTaskExportOptions({
      include_tasks: true,
      include_comments: false,
      include_files: true,
      scope: "filtered",
      task_ids: ["uuid-1", "", "uuid-2"],
      // @ts-expect-error — queue payloads must not carry live field snapshots
      custom_column_values: { story_points: 99 },
      comment_bodies: ["stale"],
    } as Parameters<typeof normalizeTaskExportOptions>[0] & {
      custom_column_values?: Record<string, unknown>;
      comment_bodies?: string[];
    });

    expect(Object.keys(normalized).sort()).toEqual(
      [...TASK_EXPORT_PERSISTED_OPTION_KEYS].sort()
    );
    expect(normalized).toEqual({
      include_tasks: true,
      include_comments: false,
      include_files: true,
      scope: "filtered",
      task_ids: ["uuid-1", "uuid-2"],
    });
    expect(normalized).not.toHaveProperty("custom_column_values");
    expect(normalized).not.toHaveProperty("comment_bodies");
  });

  it('defaults scope to project and coerces missing flags to false', () => {
    expect(normalizeTaskExportOptions({})).toEqual({
      include_tasks: false,
      include_comments: false,
      include_files: false,
      scope: "project",
      task_ids: null,
    });
  });

  it("clears task_ids when scope is project (full-project export)", () => {
    expect(
      normalizeTaskExportOptions({
        include_tasks: true,
        scope: "project",
        task_ids: ["uuid-1", "uuid-2"],
      })
    ).toEqual({
      include_tasks: true,
      include_comments: false,
      include_files: false,
      scope: "project",
      task_ids: null,
    });
  });
});

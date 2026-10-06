// jest.config.js sets automock: true repo-wide — unmock modules under test.
jest.unmock("../shared/csv-utils");
jest.unmock("../services/task-export-csv/columns");
jest.unmock("../services/task-export-csv/custom-fields");
jest.unmock("../services/task-export-csv/formatters");
jest.unmock("../services/task-export-csv/task-export-csv.service");
jest.unmock("../services/task-export-csv/types");
jest.unmock("../services/task-export-csv/index");
jest.unmock("./fixtures/task-export-csv.fixtures");
jest.unmock("moment");

import {
  buildCsvRow,
  CSV_UTF8_BOM,
  encodeCsv,
  escapeCsvValue,
  formatCsvCell,
  sanitizeCsvFormulaValue,
} from "../shared/csv-utils";
import {
  buildTaskExportHeaders,
  generateCommentsCsv,
  generateTasksCsv,
  getStandardTaskExportHeaders,
  getTaskCommentsExportHeaders,
  mapCommentToExportRow,
  mapTaskToExportRow,
  resolveCommentMentionPlaceholders,
  TASK_COMMENTS_EXPORT_COLUMNS,
  TASK_EXPORT_STANDARD_COLUMNS,
} from "../services/task-export-csv";
import {
  FIXTURE_COMMENTS,
  FIXTURE_COMMENT_WITH_MENTIONS,
  FIXTURE_CUSTOM_FIELDS,
  FIXTURE_DUPLICATE_NAME_FIELDS,
  FIXTURE_TASK_ESCAPING,
  FIXTURE_TASK_PLAIN,
  FIXTURE_TASK_UNICODE,
} from "./fixtures/task-export-csv.fixtures";

describe("csv-utils (TE-12)", () => {
  it("doubles internal quotes when escaping", () => {
    expect(escapeCsvValue('say "hi"')).toBe('say ""hi""');
  });

  it("always wraps cells in quotes and treats null as empty", () => {
    expect(formatCsvCell(null)).toBe('""');
    expect(formatCsvCell(undefined)).toBe('""');
    expect(formatCsvCell("a,b")).toBe('"a,b"');
    expect(formatCsvCell('a"b')).toBe('"a""b"');
    expect(formatCsvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("prefixes a leading quote onto values that would otherwise open a formula (CSV injection)", () => {
    expect(sanitizeCsvFormulaValue('=HYPERLINK("http://evil.example/","click")')).toBe(
      '\'=HYPERLINK("http://evil.example/","click")'
    );
    expect(sanitizeCsvFormulaValue("+1+1")).toBe("'+1+1");
    expect(sanitizeCsvFormulaValue("-1+1")).toBe("'-1+1");
    expect(sanitizeCsvFormulaValue("@SUM(A1:A2)")).toBe("'@SUM(A1:A2)");
    expect(sanitizeCsvFormulaValue("\tcmd")).toBe("'\tcmd");
    expect(sanitizeCsvFormulaValue("\rcmd")).toBe("'\rcmd");
    // Not a leading formula char — left untouched
    expect(sanitizeCsvFormulaValue("a=b")).toBe("a=b");
    expect(sanitizeCsvFormulaValue("")).toBe("");
  });

  it("formatCsvCell neutralizes formula injection before quoting", () => {
    expect(formatCsvCell('=HYPERLINK("http://evil.example/","click")')).toBe(
      '"\'=HYPERLINK(""http://evil.example/"",""click"")"'
    );
    expect(formatCsvCell("@SUM(A1:A2)")).toBe('"\'@SUM(A1:A2)"');
  });

  it("builds a comma-joined quoted row", () => {
    expect(buildCsvRow(["a", "b,c", 'd"e'])).toBe('"a","b,c","d""e"');
  });

  it("encodes with UTF-8 BOM by default for Excel compatibility", () => {
    const csv = encodeCsv(["A", "B"], [["1", "2"]]);
    expect(csv.startsWith(CSV_UTF8_BOM)).toBe(true);
    expect(csv).toBe(`${CSV_UTF8_BOM}"A","B"\n"1","2"`);
  });

  it("can omit BOM when requested", () => {
    const csv = encodeCsv(["A"], [["x"]], { includeBom: false });
    expect(csv.startsWith(CSV_UTF8_BOM)).toBe(false);
    expect(csv).toBe('"A"\n"x"');
  });
});

describe("task export columns (TE-10)", () => {
  it("exposes the full standard column set in spec order", () => {
    expect(TASK_EXPORT_STANDARD_COLUMNS.map((c) => c.header)).toEqual([
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
    expect(getStandardTaskExportHeaders()).toHaveLength(19);
  });

  it("maps a plain task to standard cells without inventing custom columns", () => {
    const row = mapTaskToExportRow(FIXTURE_TASK_PLAIN, []);
    expect(row).toHaveLength(19);
    expect(row[0]).toBe("ACME-1");
    expect(row[1]).toBe("Plain task");
    expect(row[6]).toBe("Jane Doe");
    expect(row[8]).toBe("Backend, Urgent");
    expect(row[12]).toBe("1h 30m");
    expect(row[13]).toBe("1h 0m");
    expect(row[14]).toBe("25");
    expect(row[15]).toBe("");
    expect(row[16]).toBe("N");
  });
});

describe("custom-field column injection (TE-11)", () => {
  it("appends one header per custom field using configured names", () => {
    const headers = buildTaskExportHeaders(FIXTURE_CUSTOM_FIELDS);
    expect(headers.slice(0, 19)).toEqual(getStandardTaskExportHeaders());
    expect(headers.slice(19)).toEqual([
      "Story Points",
      "Client Ref",
      "Approved",
      "Reviewers",
    ]);
  });

  it("dedupes colliding custom field names by appending the key", () => {
    const headers = buildTaskExportHeaders(FIXTURE_DUPLICATE_NAME_FIELDS);
    expect(headers.slice(-2)).toEqual(["Notes", "Notes (field_b)"]);
  });

  it("injects custom values keyed by field key, not display name", () => {
    const row = mapTaskToExportRow(FIXTURE_TASK_PLAIN, FIXTURE_CUSTOM_FIELDS);
    expect(row).toHaveLength(23);
    expect(row.slice(-4)).toEqual(["5", "CR-100", "Y", "Alice, Bob"]);
  });

  it("leaves custom cells blank when the project has fields but the task has no values", () => {
    const row = mapTaskToExportRow(FIXTURE_TASK_UNICODE, FIXTURE_CUSTOM_FIELDS);
    expect(row.slice(-4)).toEqual(["", "", "", ""]);
  });

  it("omits custom columns entirely when the project has zero custom fields", () => {
    const csv = generateTasksCsv([FIXTURE_TASK_PLAIN], []);
    const headerLine = csv.replace(CSV_UTF8_BOM, "").split("\n")[0];
    expect(headerLine).not.toContain("Story Points");
    expect(headerLine.split(",")).toHaveLength(19);
  });
});

describe("tasks CSV encoding fixtures (TE-12)", () => {
  it("escapes commas, quotes, and newlines so the row stays one logical CSV record", () => {
    const csv = generateTasksCsv([FIXTURE_TASK_ESCAPING], FIXTURE_CUSTOM_FIELDS);
    const body = csv.replace(CSV_UTF8_BOM, "");
    const lines = body.split("\n");

    // Header + 1 data row — embedded newlines stay inside quoted cells, so
    // a naive split overcounts; assert via quoted cell content instead.
    expect(body.startsWith('"Task ID"')).toBe(true);
    expect(body).toContain('"Task with ""quotes"", commas, and\nnewlines"');
    expect(body).toContain('"Value, with ""comma"""');
    expect(body).toContain('"Y"'); // Is Subtask
    expect(body).toContain('"ACME-1"'); // Parent Task
    expect(lines[0]).toContain("Story Points");
  });

  it("preserves unicode (Sheets/Excel UTF-8) and includes BOM", () => {
    const csv = generateTasksCsv([FIXTURE_TASK_UNICODE], []);
    expect(csv.startsWith(CSV_UTF8_BOM)).toBe(true);
    expect(csv).toContain("日本語タスク — café résumé 🚀");
    expect(csv).toContain("Unicode: ñ é ü 中文");
  });

  it("strips HTML from descriptions into plain text", () => {
    const row = mapTaskToExportRow(FIXTURE_TASK_ESCAPING, []);
    expect(row[2]).toContain("Line one");
    expect(row[2]).toContain('Has a comma, and "quotes"');
    expect(row[2]).not.toContain("<p>");
  });

  it("generates a multi-task CSV with header then one row per task", () => {
    const csv = generateTasksCsv(
      [FIXTURE_TASK_PLAIN, FIXTURE_TASK_UNICODE],
      FIXTURE_CUSTOM_FIELDS
    );
    expect(csv.startsWith(CSV_UTF8_BOM)).toBe(true);
    expect(csv).toContain('"ACME-1"');
    expect(csv).toContain('"ACME-3"');
  });
});

describe("task comments CSV (TE-13)", () => {
  it("uses the comments column set with Task ID as the join key", () => {
    expect(TASK_COMMENTS_EXPORT_COLUMNS.map((c) => c.header)).toEqual([
      "Task ID",
      "Task Name",
      "Comment Author",
      "Comment Text",
      "Created At",
      "Edited At",
      "Attachments",
    ]);
    expect(getTaskCommentsExportHeaders()[0]).toBe("Task ID");
  });

  it("leaves Edited At blank when the comment was never edited", () => {
    const row = mapCommentToExportRow(FIXTURE_COMMENTS[0]);
    expect(row[0]).toBe("ACME-1");
    expect(row[5]).toBe("");
  });

  it("fills Edited At from updated_at when is_edited is true", () => {
    const row = mapCommentToExportRow(FIXTURE_COMMENTS[1]);
    expect(row[0]).toBe("ACME-2");
    expect(row[5]).toMatch(/2026-01-13/);
  });

  it("escapes comment text and produces a joinable Task ID with tasks CSV", () => {
    const tasksCsv = generateTasksCsv(
      [FIXTURE_TASK_PLAIN, FIXTURE_TASK_ESCAPING],
      []
    );
    const commentsCsv = generateCommentsCsv(FIXTURE_COMMENTS);

    expect(commentsCsv.startsWith(CSV_UTF8_BOM)).toBe(true);
    expect(commentsCsv).toContain('"ACME-1"');
    expect(commentsCsv).toContain('"ACME-2"');
    expect(commentsCsv).toContain('Please fix the ""bug"", and add\na note');

    // Join key present in both files
    expect(tasksCsv).toContain('"ACME-1"');
    expect(tasksCsv).toContain('"ACME-2"');
  });

  it("returns headers only when there are no comments (no blank rows)", () => {
    const csv = generateCommentsCsv([]);
    const body = csv.replace(CSV_UTF8_BOM, "");
    expect(body.split("\n")).toHaveLength(1);
    expect(body).toContain("Comment Text");
  });

  it("resolves {n} mention placeholders to @Name in Comment Text", () => {
    expect(
      resolveCommentMentionPlaceholders("Hi {0}", [{ user_name: "Alice" }])
    ).toBe("Hi @Alice");

    const row = mapCommentToExportRow(FIXTURE_COMMENT_WITH_MENTIONS);
    expect(row[3]).toBe("Hey @Alice Smith, can you review this with @Bob Jones?");
    expect(row[3]).not.toContain("{0}");
    expect(row[3]).not.toContain("{1}");

    const csv = generateCommentsCsv([FIXTURE_COMMENT_WITH_MENTIONS]);
    expect(csv).toContain("@Alice Smith");
    expect(csv).toContain("@Bob Jones");
    expect(csv).not.toContain("{0}");
  });

  it("lists comment-uploaded file names in the Attachments column", () => {
    const row = mapCommentToExportRow({
      ...FIXTURE_COMMENTS[0],
      content: "",
      attachment_names: ["screenshot.png", "spec.pdf"],
    });
    expect(row[3]).toBe("");
    expect(row[6]).toBe("screenshot.png, spec.pdf");

    const csv = generateCommentsCsv([
      {
        ...FIXTURE_COMMENTS[0],
        attachment_names: ["screenshot.png"],
      },
    ]);
    expect(csv).toContain("Attachments");
    expect(csv).toContain("screenshot.png");
  });
});

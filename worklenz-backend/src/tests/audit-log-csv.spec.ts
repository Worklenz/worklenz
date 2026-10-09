import { AUDIT_LOG_CSV_HEADERS, AuditLogCsvRow, buildAuditLogCsv, getAuditLogExportFileName } from "../shared/audit-log-csv";
import { CSV_UTF8_BOM } from "../shared/csv-utils";

const row = (overrides: Partial<AuditLogCsvRow> = {}): AuditLogCsvRow => ({
  created_at: "2026-10-01T10:15:30.000Z",
  actor_name: "Ruwan Perera",
  category: "lifecycle",
  event_type: "project_created",
  description: 'Created project "Fraud Detection Rules Engine"',
  ...overrides,
});

describe("audit-log-csv", () => {
  describe("AUDIT_LOG_CSV_HEADERS", () => {
    it("matches the on-screen table columns exactly (task 5.3)", () => {
      expect(AUDIT_LOG_CSV_HEADERS).toEqual(["Timestamp", "Actor", "Category", "Event", "Details"]);
    });
  });

  describe("buildAuditLogCsv", () => {
    it("starts with a UTF-8 BOM for Excel compatibility", () => {
      expect(buildAuditLogCsv([row()]).startsWith(CSV_UTF8_BOM)).toBe(true);
    });

    it("writes the quoted header row first", () => {
      const csv = buildAuditLogCsv([]);
      const headerLine = csv.replace(CSV_UTF8_BOM, "").split("\n")[0];
      expect(headerLine).toBe('"Timestamp","Actor","Category","Event","Details"');
    });

    it("formats the timestamp as an ISO 8601 UTC string", () => {
      const csv = buildAuditLogCsv([row({ created_at: "2026-10-01T10:15:30.000Z" })]);
      expect(csv).toContain('"2026-10-01T10:15:30.000Z"');
    });

    it("resolves category and event_type ids to their human-readable labels", () => {
      const csv = buildAuditLogCsv([row({ category: "access", event_type: "login_failed" })]);
      expect(csv).toContain('"Access & Authentication"');
      expect(csv).toContain('"Login failed"');
    });

    it("falls back to a humanized slug for an event_type with no catalogued label", () => {
      const csv = buildAuditLogCsv([row({ event_type: "some_future_event" })]);
      expect(csv).toContain('"Some future event"');
    });

    it("falls back to the raw category id when it isn't recognized", () => {
      const csv = buildAuditLogCsv([row({ category: "not-a-real-category" })]);
      expect(csv).toContain('"not-a-real-category"');
    });

    it("writes one row per entry, in the order given (ordering is the caller's responsibility)", () => {
      const csv = buildAuditLogCsv([
        row({ description: "First" }),
        row({ description: "Second" }),
      ]);
      const lines = csv.replace(CSV_UTF8_BOM, "").split("\n");
      expect(lines).toHaveLength(3); // header + 2 rows
      expect(lines[1]).toContain('"First"');
      expect(lines[2]).toContain('"Second"');
    });

    it("adds the old → new values to Details, like the on-screen Details cell", () => {
      const csv = buildAuditLogCsv([
        row({ description: "Workspace owner contact number updated", old_value: "0771234567", new_value: "0779999999" }),
      ]);
      expect(csv).toContain('"Workspace owner contact number updated (0771234567 → 0779999999)"');
    });

    it("marks a missing side of a change as (none)", () => {
      const csv = buildAuditLogCsv([row({ description: "Contact number set", old_value: null, new_value: "0771234567" })]);
      expect(csv).toContain('"Contact number set ((none) → 0771234567)"');
    });

    it("leaves Details as the description when nothing changed value", () => {
      const csv = buildAuditLogCsv([row({ old_value: null, new_value: null })]);
      expect(csv).toContain('"Created project ""Fraud Detection Rules Engine"""');
      expect(csv).not.toContain("→");
    });

    describe("formula-injection safety (task 5.3)", () => {
      it.each(["=", "+", "-", "@", "\t", "\r"])(
        "neutralizes an actor_name starting with %s",
        (char) => {
          const csv = buildAuditLogCsv([row({ actor_name: `${char}HYPERLINK("http://evil")` })]);
          expect(csv).toContain(`"'${char}HYPERLINK(""http://evil"")"`);
        }
      );

      it.each(["=", "+", "-", "@"])(
        "neutralizes a description starting with %s",
        (char) => {
          const csv = buildAuditLogCsv([row({ description: `${char}cmd|' /C calc'!A1` })]);
          expect(csv).toContain(`"'${char}cmd|' /C calc'!A1"`);
        }
      );

      it("doubles embedded double quotes in the description", () => {
        const csv = buildAuditLogCsv([row({ description: 'Renamed from "A" to "B"' })]);
        expect(csv).toContain('"Renamed from ""A"" to ""B"""');
      });

      it("does not alter a value where the dangerous character is not leading", () => {
        const csv = buildAuditLogCsv([row({ description: "Cost - Q1 adjusted" })]);
        expect(csv).toContain('"Cost - Q1 adjusted"');
      });
    });
  });

  describe("getAuditLogExportFileName", () => {
    it("builds a dated file name", () => {
      expect(getAuditLogExportFileName("2026-10-06")).toBe("audit-log-export-2026-10-06.csv");
    });

    it("defaults to today's date when none is given", () => {
      const name = getAuditLogExportFileName();
      expect(name).toMatch(/^audit-log-export-\d{4}-\d{2}-\d{2}\.csv$/);
    });
  });
});

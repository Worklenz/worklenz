import fs from "fs";
import path from "path";

/**
 * Audit log spec, task 6.3: the retention job is the only path that removes audit log
 * entries. Statically scans all backend source and database SQL so a new DELETE/UPDATE/
 * TRUNCATE against audit_events, or a new caller of the purge function, fails CI.
 */
const BACKEND_ROOT = path.resolve(__dirname, "../..");
const SCAN_ROOTS = ["src", "database"].map((dir) => path.join(BACKEND_ROOT, dir));
const SCANNED_EXTENSIONS = new Set([".ts", ".js", ".sql"]);
const EXCLUDED_DIRS = new Set(["node_modules", "build", "tests", "__tests__"]);

const PURGE_MIGRATION = "database/pg-migrations/1791193625588_add-audit-log-retention-to-organizations.js";
const RETENTION_JOB = "src/cron_jobs/audit-log-retention-job.ts";

const MUTATION_PATTERNS: Record<string, RegExp> = {
  delete: /\bDELETE\s+FROM\s+(ONLY\s+)?(public\.)?audit_events\b/gi,
  update: /\bUPDATE\s+(ONLY\s+)?(public\.)?audit_events\b/gi,
  truncate: /\bTRUNCATE\s+(TABLE\s+)?(ONLY\s+)?(public\.)?audit_events\b/gi,
};
const PURGE_CALL_PATTERN = /\bpurge_expired_audit_events\s*\(/gi;

const listFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return EXCLUDED_DIRS.has(entry.name) ? [] : listFiles(fullPath);
    return SCANNED_EXTENSIONS.has(path.extname(entry.name)) ? [fullPath] : [];
  });

const toRelative = (filePath: string) => path.relative(BACKEND_ROOT, filePath).split(path.sep).join("/");

const SOURCE_FILES = SCAN_ROOTS.flatMap(listFiles).map((filePath) => ({
  file: toRelative(filePath),
  content: fs.readFileSync(filePath, "utf8"),
}));

const findMatches = (pattern: RegExp) =>
  SOURCE_FILES.flatMap(({ file, content }) => (content.match(pattern) ?? []).map(() => file));

describe("audit_events has no delete path other than the retention job", () => {
  it("scans a meaningful set of files", () => {
    const files = SOURCE_FILES.map(({ file }) => file);
    expect(files).toContain(PURGE_MIGRATION);
    expect(files).toContain(RETENTION_JOB);
    expect(files).toContain("src/services/audit-log.service.ts");
  });

  it("contains exactly one DELETE FROM audit_events, inside purge_expired_audit_events()", () => {
    expect(findMatches(MUTATION_PATTERNS.delete)).toEqual([PURGE_MIGRATION]);
  });

  it("never UPDATEs audit_events", () => {
    expect(findMatches(MUTATION_PATTERNS.update)).toEqual([]);
  });

  it("never TRUNCATEs audit_events", () => {
    expect(findMatches(MUTATION_PATTERNS.truncate)).toEqual([]);
  });

  it("only calls purge_expired_audit_events() from the scheduled retention job", () => {
    const callers = new Set(findMatches(PURGE_CALL_PATTERN).filter((file) => file.startsWith("src/")));
    expect([...callers]).toEqual([RETENTION_JOB]);
  });

  it("does not expose the purge through any route", () => {
    const routeFiles = SOURCE_FILES.filter(({ file }) => file.startsWith("src/routes/"));
    routeFiles.forEach(({ content }) => {
      expect(content).not.toMatch(/audit-log-retention-job|runAuditLogRetentionPurge|purge_expired_audit_events/);
    });
  });
});

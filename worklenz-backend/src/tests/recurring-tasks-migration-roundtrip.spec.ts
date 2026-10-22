import path from "path";

interface Migration {
  up: (builder: { sql: (statement: string) => void }) => Promise<void>;
  down: (builder: { sql: (statement: string) => void }) => Promise<void>;
}

describe("1770681600000_recurring_tasks_complete_fix migration index", () => {
  const migrationPath = path.resolve(
    __dirname,
    "../../database/pg-migrations/1770681600000_recurring_tasks_complete_fix.js"
  );
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const migration = require(migrationPath) as Migration;

  it("selects an immutable date expression for the end_date column type", async () => {
    const statements: string[] = [];
    await migration.up({ sql: statement => statements.push(statement) });
    const sql = statements.join("\n");

    expect(sql).toContain("_type = 'timestamp with time zone'");
    expect(sql).toContain("((end_date AT TIME ZONE ''UTC'')::DATE)");
    expect(sql).toContain("(end_date::DATE)");
    expect(sql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_schedule_end_date_unique");
  });
});

describe("1791364628703_fix_recurring_tasks_immutable_index migration round-trip", () => {
  const migrationPath = path.resolve(
    __dirname,
    "../../database/pg-migrations/1791364628703_fix_recurring_tasks_immutable_index.js"
  );
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const migration = require(migrationPath) as Migration;

  it("applies up migration using immutable UTC date expression for timestamptz", async () => {
    const statements: string[] = [];
    await migration.up({ sql: statement => statements.push(statement) });
    const sql = statements.join("\n");

    expect(sql).toContain("DROP INDEX IF EXISTS idx_tasks_schedule_end_date_unique;");
    expect(sql).toContain("CREATE UNIQUE INDEX idx_tasks_schedule_end_date_unique");
    expect(sql).toContain("((end_date AT TIME ZONE ''UTC'')::DATE)");
    expect(sql).toContain("(end_date::DATE)");
    expect(sql).toContain("WHERE schedule_id IS NOT NULL AND end_date IS NOT NULL");
  });

  it("restores baseline unique index on rollback to preserve uniqueness guard", async () => {
    const statements: string[] = [];
    await migration.down({ sql: statement => statements.push(statement) });
    const sql = statements.join("\n");

    expect(sql).toContain("DROP INDEX IF EXISTS idx_tasks_schedule_end_date_unique;");
    expect(sql).toContain("CREATE UNIQUE INDEX idx_tasks_schedule_end_date_unique");
    expect(sql).toContain("ON tasks (schedule_id, end_date)");
    expect(sql).toContain("WHERE schedule_id IS NOT NULL AND end_date IS NOT NULL;");
  });

  it("completes round-trip ensuring uniqueness protection is maintained after down", async () => {
    const upStatements: string[] = [];
    await migration.up({ sql: statement => upStatements.push(statement) });

    const downStatements: string[] = [];
    await migration.down({ sql: statement => downStatements.push(statement) });

    const upSql = upStatements.join("\n");
    const downSql = downStatements.join("\n");

    // up creates immutable index
    expect(upSql).toContain("CREATE UNIQUE INDEX idx_tasks_schedule_end_date_unique ON tasks (schedule_id, %s)");
    // down restores preceding baseline index
    expect(downSql).toMatch(/CREATE UNIQUE INDEX idx_tasks_schedule_end_date_unique\s+ON tasks \(schedule_id, end_date\)/);
  });
});

import { Client } from "pg";

interface Migration {
  up(builder: { sql(statement: string): void }): Promise<void>;
}
const migration: Migration = require("../../database/pg-migrations/1792800003000_task_status_history_trigger");
const integration = process.env.TEST_STATUS_HISTORY_DATABASE_URL ? describe : describe.skip;

// Run only against a disposable database; all fixture DDL and migration changes roll back.
integration("task status history baseline", () => {
  let client: Client;
  let migrationSql: string;
  const taskId = "00000000-0000-0000-0000-000000000001";
  const projectId = "00000000-0000-0000-0000-000000000002";
  const statusId = "00000000-0000-0000-0000-000000000003";
  const nextStatusId = "00000000-0000-0000-0000-000000000004";

  beforeAll(async () => {
    const statements: string[] = [];
    await migration.up({ sql: statement => { statements.push(statement); } });
    migrationSql = statements.join("\n");
    client = new Client({ connectionString: process.env.TEST_STATUS_HISTORY_DATABASE_URL });
    await client.connect();
  });
  beforeEach(async () => {
    await client.query("BEGIN");
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
      CREATE TABLE tasks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), project_id UUID, status_id UUID,
        archived BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE task_status_history (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), task_id UUID, project_id UUID,
        status_id UUID, previous_status_id UUID, entered_at TIMESTAMPTZ,
        exited_at TIMESTAMPTZ, changed_by UUID, created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await client.query(`INSERT INTO tasks (id, project_id, status_id, created_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP - INTERVAL '90 days')`, [taskId, projectId, statusId]);
  });
  afterEach(async () => { await client.query("ROLLBACK"); });
  afterAll(async () => { await client.end(); });

  it("starts the current status at tracking time without inventing earlier occupancy", async () => {
    await client.query(migrationSql);
    const { rows } = await client.query(`SELECT status_id, previous_status_id,
      entered_at = CURRENT_TIMESTAMP AS starts_now,
      entered_at > (SELECT created_at FROM tasks WHERE id = $1) AS after_creation
      FROM task_status_history WHERE task_id = $1`, [taskId]);
    expect(rows).toEqual([{ status_id: statusId, previous_status_id: null, starts_now: true, after_creation: true }]);
    const historical = await client.query(`SELECT COUNT(*)::INT AS count FROM task_status_history
      WHERE entered_at < CURRENT_TIMESTAMP - INTERVAL '1 day'`);
    expect(historical.rows[0].count).toBe(0);
  });

  it("preserves reliable existing history and is safe to rerun", async () => {
    await client.query(`INSERT INTO task_status_history (task_id, project_id, status_id, entered_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP - INTERVAL '2 days')`, [taskId, projectId, statusId]);
    await client.query(migrationSql);
    await client.query(migrationSql);
    const { rows } = await client.query(`SELECT COUNT(*)::INT AS count,
      BOOL_AND(entered_at = CURRENT_TIMESTAMP - INTERVAL '2 days') AS unchanged FROM task_status_history`);
    expect(rows).toEqual([{ count: 1, unchanged: true }]);
  });

  it("continues recording subsequent status transitions", async () => {
    await client.query(migrationSql);
    await client.query("UPDATE tasks SET status_id = $2 WHERE id = $1", [taskId, nextStatusId]);
    const { rows } = await client.query(`SELECT status_id, previous_status_id,
      exited_at IS NULL AS is_open FROM task_status_history ORDER BY is_open`);
    expect(rows).toEqual([
      { status_id: statusId, previous_status_id: null, is_open: false },
      { status_id: nextStatusId, previous_status_id: statusId, is_open: true },
    ]);
  });

  it("keeps archived and statusless tasks out of the baseline", async () => {
    await client.query("UPDATE tasks SET archived = TRUE WHERE id = $1", [taskId]);
    await client.query("INSERT INTO tasks (project_id) VALUES ($1)", [projectId]);
    await client.query(migrationSql);
    expect((await client.query("SELECT * FROM task_status_history")).rows).toEqual([]);
  });
});

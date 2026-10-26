import {randomUUID} from "crypto";
import {Pool, PoolClient} from "pg";

interface Migration {
  up(pgm: {sql(statement: string): void}): Promise<void>;
  down(pgm: {sql(statement: string): void}): Promise<void>;
}
const migration: Migration = require("../../database/pg-migrations/1792600000000_add_bulk_change_start_date_function");
// Use a disposable database, never the application database credentials.
const integration = process.env.TEST_BULK_DATE_DATABASE_URL ? describe : describe.skip;

integration("bulk start-date migration", () => {
  const schema = `bulk_date_test_${randomUUID().replace(/-/g, "")}`;
  const taskId = randomUUID();
  const projectId = randomUUID();
  const teamId = randomUUID();
  const userId = randomUUID();
  let admin: Pool;
  let pool: Pool;
  const apply = async (direction: "up" | "down") => {
    const statements: string[] = [];
    await migration[direction]({sql: statement => { statements.push(statement); }});
    for (const statement of statements) await pool.query(statement);
  };
  const update = (start_date: string | null, ids = [taskId], client: Pool | PoolClient = pool) =>
    client.query("SELECT bulk_change_tasks_start_date($1::json, $2::uuid) AS result", [
      JSON.stringify({start_date, tasks: ids.map(id => ({id}))}), userId,
    ]);

  beforeAll(async () => {
    admin = new Pool({connectionString: process.env.TEST_BULK_DATE_DATABASE_URL});
    await admin.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = new Pool({connectionString: process.env.TEST_BULK_DATE_DATABASE_URL,
      options: `-c search_path=${schema},public -c timezone=UTC`});
    await pool.query(`
      CREATE TABLE projects(id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), team_id UUID NOT NULL);
      CREATE TABLE tasks(id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), project_id UUID REFERENCES projects,
        start_date TIMESTAMPTZ, updated_at TIMESTAMPTZ);
      CREATE TABLE task_activity_logs(id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        task_id UUID REFERENCES tasks, team_id UUID NOT NULL, attribute_type TEXT NOT NULL,
        user_id UUID NOT NULL, log_type TEXT, old_value TEXT, new_value TEXT, project_id UUID NOT NULL REFERENCES projects);
    `);
    await pool.query("INSERT INTO projects VALUES ($1, $2)", [projectId, teamId]);
    await pool.query("INSERT INTO tasks(id, project_id) VALUES ($1, $2)", [taskId, projectId]);
    await apply("up");
  });
  beforeEach(async () => {
    await pool.query("TRUNCATE task_activity_logs");
    await pool.query("UPDATE tasks SET start_date = '2026-10-01T00:00:00Z', updated_at = '2026-01-01T00:00:00Z'");
  });
  afterAll(async () => {
    if (pool) await pool.end();
    if (admin) {
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      await admin.end();
    }
  });

  it("preserves input offsets and records the old and new date", async () => {
    expect((await update("2026-10-22T00:00:00+05:30")).rows[0].result).toEqual({updated_count: 1});
    const task = (await pool.query("SELECT * FROM tasks")).rows[0];
    expect(task.start_date.toISOString()).toBe("2026-10-21T18:30:00.000Z");
    const log = (await pool.query("SELECT *, old_value::timestamptz AS old_date, new_value::timestamptz AS new_date FROM task_activity_logs")).rows[0];
    expect(log.old_date.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(log.new_date.toISOString()).toBe(task.start_date.toISOString());
    expect(log).toMatchObject({task_id: taskId, team_id: teamId, user_id: userId, project_id: projectId, attribute_type: "start_date", log_type: "update"});
  });

  it("leaves updated_at and activity untouched for the same instant", async () => {
    expect((await update("2026-10-01T05:30:00+05:30")).rows[0].result).toEqual({updated_count: 0});
    expect((await pool.query("SELECT updated_at FROM tasks")).rows[0].updated_at.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect((await pool.query("SELECT * FROM task_activity_logs")).rowCount).toBe(0);
  });

  it.each([null, ""])("clears dates with %p and ignores repeated clears", async value => {
    expect((await update(value)).rows[0].result).toEqual({updated_count: 1});
    expect((await pool.query("SELECT start_date FROM tasks")).rows[0].start_date).toBeNull();
    expect((await update(value)).rows[0].result).toEqual({updated_count: 0});
    expect((await pool.query("SELECT * FROM task_activity_logs")).rows[0].new_value).toBeNull();
  });

  it("counts actual changes only, ignoring missing and duplicate task IDs", async () => {
    expect((await update("2026-10-22", [randomUUID(), taskId, taskId])).rows[0].result).toEqual({updated_count: 1});
    expect((await update("2026-10-22", [])).rows[0].result).toEqual({updated_count: 0});
    expect((await pool.query("SELECT * FROM task_activity_logs")).rowCount).toBe(1);
  });

  it("serializes concurrent updates and logs the committed previous date", async () => {
    const first = await pool.connect();
    const second = await pool.connect();
    let pending: ReturnType<typeof update> | undefined;
    try {
      await first.query("BEGIN");
      await update("2026-10-22", [taskId], first);
      const pid = (await second.query("SELECT pg_backend_pid() AS pid")).rows[0].pid;
      pending = update("2026-10-23", [taskId], second);
      // Wait until the second request reaches the row lock before committing the first.
      let isBlocked = false;
      for (let attempt = 0; attempt < 100 && !isBlocked; attempt++) {
        isBlocked = (await pool.query("SELECT wait_event_type = 'Lock' AS blocked FROM pg_stat_activity WHERE pid = $1", [pid])).rows[0]?.blocked;
        if (!isBlocked) await pool.query("SELECT pg_sleep(0.01)");
      }
      expect(isBlocked).toBe(true);
      await first.query("COMMIT");
      await pending;
      const logs = (await pool.query("SELECT old_value::timestamptz AS old_date FROM task_activity_logs WHERE new_value::timestamptz = '2026-10-23'::timestamptz")).rows;
      expect(logs).toHaveLength(1);
      expect(logs[0].old_date.toISOString()).toBe("2026-10-22T00:00:00.000Z");
    } finally {
      await first.query("ROLLBACK");
      if (pending) await pending.catch(() => undefined);
      first.release();
      second.release();
    }
  });

  it("removes the function on rollback and recreates it on reapply", async () => {
    await apply("down");
    expect((await pool.query("SELECT to_regprocedure('bulk_change_tasks_start_date(json,uuid)') AS fn")).rows[0].fn).toBeNull();
    await apply("up");
    expect((await update("2026-10-22")).rows[0].result).toEqual({updated_count: 1});
  });
});

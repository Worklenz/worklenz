import { randomUUID } from "crypto";
import { Pool } from "pg";
import { checkDailyTimeLimit } from "../services/daily-time-limit.service";

// Opt in only with a dedicated PostgreSQL test database; the schema is isolated
// and removed after the test. Two real connections exercise the advisory lock.
const databaseUrl = process.env.WORKLENZ_TEST_DATABASE_URL;
(databaseUrl ? describe : describe.skip)("daily time limit concurrency", () => {
  it("serializes simultaneous writes for the same member", async () => {
    const pool = new Pool({ connectionString: databaseUrl, max: 3 });
    const schema = `test_daily_${randomUUID().replace(/-/g, "")}`;
    const org = randomUUID(), team = randomUUID(), user = randomUUID(), project = randomUUID(), task = randomUUID();
    const setup = await pool.connect();
    const first = await pool.connect();
    const second = await pool.connect();
    try {
      await setup.query(`CREATE SCHEMA "${schema}"`);
      await setup.query(`SET search_path TO "${schema}"`);
      await setup.query(`
        CREATE TABLE organizations (id uuid PRIMARY KEY, enforce_daily_time_limit boolean);
        CREATE TABLE teams (id uuid PRIMARY KEY, organization_id uuid);
        CREATE TABLE timezones (id uuid PRIMARY KEY, name text);
        CREATE TABLE users (id uuid PRIMARY KEY, timezone_id uuid);
        CREATE TABLE projects (id uuid PRIMARY KEY, team_id uuid);
        CREATE TABLE tasks (id uuid PRIMARY KEY, project_id uuid);
        CREATE TABLE task_work_log (id uuid PRIMARY KEY, task_id uuid, user_id uuid,
          created_at timestamptz, time_spent integer, logged_by_timer boolean);
      `);
      await setup.query("INSERT INTO organizations VALUES ($1, true)", [org]);
      await setup.query("INSERT INTO teams VALUES ($1, $2)", [team, org]);
      await setup.query("INSERT INTO users VALUES ($1, NULL)", [user]);
      await setup.query("INSERT INTO projects VALUES ($1, $2)", [project, team]);
      await setup.query("INSERT INTO tasks VALUES ($1, $2)", [task, project]);
      for (const client of [first, second]) {
        await client.query(`SET search_path TO "${schema}"`);
        await client.query("BEGIN");
      }
      const addition = { start: "2026-11-10T00:00:00Z", seconds: 14 * 3600, isTimedSession: false };
      expect((await checkDailyTimeLimit(first, team, user, [addition])).allowed).toBe(true);
      await first.query("INSERT INTO task_work_log VALUES ($1, $2, $3, $4, $5, false)",
        [randomUUID(), task, user, addition.start, addition.seconds]);
      const secondCheck = checkDailyTimeLimit(second, team, user, [addition]);
      const initiallyBlocked = await Promise.race([secondCheck.then(() => false), new Promise<boolean>(resolve => setTimeout(() => resolve(true), 100))]);
      expect(initiallyBlocked).toBe(true);
      await first.query("COMMIT");
      expect((await secondCheck).allowed).toBe(false);
      await second.query("ROLLBACK");
    } finally {
      await first.query("ROLLBACK").catch(() => undefined);
      await second.query("ROLLBACK").catch(() => undefined);
      first.release(); second.release();
      await setup.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      setup.release();
      await pool.end();
    }
  });
});

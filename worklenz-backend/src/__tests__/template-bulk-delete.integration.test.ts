import { randomUUID } from "crypto";
import { Pool } from "pg";
import db from "../config/db";
import PtTasksController from "../controllers/project-templates/pt-tasks-controller";
import { createMockRequest, createMockResponse } from "../tests/utils/express-mock";

jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock("../decorators/handle-exceptions", () => ({ __esModule: true, default: () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) => descriptor }));
const integration = process.env.TEST_SECURITY_DATABASE_URL ? describe : describe.skip;

integration("template bulk deletion database authorization", () => {
  const schema = `template_test_${randomUUID().replace(/-/g, "")}`;
  const team = randomUUID(), foreignTeam = randomUUID(), user = randomUUID();
  const ownTemplate = randomUUID(), foreignTemplate = randomUUID();
  const ownTask = randomUUID(), foreignTask = randomUUID();
  let admin: Pool;
  let pool: Pool;

  beforeAll(async () => {
    admin = new Pool({ connectionString: process.env.TEST_SECURITY_DATABASE_URL });
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = new Pool({ connectionString: process.env.TEST_SECURITY_DATABASE_URL, options: `-c search_path=${schema},public` });
    await pool.query(`CREATE TABLE custom_project_templates (id uuid PRIMARY KEY, team_id uuid);
      CREATE TABLE cpt_tasks (id uuid PRIMARY KEY, template_id uuid);
      CREATE TABLE team_members (team_id uuid, user_id uuid, active boolean, is_guest boolean);`);
    await pool.query("INSERT INTO custom_project_templates VALUES ($1, $2), ($3, $4)", [ownTemplate, team, foreignTemplate, foreignTeam]);
    await pool.query("INSERT INTO team_members VALUES ($1, $2, true, false)", [team, user]);
    (db.query as jest.Mock).mockImplementation((sql, params) => pool.query(sql, params));
  });
  beforeEach(async () => {
    await pool.query("TRUNCATE cpt_tasks");
    await pool.query("INSERT INTO cpt_tasks VALUES ($1, $2), ($3, $4)", [ownTask, ownTemplate, foreignTask, foreignTemplate]);
  });
  afterAll(async () => {
    if (pool) await pool.end();
    if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); }
  });
  it("rejects a mixed-team batch without deleting either task", async () => {
    const res = createMockResponse();
    await PtTasksController.bulkDelete(createMockRequest({ user: { id: user, team_id: team }, body: { tasks: [{ id: ownTask }, { id: foreignTask }] } }), res);
    expect(res.statusCode).toBe(403);
    expect((await pool.query("SELECT count(*)::int AS count FROM cpt_tasks")).rows[0].count).toBe(2);
  });
  it("deletes an authorized batch and leaves the other team's task", async () => {
    const res = createMockResponse();
    await PtTasksController.bulkDelete(createMockRequest({ user: { id: user, team_id: team }, body: { tasks: [{ id: ownTask }] } }), res);
    expect(res.statusCode).toBe(200);
    expect((await pool.query("SELECT id FROM cpt_tasks")).rows.map(row => row.id)).toEqual([foreignTask]);
  });
});

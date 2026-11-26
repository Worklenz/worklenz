import { randomUUID } from "crypto";
import { Pool } from "pg";
import db from "../config/db";
import TaskStatusesController from "../controllers/task-statuses-controller";
import { createMockRequest, createMockResponse } from "../tests/utils/express-mock";

jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock("../decorators/handle-exceptions", () => ({ __esModule: true, default: () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) => descriptor }));
jest.mock("../shared/io", () => ({ IO: { getInstance: () => null } }));
const integration = process.env.TEST_SECURITY_DATABASE_URL ? describe : describe.skip;
integration("status ordering project boundary", () => {
  const schema = `status_test_${randomUUID().replace(/-/g, "")}`;
  const project = randomUUID(), foreignProject = randomUUID();
  const first = randomUUID(), second = randomUUID(), foreign = randomUUID();
  let admin: Pool, pool: Pool;
  beforeAll(async () => {
    admin = new Pool({ connectionString: process.env.TEST_SECURITY_DATABASE_URL });
    await admin.query(`CREATE SCHEMA ${schema}`);
    pool = new Pool({ connectionString: process.env.TEST_SECURITY_DATABASE_URL, options: `-c search_path=${schema},public` });
    await pool.query("CREATE TABLE task_statuses (id uuid PRIMARY KEY, project_id uuid, sort_order integer)");
    (db.query as jest.Mock).mockImplementation((sql, params) => pool.query(sql, params));
  });
  beforeEach(async () => {
    await pool.query("TRUNCATE task_statuses");
    await pool.query("INSERT INTO task_statuses VALUES ($1, $2, 0), ($3, $2, 1), ($4, $5, 7)", [first, project, second, foreign, foreignProject]);
  });
  afterAll(async () => {
    if (pool) await pool.end();
    if (admin) { await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`); await admin.end(); }
  });
  it("rejects mixed-project status IDs without changing either project", async () => {
    const res = createMockResponse();
    await TaskStatusesController.updateStatusOrder(createMockRequest({ query: { current_project_id: project }, body: { status_order: [second, foreign] } }), res);
    expect(res.statusCode).toBe(403);
    const result = await pool.query("SELECT id, sort_order FROM task_statuses ORDER BY id");
    expect(Object.fromEntries(result.rows.map(row => [row.id, row.sort_order]))).toEqual({ [first]: 0, [second]: 1, [foreign]: 7 });
  });
  it("reorders the requested statuses and retains the rest of the project", async () => {
    const res = createMockResponse();
    await TaskStatusesController.updateStatusOrder(createMockRequest({ query: { current_project_id: project }, body: { status_order: [second] } }), res);
    expect(res.statusCode).toBe(200);
    const result = await pool.query("SELECT id, sort_order FROM task_statuses ORDER BY id");
    expect(Object.fromEntries(result.rows.map(row => [row.id, row.sort_order]))).toEqual({ [first]: 1, [second]: 0, [foreign]: 7 });
  });
});

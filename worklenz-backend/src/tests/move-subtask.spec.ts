jest.mock("../config/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
    connect: jest.fn(),
    pool: { connect: jest.fn() },
  },
}));

jest.mock("../shared/io", () => ({
  __esModule: true,
  IO: {},
}));

jest.unmock("../shared/validation-helpers");

import db from "../config/db";
import TasksControllerV2 from "../controllers/tasks-controller-v2";
import { createMockRequest, createMockResponse } from "./utils/express-mock";
import { createQueryResult } from "./utils/db-mock";

const mockedConnect = db.connect as jest.Mock;
const mockedQuery = db.query as jest.Mock;

const PROJECT_ID = "550e8400-e29b-41d4-a716-446655440001";
const ROOT_ID = "550e8400-e29b-41d4-a716-446655440010";
const TASK_A = "550e8400-e29b-41d4-a716-4466554400aa";
const TASK_B = "550e8400-e29b-41d4-a716-4466554400bb";

interface TaskRow {
  id: string;
  parent_task_id: string | null;
  project_id: string;
  archived: boolean;
}

/**
 * Shared in-memory hierarchy + advisory lock. Each connect() gets its own client
 * (as a real pool would) while lock/row state is shared across concurrent moves.
 */
const createHierarchyPool = (initial: TaskRow[]) => {
  const rows = new Map(initial.map(row => [row.id, { ...row }]));
  let locked = false;
  const waiters: Array<() => void> = [];

  const acquireLock = async () => {
    if (!locked) {
      locked = true;
      return;
    }
    await new Promise<void>(resolve => waiters.push(resolve));
    locked = true;
  };

  const releaseLock = () => {
    locked = false;
    const next = waiters.shift();
    if (next) next();
  };

  // Mirror cycle CTE: walk all descendants (including archived) with visited-set dedupe.
  const isDescendant = (ancestorId: string, candidateId: string) => {
    const visited = new Set<string>();
    const stack = [...rows.values()]
      .filter(r => r.parent_task_id === ancestorId)
      .map(r => r.id);
    while (stack.length) {
      const id = stack.pop()!;
      if (id === candidateId) return true;
      if (visited.has(id)) continue;
      visited.add(id);
      for (const child of rows.values()) {
        if (child.parent_task_id === id) stack.push(child.id);
      }
    }
    return false;
  };

  const createClient = () => ({
    release: jest.fn(),
    query: jest.fn().mockImplementation(async (sql: string, params: unknown[] = []) => {
      if (sql === "BEGIN") return createQueryResult([]);
      if (sql === "COMMIT") {
        releaseLock();
        return createQueryResult([]);
      }
      if (sql === "ROLLBACK") {
        releaseLock();
        return createQueryResult([]);
      }
      if (/pg_advisory_xact_lock/.test(sql)) {
        await acquireLock();
        return createQueryResult([]);
      }
      if (
        /SELECT id, parent_task_id, project_id, archived\s+FROM tasks\s+WHERE id = \$1/.test(sql)
      ) {
        const row = rows.get(params[0] as string);
        return createQueryResult(row ? [{ ...row }] : []);
      }
      if (/WITH RECURSIVE task_descendants/.test(sql)) {
        const [taskId, newParentId] = params as [string, string];
        return createQueryResult([{ is_descendant: isDescendant(taskId, newParentId) }]);
      }
      if (/UPDATE tasks\s+SET parent_task_id = \$2/.test(sql)) {
        const [taskId, newParentId] = params as [string, string];
        const row = rows.get(taskId);
        if (row) row.parent_task_id = newParentId;
        return createQueryResult([]);
      }
      if (/SELECT COUNT\(\*\) as subtask_count/.test(sql)) {
        const parentId = params[0] as string;
        const count = [...rows.values()].filter(
          r => r.parent_task_id === parentId && !r.archived
        ).length;
        return createQueryResult([{ subtask_count: String(count) }]);
      }
      if (/UPDATE tasks SET manual_progress = false/.test(sql)) {
        return createQueryResult([]);
      }
      if (/SELECT project_id FROM tasks WHERE id = \$1/.test(sql)) {
        const row = rows.get(params[0] as string);
        return createQueryResult(row ? [{ project_id: row.project_id }] : []);
      }
      if (/get_task_complete_ratio/.test(sql)) {
        return createQueryResult([{ ratio: { ratio: 0 } }]);
      }
      return createQueryResult([]);
    }),
  });

  return {
    connect: () => Promise.resolve(createClient()),
    getParent: (id: string) => rows.get(id)?.parent_task_id ?? null,
    /** First client from a connect — for order assertions on a single-move test. */
    connectAndCapture: async () => {
      const client = createClient();
      return client;
    },
  };
};

const moveBody = (taskId: string, parentTaskId: string) => ({
  id: taskId,
  project_id: PROJECT_ID,
  parent_task_id: parentTaskId,
});

describe("TasksControllerV2.moveSubtask", () => {
  beforeEach(() => {
    mockedConnect.mockReset();
    mockedQuery.mockReset();
    mockedQuery.mockResolvedValue(
      createQueryResult([{ task: { id: TASK_A, parent_task_id: TASK_B, name: "A" } }])
    );
  });

  it("acquires a project hierarchy lock before the descendant check and update", async () => {
    const pool = createHierarchyPool([
      { id: ROOT_ID, parent_task_id: null, project_id: PROJECT_ID, archived: false },
      { id: TASK_A, parent_task_id: ROOT_ID, project_id: PROJECT_ID, archived: false },
      { id: TASK_B, parent_task_id: ROOT_ID, project_id: PROJECT_ID, archived: false },
    ]);
    const client = await pool.connectAndCapture();
    mockedConnect.mockResolvedValue(client);

    const res = createMockResponse();
    await TasksControllerV2.moveSubtask(
      createMockRequest({ body: moveBody(TASK_A, TASK_B) }),
      res
    );

    const sql = client.query.mock.calls.map((call: unknown[]) => String(call[0]));
    const lockIdx = sql.findIndex(s => /pg_advisory_xact_lock/.test(s));
    const cycleIdx = sql.findIndex(s => /WITH RECURSIVE task_descendants/.test(s));
    const updateIdx = sql.findIndex(s => /UPDATE tasks\s+SET parent_task_id = \$2/.test(s));

    expect(lockIdx).toBeGreaterThan(-1);
    expect(cycleIdx).toBeGreaterThan(lockIdx);
    expect(updateIdx).toBeGreaterThan(cycleIdx);
    expect(client.query.mock.calls[lockIdx][1]).toEqual([`task-hierarchy:${PROJECT_ID}`]);
    expect(sql).toContain("COMMIT");
    expect(res.statusCode).toBe(200);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("rejects concurrent opposite sibling moves so they cannot both succeed and form a cycle", async () => {
    const pool = createHierarchyPool([
      { id: ROOT_ID, parent_task_id: null, project_id: PROJECT_ID, archived: false },
      { id: TASK_A, parent_task_id: ROOT_ID, project_id: PROJECT_ID, archived: false },
      { id: TASK_B, parent_task_id: ROOT_ID, project_id: PROJECT_ID, archived: false },
    ]);
    mockedConnect.mockImplementation(() => pool.connect());

    const resA = createMockResponse();
    const resB = createMockResponse();

    // Launch both moves "at once"; the advisory lock serializes validation+update.
    await Promise.all([
      TasksControllerV2.moveSubtask(createMockRequest({ body: moveBody(TASK_A, TASK_B) }), resA),
      TasksControllerV2.moveSubtask(createMockRequest({ body: moveBody(TASK_B, TASK_A) }), resB),
    ]);

    const statuses = [resA.statusCode, resB.statusCode].sort();
    expect(statuses).toEqual([200, 400]);

    const parents = { a: pool.getParent(TASK_A), b: pool.getParent(TASK_B) };
    // Exactly one reparent succeeded; the other hit the cycle check under the lock.
    const aUnderB = parents.a === TASK_B && parents.b === ROOT_ID;
    const bUnderA = parents.b === TASK_A && parents.a === ROOT_ID;
    expect(aUnderB || bUnderA).toBe(true);
    // No cycle: A→B→A or B→A→B
    expect(parents.a === TASK_B && parents.b === TASK_A).toBe(false);
  });

  it("rolls back and returns 400 when the new parent is already a descendant", async () => {
    const pool = createHierarchyPool([
      { id: ROOT_ID, parent_task_id: null, project_id: PROJECT_ID, archived: false },
      { id: TASK_A, parent_task_id: ROOT_ID, project_id: PROJECT_ID, archived: false },
      { id: TASK_B, parent_task_id: TASK_A, project_id: PROJECT_ID, archived: false },
    ]);
    const client = await pool.connectAndCapture();
    mockedConnect.mockResolvedValue(client);

    const res = createMockResponse();
    await TasksControllerV2.moveSubtask(
      createMockRequest({ body: moveBody(TASK_A, TASK_B) }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(pool.getParent(TASK_A)).toBe(ROOT_ID);
    expect(client.query.mock.calls.map((c: unknown[]) => String(c[0]))).toContain("ROLLBACK");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("locks the moved task FOR UPDATE and rejects cycles through archived descendants", async () => {
    const archivedMid = "550e8400-e29b-41d4-a716-4466554400cc";
    // A → (archived mid) → B; moving A under B must still detect the cycle.
    const pool = createHierarchyPool([
      { id: ROOT_ID, parent_task_id: null, project_id: PROJECT_ID, archived: false },
      { id: TASK_A, parent_task_id: ROOT_ID, project_id: PROJECT_ID, archived: false },
      { id: archivedMid, parent_task_id: TASK_A, project_id: PROJECT_ID, archived: true },
      { id: TASK_B, parent_task_id: archivedMid, project_id: PROJECT_ID, archived: false },
    ]);
    const client = await pool.connectAndCapture();
    mockedConnect.mockResolvedValue(client);

    const res = createMockResponse();
    await TasksControllerV2.moveSubtask(
      createMockRequest({ body: moveBody(TASK_A, TASK_B) }),
      res
    );

    const selectMoved = client.query.mock.calls.find((call: unknown[]) =>
      /FROM tasks\s+WHERE id = \$1[\s\S]*FOR UPDATE/.test(String(call[0]))
    );
    expect(selectMoved).toBeDefined();
    expect(res.statusCode).toBe(400);
    expect(pool.getParent(TASK_A)).toBe(ROOT_ID);
  });
});

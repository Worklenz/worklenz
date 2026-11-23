import db from "../config/db";
import PtTasksController from "../controllers/project-templates/pt-tasks-controller";
import { verifyTemplateReadAccess } from "../middlewares/verify-template-access";
import { createMockRequest, createMockResponse } from "./utils/express-mock";
import { createQueryResult } from "./utils/db-mock";

jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock("../decorators/handle-exceptions", () => ({ __esModule: true, default: () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) => descriptor }));
const query = db.query as jest.MockedFunction<typeof db.query>;
const taskId = "4d20da6e-6df2-4e6c-b595-d592eae80d4a";
const user = { id: "user", team_id: "team" };

beforeEach(() => jest.clearAllMocks());

describe("template access", () => {
  it("rejects a template outside the user's team and organization", async () => {
    query.mockResolvedValueOnce(createQueryResult([]));
    const res = createMockResponse();
    const next = jest.fn();
    await verifyTemplateReadAccess(createMockRequest({ user, params: { id: "foreign" } }), res, next);
    expect(res.statusCode).toBe(404);
    expect(next).not.toHaveBeenCalled();
  });
  it("permits organization-shared templates when the database grants access", async () => {
    query.mockResolvedValueOnce(createQueryResult([{ ok: 1 }]));
    const next = jest.fn();
    await verifyTemplateReadAccess(createMockRequest({ user, params: { id: "shared" } }), createMockResponse(), next);
    expect(query.mock.calls[0][0]).toContain("in_organization");
    expect(next).toHaveBeenCalledTimes(1);
  });
  it("rejects invalid task IDs before running a deletion", async () => {
    const res = createMockResponse();
    await PtTasksController.bulkDelete(createMockRequest({ user, body: { tasks: [{ id: "bad" }] } }), res);
    expect(res.statusCode).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
  it("rejects a mixed or unauthorized batch without reporting any deletion", async () => {
    query.mockResolvedValueOnce(createQueryResult([{ deleted_tasks: [] }]));
    const res = createMockResponse();
    await PtTasksController.bulkDelete(createMockRequest({ user, body: { tasks: [{ id: taskId }] } }), res);
    expect(res.statusCode).toBe(403);
    expect(query.mock.calls[0][0]).toContain("(SELECT COUNT(*) FROM allowed) = (SELECT COUNT(*) FROM requested)");
    expect(query.mock.calls[0][1]).toEqual([[taskId], "team", "user"]);
  });
  it("returns IDs actually deleted from an authorized batch", async () => {
    query.mockResolvedValueOnce(createQueryResult([{ deleted_tasks: [taskId] }]));
    const res = createMockResponse();
    await PtTasksController.bulkDelete(createMockRequest({ user, body: { tasks: [{ id: taskId }, { id: taskId }] } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.body.deleted_tasks).toEqual([taskId]);
  });
});

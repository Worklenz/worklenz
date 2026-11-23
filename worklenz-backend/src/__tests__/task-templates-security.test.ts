import db from "../config/db";
import TasktemplatesController from "../controllers/task-templates-controller";
import { verifyNonGuestProjectAccess } from "../middlewares/verify-project-access";
import { PROJECT_ROLE_PERMISSIONS } from "../shared/organization-permissions";
import { createMockRequest, createMockResponse } from "../tests/utils/express-mock";
import { createQueryResult } from "../tests/utils/db-mock";

jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock("../decorators/handle-exceptions", () => ({
  __esModule: true,
  default: () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) => descriptor
}));
jest.mock("../shared/project-role-permissions", () => ({
  checkProjectRolePermission: jest.fn().mockResolvedValue({ allowed: true, role: "Admin" })
}));

const query = db.query as jest.MockedFunction<typeof db.query>;
const user = { id: "user-123", team_id: "team-123", is_guest: false };
const targetProjectId = "p1234567-89ab-cdef-0123-456789abcdef";
const templateId = "t1234567-89ab-cdef-0123-456789abcdef";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("verifyNonGuestProjectAccess for task template import", () => {
  const middleware = verifyNonGuestProjectAccess("params", "id", PROJECT_ROLE_PERMISSIONS.CREATE_TASKS);

  it("denies unauthenticated requests with 401", async () => {
    const res = createMockResponse();
    const next = jest.fn();
    await middleware(createMockRequest({ user: undefined, params: { id: targetProjectId } }), res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("denies requests with missing project id with 400", async () => {
    const res = createMockResponse();
    const next = jest.fn();
    await middleware(createMockRequest({ user, params: {} }), res, next);
    expect(res.statusCode).toBe(400);
    expect(next).not.toHaveBeenCalled();
  });

  it("denies guest users or users without project access with 403", async () => {
    query.mockResolvedValueOnce(createQueryResult([])); // NON_GUEST_ACCESS_PREDICATE fails
    const res = createMockResponse();
    const next = jest.fn();
    await middleware(createMockRequest({ user: { ...user, is_guest: true }, params: { id: targetProjectId } }), res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows non-guest members with create task permission", async () => {
    query.mockResolvedValueOnce(createQueryResult([{ id: targetProjectId }])); // project access passes
    const res = createMockResponse();
    const next = jest.fn();
    await middleware(createMockRequest({ user, params: { id: targetProjectId } }), res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});

describe("TasktemplatesController.import authorization", () => {
  it("denies when template is not found or accessible", async () => {
    query.mockResolvedValueOnce(createQueryResult([])); // template access check returns empty
    const res = createMockResponse();
    await TasktemplatesController.import(
      createMockRequest({ user, params: { id: targetProjectId }, query: { templateId }, body: [] }),
      res
    );
    expect(res.statusCode).toBe(404);
  });

  it("denies when project does not belong to user's team", async () => {
    // 1. Template access check: found template
    query.mockResolvedValueOnce(createQueryResult([{ team_id: user.team_id, scope: "team", in_same_organization: true }]));
    // 2. hasProjectAccess check: project does not belong to team
    query.mockResolvedValueOnce(createQueryResult([]));

    const res = createMockResponse();
    await TasktemplatesController.import(
      createMockRequest({ user, params: { id: targetProjectId }, query: { templateId }, body: [] }),
      res
    );
    expect(res.statusCode).toBe(403);
    expect(res.body.message).toContain("permission to access this project");
  });

  it("successfully imports tasks when both template and project access are verified", async () => {
    // 1. Template access check
    query.mockResolvedValueOnce(createQueryResult([{ team_id: user.team_id, scope: "team", in_same_organization: true }]));
    // 2. hasProjectAccess check
    query.mockResolvedValueOnce(createQueryResult([{ id: targetProjectId }]));
    // 3. import_tasks_from_template query
    query.mockResolvedValueOnce(createQueryResult([{ import_tasks_from_template: { success: true } }]));

    const res = createMockResponse();
    await TasktemplatesController.import(
      createMockRequest({ user, params: { id: targetProjectId }, query: { templateId }, body: [{ name: "New Task" }] }),
      res
    );
    expect(res.statusCode).toBe(200);
    expect(res.body.message).toContain("Tasks imported successfully");
  });
});

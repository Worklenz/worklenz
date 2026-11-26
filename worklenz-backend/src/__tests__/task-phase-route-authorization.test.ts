import { getProjectAccessForRequest } from "../shared/project-access";
import taskPhasesApiRouter from "../routes/apis/task-phases-api-router";
import { createMockRequest, createMockResponse } from "../tests/utils/express-mock";

jest.mock("../shared/project-access", () => ({ getProjectAccessForRequest: jest.fn() }));
jest.mock("../controllers/task-phases-controller", () => ({ __esModule: true, default: {
  create: jest.fn(), get: jest.fn(), updateSortOrder: jest.fn(), updateLabel: jest.fn(),
  updateSprintSettings: jest.fn(), startSprint: jest.fn(), completeSprint: jest.fn(),
  updateColor: jest.fn(), updateDefaultAssignee: jest.fn(), update: jest.fn(), deleteById: jest.fn(),
} }));

interface RouteLayer {
  route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (...args: unknown[]) => Promise<unknown> }> };
}
const getGuard = (method: string, path: string) => {
  const layer = (taskPhasesApiRouter.stack as RouteLayer[]).find(item => item.route?.path === path && item.route.methods[method]);
  if (!layer?.route) throw new Error(`Missing ${method} ${path}`);
  return layer.route.stack[0].handle;
};
const access = getProjectAccessForRequest as jest.MockedFunction<typeof getProjectAccessForRequest>;
beforeEach(() => {
  access.mockImplementation(async (_req, projectId) => ({ permissions: { phases: projectId === "allowed-project" } } as Awaited<ReturnType<typeof getProjectAccessForRequest>>));
});
describe("phase route authorization", () => {
  it.each([
    ["post", "/"], ["post", "/:id/start"], ["post", "/:id/complete"],
    ["put", "/change-color/:id"], ["patch", "/:id/default-assignee"],
    ["put", "/:id"], ["delete", "/:id"],
  ])("authorizes the actual query project for %s %s", async (method, path) => {
    const req = createMockRequest({ query: { id: "foreign-project", current_project_id: "allowed-project" }, body: { project_id: "allowed-project" } });
    const res = createMockResponse();
    const next = jest.fn();
    await getGuard(method, path)(req, res, next);
    expect(access).toHaveBeenCalledWith(req, "foreign-project");
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
  it("authorizes the body project used for phase reordering", async () => {
    const req = createMockRequest({ query: { current_project_id: "allowed-project", id: "allowed-project" }, body: { project_id: "foreign-project" } });
    const res = createMockResponse();
    const next = jest.fn();
    await getGuard("put", "/update-sort-order")(req, res, next);
    expect(access).toHaveBeenCalledWith(req, "foreign-project");
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});

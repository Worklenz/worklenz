import { getProjectAccessForRequest } from "../shared/project-access";
import router from "../routes/apis/software-reports-api-router";
import { createMockRequest, createMockResponse } from "../tests/utils/express-mock";

jest.mock("../shared/project-access", () => ({ getProjectAccessForRequest: jest.fn() }));
jest.mock("../controllers/software-reports-controller", () => ({ __esModule: true, default: { getSprintReport: jest.fn(), getFlowReport: jest.fn(), getCycleTimeReport: jest.fn() } }));
jest.mock("../controllers/custom-reports-controller", () => ({ __esModule: true, default: { list: jest.fn(), create: jest.fn(), preview: jest.fn(), getData: jest.fn(), remove: jest.fn() } }));
interface RouteLayer { route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (...args: unknown[]) => Promise<unknown> }> } }
const getGuard = (method: string, path: string) => {
  const layer = (router.stack as RouteLayer[]).find(item => item.route?.path === path && item.route.methods[method]);
  if (!layer?.route) throw new Error(`Missing ${method} ${path}`);
  return layer.route.stack[0].handle;
};
const access = getProjectAccessForRequest as jest.MockedFunction<typeof getProjectAccessForRequest>;
beforeEach(() => {
  access.mockImplementation(async (_req, projectId) => ({ permissions: { tasks: projectId === "allowed-project" } } as Awaited<ReturnType<typeof getProjectAccessForRequest>>));
});
describe("software report project authorization", () => {
  it.each(["/custom", "/custom/preview"])("checks the body project for POST %s even when a different query project is supplied", async path => {
    const req = createMockRequest({ query: { project_id: "allowed-project" }, body: { project_id: "foreign-project" } });
    const res = createMockResponse();
    const next = jest.fn();
    await getGuard("post", path)(req, res, next);
    expect(access).toHaveBeenCalledWith(req, "foreign-project");
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
  it.each(["/sprint", "/flow", "/cycle-time", "/custom", "/custom/:id/data"])("checks the query project for GET %s", async path => {
    const req = createMockRequest({ query: { project_id: "foreign-project" }, body: { project_id: "allowed-project" } });
    const res = createMockResponse();
    const next = jest.fn();
    await getGuard("get", path)(req, res, next);
    expect(access).toHaveBeenCalledWith(req, "foreign-project");
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});

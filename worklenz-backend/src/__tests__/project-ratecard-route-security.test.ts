import { getProjectAccessForRequest } from "../shared/project-access";
import router from "../routes/apis/project-ratecard-api-router";
import { createMockRequest, createMockResponse } from "../tests/utils/express-mock";

jest.mock("../shared/project-access", () => ({ getProjectAccessForRequest: jest.fn() }));
jest.mock("../shared/entitlements/gates", () => ({ requireFeature: () => (_req: unknown, _res: unknown, next: () => void) => next() }));
jest.mock("../controllers/project-ratecard-controller", () => ({ __esModule: true, default: {
  createMany: jest.fn(), createOne: jest.fn(), getByProjectId: jest.fn(), getById: jest.fn(), updateById: jest.fn(),
  updateByProjectId: jest.fn(), updateProjectMemberByProjectIdAndMemberId: jest.fn(), deleteById: jest.fn(), deleteByProjectId: jest.fn(),
} }));
interface RouteLayer { route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (...args: unknown[]) => Promise<unknown> }> } }
const getGuard = (method: string, path: string) => {
  const layer = (router.stack as RouteLayer[]).find(item => item.route?.path === path && item.route.methods[method]);
  if (!layer?.route) throw new Error(`Missing ${method} ${path}`);
  return layer.route.stack[0].handle;
};
const access = getProjectAccessForRequest as jest.MockedFunction<typeof getProjectAccessForRequest>;
beforeEach(() => access.mockImplementation(async (_req, id) => ({ permissions: { finance: id === "allowed-project" } } as Awaited<ReturnType<typeof getProjectAccessForRequest>>)));
describe("project rate card authorization", () => {
  it.each([["post", "/"], ["post", "/create-project-rate-card-role"]])("checks the body project on %s %s", async (method, path) => {
    const req = createMockRequest({ query: { current_project_id: "allowed-project" }, body: { project_id: "foreign-project" } });
    const res = createMockResponse(), next = jest.fn();
    await getGuard(method, path)(req, res, next);
    expect(access).toHaveBeenCalledWith(req, "foreign-project");
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
  it.each([["get", "/project/:project_id"], ["put", "/project/:project_id"], ["delete", "/project/:project_id"]])("checks the path project on %s %s", async (method, path) => {
    const req = createMockRequest({ params: { project_id: "foreign-project" }, query: { current_project_id: "allowed-project" }, body: { project_id: "allowed-project" } });
    const res = createMockResponse(), next = jest.fn();
    await getGuard(method, path)(req, res, next);
    expect(access).toHaveBeenCalledWith(req, "foreign-project");
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});

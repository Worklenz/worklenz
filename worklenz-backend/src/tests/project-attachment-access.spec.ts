jest.unmock("express");
jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock("../shared/storage", () => ({ getStorageUrl: jest.fn(() => "http://storage"), getRootDir: jest.fn(() => "files") }));
jest.mock("../shared/project-role-permissions", () => ({ checkProjectRolePermission: jest.fn().mockResolvedValue({ allowed: true }) }));
jest.mock("../decorators/handle-exceptions", () => ({ __esModule: true, default: () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) => descriptor }));

import db from "../config/db";
import AttachmentController from "../controllers/attachment-controller";
import attachmentsApiRouter from "../routes/apis/attachments-api-router";
import { createMockRequest, createMockResponse } from "./utils/express-mock";
import { createQueryResult } from "./utils/db-mock";

interface RouteLayer { route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (...args: never[]) => unknown }> } }
const query = db.query as jest.MockedFunction<typeof db.query>;
const layers = (attachmentsApiRouter as unknown as { stack: RouteLayer[] }).stack;
const projectRoute = layers.find(layer => layer.route?.path === "/project/:id" && layer.route.methods.get)?.route;

describe("project attachment listing", () => {
  beforeEach(() => jest.clearAllMocks());
  it("rejects a project from another team before the listing runs", async () => {
    expect(projectRoute).toBeDefined();
    const middleware = projectRoute!.stack[1].handle as unknown as (req: unknown, res: unknown, next: () => void) => Promise<void>;
    query.mockResolvedValueOnce(createQueryResult([{ id: "membership" }]));
    query.mockResolvedValueOnce(createQueryResult([{ team_id: "foreign-team" }]));
    query.mockResolvedValueOnce(createQueryResult([]));
    const req = createMockRequest({ user: { id: "user", team_id: "team" }, params: { id: "project" } });
    const res = createMockResponse();
    const next = jest.fn();
    await middleware(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
  it("fails closed if resolving task visibility fails", async () => {
    query.mockRejectedValueOnce(new Error("database unavailable"));
    query.mockResolvedValueOnce(createQueryResult([{ attachments: { total: 0, data: [] } }]));
    const error = jest.spyOn(console, "error").mockImplementation(() => undefined);
    await AttachmentController.getByProjectId(createMockRequest({ user: { id: "user", team_id: "team" }, params: { id: "project" } }), createMockResponse());
    expect(query.mock.calls[1][0]).toContain("AND 1 = 0");
    error.mockRestore();
  });
  it("filters both attachment rows and totals for restricted members", async () => {
    query.mockResolvedValueOnce(createQueryResult([{ restrict_on: true, team_member_id: "member", is_privileged_role: false, is_guest: false, is_project_manager: false }]));
    query.mockResolvedValueOnce(createQueryResult([{ attachments: { total: 0, data: [] } }]));
    const req = createMockRequest({ user: { id: "user", team_id: "team" }, params: { id: "project" } });
    await AttachmentController.getByProjectId(req, createMockResponse());
    const [sql, params] = query.mock.calls[1];
    expect((sql.match(/task_attachments.task_id IN/g) || [])).toHaveLength(4);
    expect(params).toEqual(["project", expect.any(String), expect.any(Number), 0, "member"]);
  });
});

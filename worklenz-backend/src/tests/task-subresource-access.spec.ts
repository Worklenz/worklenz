jest.unmock("express");
jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock("../shared/project-role-permissions", () => ({ checkProjectRolePermission: jest.fn(), checkTaskRolePermission: jest.fn() }));
jest.mock("../shared/storage", () => ({}));

import db from "../config/db";
import { checkProjectRolePermission } from "../shared/project-role-permissions";
import labelsApiRouter from "../routes/apis/labels-api-router";
import activityLogsApiRouter from "../routes/apis/activity-logs-api-router";
import { createMockRequest, createMockResponse } from "./utils/express-mock";
import { createQueryResult } from "./utils/db-mock";

interface RouteLayer { route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (...args: never[]) => unknown }> } }
const accessHandler = (router: unknown, path: string) => {
  const layer = (router as { stack: RouteLayer[] }).stack.find(item => item.route?.path === path && item.route.methods.get);
  expect(layer).toBeDefined();
  return layer!.route!.stack[1].handle as unknown as (req: unknown, res: unknown, next: () => void) => Promise<void>;
};
const query = db.query as jest.MockedFunction<typeof db.query>;
const projectPermission = checkProjectRolePermission as jest.MockedFunction<typeof checkProjectRolePermission>;

describe("task subresource access", () => {
  beforeEach(() => jest.clearAllMocks());
  it.each([[labelsApiRouter, "/tasks/:id"], [activityLogsApiRouter, "/:id"]])(
    "denies task labels or logs without project permission", async (router, path) => {
      query.mockResolvedValueOnce(createQueryResult([{ project_id: "project", project_team_id: "team" }]));
      projectPermission.mockResolvedValueOnce({ allowed: false } as Awaited<ReturnType<typeof checkProjectRolePermission>>);
      const res = createMockResponse();
      const next = jest.fn();
      await accessHandler(router, path as string)(createMockRequest({ user: { id: "user", team_id: "team" }, params: { id: "task" } }), res, next);
      expect(res.statusCode).toBe(403);
      expect(next).not.toHaveBeenCalled();
    }
  );
  it("denies project labels when the caller is not in the project's team", async () => {
    query.mockResolvedValueOnce(createQueryResult([{ id: "member" }]));
    query.mockResolvedValueOnce(createQueryResult([{ team_id: "foreign-team" }]));
    query.mockResolvedValueOnce(createQueryResult([]));
    projectPermission.mockResolvedValueOnce({ allowed: true } as Awaited<ReturnType<typeof checkProjectRolePermission>>);
    const res = createMockResponse();
    const next = jest.fn();
    await accessHandler(labelsApiRouter, "/project/:id")(createMockRequest({ user: { id: "user", team_id: "team" }, params: { id: "project" } }), res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
});

jest.unmock("express");
jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock("../shared/storage", () => ({}));
jest.mock("../shared/project-role-permissions", () => ({ checkProjectRolePermission: jest.fn(), checkTaskRolePermission: jest.fn() }));
jest.mock("../shared/assignee-task-scope", () => ({ canUserAccessTaskDetail: jest.fn(), canUserEditTask: jest.fn() }));
jest.mock("../decorators/handle-exceptions", () => ({ __esModule: true, default: () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) => descriptor }));

import db from "../config/db";
import GanttController from "../controllers/gantt-controller";
import roadmapApiRouter from "../routes/apis/roadmap-api-router";
import { checkProjectRolePermission } from "../shared/project-role-permissions";
import { canUserAccessTaskDetail } from "../shared/assignee-task-scope";
import { createMockRequest, createMockResponse } from "./utils/express-mock";
import { createQueryResult } from "./utils/db-mock";

interface RouteLayer { route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (...args: never[]) => unknown }> } }
const query = db.query as jest.MockedFunction<typeof db.query>;
const projectPermission = checkProjectRolePermission as jest.MockedFunction<typeof checkProjectRolePermission>;
const canAccess = canUserAccessTaskDetail as jest.MockedFunction<typeof canUserAccessTaskDetail>;

beforeEach(() => jest.clearAllMocks());

describe("roadmap task authorization", () => {
  it("denies date changes for tasks outside the user's assignee scope", async () => {
    const route = (roadmapApiRouter as unknown as { stack: RouteLayer[] }).stack.find(layer => layer.route?.path === "/update-task-dates" && layer.route.methods.post)?.route;
    expect(route).toBeDefined();
    const guard = route!.stack[0].handle as unknown as (req: unknown, res: unknown, next: () => void) => Promise<void>;
    query.mockResolvedValueOnce(createQueryResult([{ project_id: "project", project_team_id: "team" }]));
    projectPermission.mockResolvedValueOnce({ allowed: true } as Awaited<ReturnType<typeof checkProjectRolePermission>>);
    canAccess.mockResolvedValueOnce(false);
    const res = createMockResponse();
    const next = jest.fn();
    await guard(createMockRequest({ user: { id: "user", team_id: "team" }, method: "POST", body: { task_id: "task" } }), res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
  it.each([
    { status_valid: false, phase_valid: true },
    { status_valid: true, phase_valid: false },
  ])("rejects a foreign status or phase before creating a task", async validation => {
    query.mockResolvedValueOnce(createQueryResult([validation]));
    const res = createMockResponse();
    await GanttController.createTask(createMockRequest({ body: { project_id: "project", name: "Task", status_id: "status", phase_id: "phase" } }), res);
    expect(res.statusCode).toBe(400);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query.mock.calls[0][1]).toEqual(["project", "status", "phase"]);
  });
});

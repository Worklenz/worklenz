jest.unmock("../controllers/schedule-v2/task-timeline-controller");
jest.unmock("../decorators/handle-exceptions");
jest.unmock("../controllers/worklenz-controller-base");
jest.unmock("../models/server-response");
jest.unmock("../shared/assignee-task-scope");
jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock("../shared/io", () => ({ IO: { getInstance: jest.fn() } }));
jest.mock("../shared/utils", () => ({ getColor: jest.fn(), log_error: jest.fn() }));

import db from "../config/db";
import TaskTimelineController from "../controllers/schedule-v2/task-timeline-controller";
import { createMockRequest, createMockResponse } from "./utils/express-mock";

const query = db.query as jest.Mock;

beforeEach(() => {
  query.mockReset().mockResolvedValue({ rows: [] });
});

const sqlOf = (): string => query.mock.calls[0][0] as string;
const paramsOf = (): unknown[] => query.mock.calls[0][1] as unknown[];

describe("task timeline planner access", () => {
  it("denies a Member planner-wide access to tasks in projects they cannot access", async () => {
    const res = createMockResponse();
    await TaskTimelineController.getTasksForTimeline(createMockRequest({
      user: {
        id: "member-1",
        team_id: "team-1",
        role_name: "Member",
        owner: false,
        is_admin: false,
        is_guest: false,
      },
      query: { projectId: "project-they-cannot-access" },
    }), res);

    const sql = sqlOf();
    expect(sql).toContain("is_member_of_project(p.id, $2::UUID, $1::UUID)");
    expect(sql).toContain("COALESCE(r_priv.name, '') IN ('Owner', 'Admin', 'Team Lead')");
    expect(sql).not.toMatch(/admin_role\s*=\s*TRUE/);
    expect(paramsOf().slice(0, 2)).toEqual(["team-1", "member-1"]);
    expect(paramsOf()).toContain("project-they-cannot-access");
    expect(res.statusCode).toBe(200);
  });

  it("still identifies a Team Lead by role name so team-wide rows stay available to that role", async () => {
    const res = createMockResponse();
    await TaskTimelineController.getTasksForTimeline(createMockRequest({
      user: {
        id: "lead-1",
        team_id: "team-1",
        role_name: "Team Lead",
        owner: false,
        is_admin: false,
      },
    }), res);

    expect(sqlOf()).toContain("'Team Lead'");
    expect(sqlOf()).toContain("is_member_of_project(p.id, $2::UUID, $1::UUID)");
    expect(paramsOf().slice(0, 2)).toEqual(["team-1", "lead-1"]);
  });

  it("does not query when the caller has no session", async () => {
    const res = createMockResponse();
    await TaskTimelineController.getTasksForTimeline(createMockRequest({
      user: undefined,
    }), res);

    expect(res.statusCode).toBe(401);
    expect(query).not.toHaveBeenCalled();
  });
});

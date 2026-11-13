import db from "../config/db";
import CustomReportsController from "../controllers/custom-reports-controller";
import SoftwareReportsController from "../controllers/software-reports-controller";
import {createMockRequest, createMockResponse} from "./utils/express-mock";

jest.mock("../config/db", () => ({
  query: jest.fn(),
}));

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const SPRINT_ID = "22222222-2222-4222-8222-222222222222";

describe("software / custom report sprint scope queries", () => {
  const dbQueryMock = db.query as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("scopes the flow report with recursive inherited sprint membership", async () => {
    dbQueryMock.mockImplementation(async (sql: string) => {
      if (sql.includes("sprint_status = 'active'")) {
        return {rows: [{id: SPRINT_ID, name: "Sprint 1"}]};
      }
      if (sql.includes("blocked_count")) {
        return {rows: [{blocked_count: 2}]};
      }
      if (sql.includes("current_count")) {
        return {rows: [{current_count: 0, previous_count: 0}]};
      }
      return {rows: []};
    });

    const req = createMockRequest({query: {project_id: PROJECT_ID}});
    const res = createMockResponse();

    await SoftwareReportsController.getFlowReport(req, res);

    const scopedCalls = dbQueryMock.mock.calls.filter(
      ([sql]) => typeof sql === "string" && sql.includes("WITH RECURSIVE")
    );
    expect(scopedCalls.length).toBeGreaterThanOrEqual(2);

    for (const [sql, params] of scopedCalls) {
      expect(sql).toContain("parent_task_id");
      expect(sql).toContain("NOT EXISTS (SELECT 1 FROM task_phase own");
      expect(params).toEqual([PROJECT_ID, SPRINT_ID]);
    }

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.body.blocked_count).toBe(2);
  });

  it("aggregates custom sprint counts using inherited multi-level descendants", async () => {
    dbQueryMock.mockResolvedValueOnce({
      rows: [{key: SPRINT_ID, label: "Sprint 1", color: null, value: 3}],
    });

    const req = createMockRequest({
      body: {
        project_id: PROJECT_ID,
        source: "sprints",
        metric: "count",
        group_by: "sprint",
        filter: "all",
      },
    });
    const res = createMockResponse();

    await CustomReportsController.preview(req, res);

    expect(dbQueryMock).toHaveBeenCalledTimes(1);
    const [sql] = dbQueryMock.mock.calls[0];
    expect(sql).toContain("WITH RECURSIVE sprint_scope AS");
    expect(sql).toContain("child.parent_task_id = ss.id");
    expect(sql).toContain("NOT EXISTS (SELECT 1 FROM task_phase own WHERE own.task_id = child.id)");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.body.rows[0].value).toBe(3);
  });
});

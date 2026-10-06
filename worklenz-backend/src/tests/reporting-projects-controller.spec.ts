import ReportingProjectsController from "../controllers/reporting/projects/reporting-projects-controller";
import db from "../config/db";
import { createMockRequest, createMockResponse } from "./utils/express-mock";

const mockClient = {
  query: jest.fn(),
  release: jest.fn()
};

jest.mock("../config/db", () => ({
  query: jest.fn(),
  pool: {
    connect: jest.fn()
  }
}));

describe("ReportingProjectsController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (db.pool.connect as jest.Mock).mockResolvedValue(mockClient);

    (db.query as jest.Mock).mockImplementation((sql: string) => {
      if (sql.includes("is_team_lead")) {
        return Promise.resolve({ rows: [{ is_team_lead: false }] });
      }
      if (sql.includes("sys_task_status_categories")) {
        return Promise.resolve({
          rows: [
            { id: "cat-done", is_done: true, is_doing: false, is_todo: false },
            { id: "cat-doing", is_done: false, is_doing: true, is_todo: false },
            { id: "cat-todo", is_done: false, is_doing: false, is_todo: true }
          ]
        });
      }
      return Promise.resolve({
        rows: [
          {
            total: 1,
            projects: [
              {
                id: "p-101",
                name: "Cloud Migration",
                color_code: "#1890ff",
                status_id: "s-1",
                status_name: "In Progress",
                team_name: "Dev Team",
                end_date: "2026-10-15",
                estimated_time: 600,
                actual_time: 1200,
                update: [],
                tasks_stat: { todo: 2, doing: 3, done: 5, total: 10 },
                project_manager: null
              }
            ]
          }
        ]
      });
    });

    mockClient.query.mockImplementation((sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql.includes("set_config")) {
        return Promise.resolve({ rows: [] });
      }
      return Promise.resolve({
        rows: [
          {
            group_id: "cat-1",
            group_name: "Internal Tools",
            group_color: "#1890ff",
            project_count: 1,
            total_tasks: 4,
            done_tasks: 2,
            doing_tasks: 1,
            todo_tasks: 1,
            total_groups: 1,
            total_project_count: 1,
            projects: [
              {
                id: "p-1",
                name: "Worklenz Admin",
                start_date: "2026-01-01",
                end_date: "2026-06-01",
                tasks_stat: { total: 4, todo: 1, doing: 1, done: 2 }
              }
            ]
          }
        ]
      });
    });
  });

  describe("get", () => {
    it("should query projects with pagination and format metrics", async () => {
      const req = createMockRequest({
        query: {
          index: "0",
          size: "10",
          sort: "p.name",
          order: "ASC"
        },
        user: {
          id: "u-1",
          team_id: "t-1",
          name: "Test User",
          email: "test@example.com",
          owner: true
        }
      });
      const res = createMockResponse();

      await ReportingProjectsController.get(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(200);
      const sendCall = (res.send as jest.Mock).mock.calls[0][0];
      expect(sendCall.done).toBe(true);
      expect(sendCall.body.projects).toHaveLength(1);
      expect(sendCall.body.projects[0].id).toBe("p-101");
      expect(sendCall.body.projects[0].estimated_time).toBe(600);
      expect(sendCall.body.projects[0].actual_time).toBe(1200);
      expect(sendCall.body.total).toBe(1);
    });

    it("should handle filter query parameters like statuses, healths, and no-category", async () => {
      const req = createMockRequest({
        query: {
          statuses: "s-1,s-2",
          healths: "h-1",
          categories: "__no_category__"
        },
        user: {
          id: "u-1",
          team_id: "t-1",
          name: "Test User",
          email: "test@example.com",
          owner: true
        }
      });
      const res = createMockResponse();

      await ReportingProjectsController.get(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(200);
      // Find the main projects query (not the is_team_lead check)
      const projectQueryCalls = (db.query as jest.Mock).mock.calls.map(c => c[0]);
      const mainQuery = projectQueryCalls.find(q => q.includes("FROM projects"));
      expect(mainQuery).toBeDefined();
      expect(mainQuery).toContain("p.status_id IN");
      expect(mainQuery).toContain("p.health_id IN");
      expect(mainQuery).toContain("p.category_id IS NULL");
    });
  });

  describe("getGrouped", () => {
    it("should group projects by category using transactional connection", async () => {
      const req = createMockRequest({
        query: {
          group_by: "category"
        },
        user: {
          id: "u-1",
          team_id: "t-1",
          name: "Test User",
          email: "test@example.com",
          owner: true
        }
      });
      const res = createMockResponse();

      await ReportingProjectsController.getGrouped(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(mockClient.release).toHaveBeenCalled();

      const sendCall = (res.send as jest.Mock).mock.calls[0][0];
      expect(sendCall.done).toBe(true);
      expect(sendCall.body.groups).toHaveLength(1);
      expect(sendCall.body.groups[0].group_name).toBe("Internal Tools");
      expect(sendCall.body.groups[0].project_count).toBe(1);
      expect(sendCall.body.groups[0].total_tasks).toBe(4);
    });

    it("should handle empty grouped query response gracefully", async () => {
      const req = createMockRequest({
        query: {
          group_by: "status"
        },
        user: {
          id: "u-1",
          team_id: "t-1",
          name: "Test User",
          email: "test@example.com",
          owner: true
        }
      });
      const res = createMockResponse();

      mockClient.query.mockImplementation((sql: string) => {
        if (sql === "BEGIN" || sql === "COMMIT" || sql.includes("set_config")) {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      await ReportingProjectsController.getGrouped(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(200);
      const sendCall = (res.send as jest.Mock).mock.calls[0][0];
      expect(sendCall.done).toBe(true);
      expect(sendCall.body.groups).toEqual([]);
      expect(sendCall.body.total_groups).toBe(0);
    });
  });
});

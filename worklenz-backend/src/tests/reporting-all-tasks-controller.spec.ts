import db from "../config/db";
import ReportingAllTasksController from "../controllers/reporting/reporting-all-tasks-controller";
import { createMockRequest, createMockResponse } from "./utils/express-mock";

const mockAddRow = jest.fn();
const mockSheet = {
  columns: [],
  getRow: jest.fn().mockReturnValue({ font: {}, fill: {} }),
  addRow: mockAddRow,
};
const mockWorkbook = {
  addWorksheet: jest.fn().mockReturnValue(mockSheet),
  xlsx: { write: jest.fn().mockResolvedValue(undefined) },
  csv: { write: jest.fn().mockResolvedValue(undefined) },
};

jest.mock("exceljs", () => ({
  Workbook: jest.fn().mockImplementation(() => mockWorkbook),
}));

jest.mock("../config/db", () => ({
  query: jest.fn(),
}));

describe("ReportingAllTasksController", () => {
  const dbQueryMock = db.query as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getReportingAllTasks", () => {
    it("should return 400 if teamId is missing in request", async () => {
      const req = createMockRequest({
        user: { id: "user-1", email: "test@example.com" }, // no team_id
        body: {},
      });
      const res = createMockResponse();

      await ReportingAllTasksController.getReportingAllTasks(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.body.done).toBe(false);
      expect(res.body.message).toBe("Team ID is required");
    });

    it("should fetch tasks, format time strings, and return calculated stats", async () => {
      const tasksRows = [
        {
          id: "t-1",
          name: "Task 1",
          task_no: 101,
          total_minutes: "60",
          time_spent_seconds: "5400", // 90 mins -> overlogged by 30 mins
          names: [{ id: "m-1", name: "Alice" }],
          labels: [{ id: "l-1", name: "Bug" }],
        },
        {
          id: "t-2",
          name: "Task 2",
          task_no: 102,
          total_minutes: "120",
          time_spent_seconds: "3600", // 60 mins -> not overlogged
          names: [],
          labels: [],
        },
      ];

      const countRows = [{ total: "2" }];
      const statsRows = [
        {
          total_tasks: "2",
          completed_tasks: "1",
          in_progress_tasks: "1",
          overdue_tasks: "0",
          unassigned_tasks: "1",
          due_this_week: "2",
        },
      ];

      dbQueryMock
        .mockResolvedValueOnce({ rows: tasksRows })
        .mockResolvedValueOnce({ rows: countRows })
        .mockResolvedValueOnce({ rows: statsRows });

      const req = createMockRequest({
        user: { id: "user-1", team_id: "team-1" },
        body: {
          index: 1,
          size: 10,
          sortField: "name",
          sortOrder: "asc",
        },
      });
      const res = createMockResponse();

      await ReportingAllTasksController.getReportingAllTasks(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.body.done).toBe(true);

      const responseData = res.body.body;
      expect(responseData.total).toBe(2);
      expect(responseData.page).toBe(1);
      expect(responseData.pageSize).toBe(10);

      // Verify task 1 time formatting
      expect(responseData.data[0].total_time_string).toBe("1h 0m");
      expect(responseData.data[0].time_spent_string).toBe("1h 30m");
      expect(responseData.data[0].overlogged_time_string).toBe("0h 30m");

      // Verify task 2 time formatting
      expect(responseData.data[1].total_time_string).toBe("2h 0m");
      expect(responseData.data[1].time_spent_string).toBe("1h 0m");
      expect(responseData.data[1].overlogged_time_string).toBeNull();

      // Verify parsed stats
      expect(responseData.stats).toEqual({
        totalTasks: 2,
        completedTasks: 1,
        inProgressTasks: 1,
        overdueTasks: 0,
        unassignedTasks: 1,
        dueThisWeek: 2,
      });
    });

    it("should construct appropriate SQL clauses for complex filter conditions", async () => {
      dbQueryMock
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: "0" }] })
        .mockResolvedValueOnce({ rows: [{}] });

      const req = createMockRequest({
        user: { id: "user-1", team_id: "team-1" },
        body: {
          teams: ["t-1", "t-2"],
          includeArchived: true,
          includeSubtasks: true,
          projects: ["p-1"],
          statuses: ["todo", "doing", "done"],
          priorities: ["pr-high"],
          assignees: ["unassigned", "member-99"],
          labels: ["lbl-1"],
          phases: ["phase-1"],
          clients: ["client-1"],
          dateField: "due_date",
          dateFrom: "2026-01-01",
          dateTo: "2026-01-31",
          completionStatus: "overdue",
          billable: "billable",
          search: "Login Issue",
          sortField: "overdue_days",
          sortOrder: "desc",
        },
      });
      const res = createMockResponse();

      await ReportingAllTasksController.getReportingAllTasks(req, res);

      expect(res.status).toHaveBeenCalledWith(200);

      const executedTaskQuery = dbQueryMock.mock.calls[0][0] as string;
      const executedParams = dbQueryMock.mock.calls[0][1] as any[];

      // Check clauses
      expect(executedTaskQuery).toContain("t.project_id IN (SELECT id FROM projects WHERE team_id IN ($1, $2))");
      expect(executedTaskQuery).toContain("t.project_id IN ($3)");
      expect(executedTaskQuery).toContain("is_todo(t.status_id, t.project_id)");
      expect(executedTaskQuery).toContain("is_doing(t.status_id, t.project_id)");
      expect(executedTaskQuery).toContain("is_completed(t.status_id, t.project_id)");
      expect(executedTaskQuery).toContain("t.priority_id IN ($4)");
      expect(executedTaskQuery).toContain("NOT EXISTS (SELECT 1 FROM tasks_assignees ta WHERE ta.task_id = t.id)");
      expect(executedTaskQuery).toContain("EXISTS (SELECT 1 FROM tasks_assignees ta WHERE ta.task_id = t.id AND ta.team_member_id IN ($5))");
      expect(executedTaskQuery).toContain("EXISTS (SELECT 1 FROM task_labels tl WHERE tl.task_id = t.id AND tl.label_id IN ($6))");
      expect(executedTaskQuery).toContain("EXISTS (SELECT 1 FROM task_phase tp WHERE tp.task_id = t.id AND tp.phase_id IN ($7))");
      expect(executedTaskQuery).toContain("t.project_id IN (SELECT id FROM projects WHERE client_id IN ($8))");
      expect(executedTaskQuery).toContain("t.end_date::DATE >= $9::DATE");
      expect(executedTaskQuery).toContain("t.end_date::DATE <= $10::DATE");
      expect(executedTaskQuery).toContain("t.end_date::DATE < CURRENT_DATE AND NOT is_completed(t.status_id, t.project_id)");
      expect(executedTaskQuery).toContain("t.billable IS TRUE");
      expect(executedTaskQuery).toContain("ORDER BY overdue_days DESC NULLS LAST");

      expect(executedParams).toContain("t-1");
      expect(executedParams).toContain("t-2");
      expect(executedParams).toContain("p-1");
      expect(executedParams).toContain("pr-high");
      expect(executedParams).toContain("member-99");
      expect(executedParams).toContain("lbl-1");
      expect(executedParams).toContain("phase-1");
      expect(executedParams).toContain("client-1");
      expect(executedParams).toContain("2026-01-01");
      expect(executedParams).toContain("2026-01-31");
    });

    it("should handle incomplete status and non-billable filter clauses", async () => {
      dbQueryMock
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: "0" }] })
        .mockResolvedValueOnce({ rows: [{}] });

      const req = createMockRequest({
        user: { id: "user-1", team_id: "team-1" },
        body: {
          completionStatus: "incomplete",
          billable: "non-billable",
        },
      });
      const res = createMockResponse();

      await ReportingAllTasksController.getReportingAllTasks(req, res);

      const executedTaskQuery = dbQueryMock.mock.calls[0][0] as string;
      expect(executedTaskQuery).toContain("NOT is_completed(t.status_id, t.project_id)");
      expect(executedTaskQuery).toContain("t.billable IS FALSE OR t.billable IS NULL");
      // Default archived and subtask filters
      expect(executedTaskQuery).toContain("t.parent_task_id IS NULL");
      expect(executedTaskQuery).toContain("archived_projects");
    });

    it("should handle completed completionStatus filter clause", async () => {
      dbQueryMock
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ total: "0" }] })
        .mockResolvedValueOnce({ rows: [{}] });

      const req = createMockRequest({
        user: { id: "user-1", team_id: "team-1" },
        body: {
          completionStatus: "completed",
        },
      });
      const res = createMockResponse();

      await ReportingAllTasksController.getReportingAllTasks(req, res);

      const executedTaskQuery = dbQueryMock.mock.calls[0][0] as string;
      expect(executedTaskQuery).toContain("is_completed(t.status_id, t.project_id)");
    });
  });

  describe("exportCSV", () => {
    it("should fetch tasks, write csv rows and set text/csv headers", async () => {
      const task = {
        id: "t-1",
        name: "Test Task",
        task_key: "PRJ-101",
        project_name: "My Project",
        status_name: "In Progress",
        priority_name: "High",
        total_minutes: "120",
        time_spent_seconds: "7200",
        client_name: "Acme Corp",
        names: [{ name: "Bob" }, { name: "Charlie" }],
        labels: [{ name: "Frontend" }],
      };

      dbQueryMock
        .mockResolvedValueOnce({ rows: [task] })
        .mockResolvedValueOnce({ rows: [{ total: "1" }] })
        .mockResolvedValueOnce({ rows: [{}] });

      const req = createMockRequest({
        user: { id: "user-1", team_id: "team-1" },
        body: {},
      });
      const res = createMockResponse();

      await ReportingAllTasksController.exportCSV(req, res);

      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/csv");
      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        expect.stringMatching(/^attachment; filename=All Tasks - .*\.csv$/)
      );
      expect(mockAddRow).toHaveBeenCalledWith(
        expect.objectContaining({
          task_key: "PRJ-101",
          task: "Test Task",
          project: "My Project",
          status: "In Progress",
          priority: "High",
          assignees: "Bob, Charlie",
          labels: "Frontend",
          client: "Acme Corp",
        })
      );
      expect(mockWorkbook.csv.write).toHaveBeenCalledWith(res);
      expect(res.end).toHaveBeenCalled();
    });
  });

  describe("exportExcel", () => {
    it("should fetch tasks, write excel sheet and set xlsx headers", async () => {
      const task = {
        id: "t-2",
        name: "Excel Task",
        task_key: "PRJ-202",
        project_name: "Mobile App",
        status_name: "Done",
        priority_name: "Medium",
        total_minutes: "60",
        time_spent_seconds: "3600",
        names: [],
        labels: [],
      };

      dbQueryMock
        .mockResolvedValueOnce({ rows: [task] })
        .mockResolvedValueOnce({ rows: [{ total: "1" }] })
        .mockResolvedValueOnce({ rows: [{}] });

      const req = createMockRequest({
        user: { id: "user-1", team_id: "team-1" },
        body: {},
      });
      const res = createMockResponse();

      await ReportingAllTasksController.exportExcel(req, res);

      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "application/vnd.openxmlformats"
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        expect.stringMatching(/^attachment; filename=All Tasks - .*\.xlsx$/)
      );
      expect(mockAddRow).toHaveBeenCalledWith(
        expect.objectContaining({
          task_key: "PRJ-202",
          task: "Excel Task",
          project: "Mobile App",
          status: "Done",
          assignees: "",
          labels: "-",
        })
      );
      expect(mockWorkbook.xlsx.write).toHaveBeenCalledWith(res);
      expect(res.end).toHaveBeenCalled();
    });
  });
});

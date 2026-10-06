import ReportingAllocationController from "../controllers/reporting/reporting-allocation-controller";
import db from "../config/db";
import { createMockRequest, createMockResponse } from "./utils/express-mock";

jest.mock("../config/db", () => ({
  query: jest.fn()
}));

describe("ReportingAllocationController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getEstimatedVsActual", () => {
    it("should return empty array immediately if teams or projects are empty", async () => {
      const req = createMockRequest({
        body: {
          teams: [],
          projects: ["p-1"],
          billable: { billable: true, nonBillable: true }
        }
      });
      const res = createMockResponse();

      await ReportingAllocationController.getEstimatedVsActual(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({
          done: true,
          body: []
        })
      );
      expect(db.query).not.toHaveBeenCalled();
    });

    it("should calculate logged time and estimated values for MAN_DAYS", async () => {
      const req = createMockRequest({
        body: {
          teams: ["t-1"],
          projects: ["p-1"],
          categories: ["c-1"],
          type: "MAN_DAYS",
          duration: "LAST_WEEK",
          billable: { billable: true, nonBillable: true }
        }
      });
      const res = createMockResponse();

      // Mock database returning 1 project row with 7200 seconds (2 hours) logged time
      // 8 hours per day -> value = 2 / 8 = 0.25 days
      (db.query as jest.Mock).mockResolvedValue({
        rows: [
          {
            id: "p-1",
            name: "Alpha Project",
            end_date: "2026-10-01",
            hours_per_day: 8,
            estimated_man_days: 10,
            estimated_working_days: 12,
            logged_time: 7200,
            estimated: 600,
            color_code: "#1890ff"
          }
        ]
      });

      await ReportingAllocationController.getEstimatedVsActual(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(db.query).toHaveBeenCalledWith(expect.any(String), expect.any(Array));

      const sendCall = (res.send as jest.Mock).mock.calls[0][0];
      expect(sendCall.done).toBe(true);
      expect(sendCall.body).toHaveLength(1);

      const item = sendCall.body[0];
      expect(item.id).toBe("p-1");
      expect(item.name).toBe("Alpha Project");
      expect(item.value).toBe(0.25);
      expect(item.estimated_value).toBe(10); // Matches estimated_man_days
      expect(item.hours_per_day).toBe(8);
    });

    it("should calculate estimated value for WORKING_DAYS", async () => {
      const req = createMockRequest({
        body: {
          teams: ["t-1"],
          projects: ["p-1"],
          categories: ["c-1"],
          type: "WORKING_DAYS",
          billable: { billable: true, nonBillable: true }
        }
      });
      const res = createMockResponse();

      (db.query as jest.Mock).mockResolvedValue({
        rows: [
          {
            id: "p-1",
            name: "Beta Project",
            hours_per_day: 8,
            estimated_man_days: 5,
            estimated_working_days: 8,
            logged_time: 0,
            estimated: 0,
            color_code: "#52c41a"
          }
        ]
      });

      await ReportingAllocationController.getEstimatedVsActual(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(200);
      const sendCall = (res.send as jest.Mock).mock.calls[0][0];
      expect(sendCall.done).toBe(true);
      expect(sendCall.body).toHaveLength(1);
      expect(sendCall.body[0].estimated_value).toBe(8); // Matches estimated_working_days
      expect(sendCall.body[0].value).toBe(0);
    });

    it("should filter out rows with both zero value and zero estimated_value", async () => {
      const req = createMockRequest({
        body: {
          teams: ["t-1"],
          projects: ["p-1", "p-2"],
          type: "MAN_DAYS",
          noCategory: true,
          billable: { billable: true, nonBillable: true }
        }
      });
      const res = createMockResponse();

      (db.query as jest.Mock).mockResolvedValue({
        rows: [
          {
            id: "p-1",
            name: "Active Project",
            hours_per_day: 8,
            estimated_man_days: 5,
            logged_time: 3600
          },
          {
            id: "p-2",
            name: "Empty Project",
            hours_per_day: 8,
            estimated_man_days: 0,
            logged_time: 0
          }
        ]
      });

      await ReportingAllocationController.getEstimatedVsActual(req as any, res as any);

      const sendCall = (res.send as jest.Mock).mock.calls[0][0];
      expect(sendCall.done).toBe(true);
      expect(sendCall.body).toHaveLength(1);
      expect(sendCall.body[0].id).toBe("p-1");
    });
  });

  describe("getAllocation", () => {
    it("should return empty users and projects if teams or projects are empty", async () => {
      const req = createMockRequest({
        body: {
          teams: [],
          projects: []
        }
      });
      const res = createMockResponse();

      await ReportingAllocationController.getAllocation(req as any, res as any);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send).toHaveBeenCalledWith(
        expect.objectContaining({
          done: true,
          body: { users: [], projects: [] }
        })
      );
      expect(db.query).not.toHaveBeenCalled();
    });
  });
});

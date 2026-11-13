import AdminCenterHolidaysController from "../controllers/admin-center/admin-center-holidays-controller";
import db from "../config/db";
import { createMockRequest, createMockResponse } from "./utils/express-mock";
import { logAuditEvent, actorFromSessionUser } from "../services/audit-log.service";
import { AUDIT_EVENT_TYPE } from "../shared/audit-log-constants";

jest.mock("../config/db", () => ({
  query: jest.fn(),
}));

jest.mock("../services/audit-log.service", () => ({
  logAuditEvent: jest.fn(),
  actorFromSessionUser: jest.fn((user: any) => ({
    userId: user?.id,
    name: user?.name,
    email: user?.email,
  })),
}));

// Mock HolidayDataProvider for LK holiday sync
const mockGetSriLankanHolidays = jest.fn();
jest.mock("../../services/holiday-data-provider", () => ({
  HolidayDataProvider: {
    getSriLankanHolidays: (...args: any[]) => mockGetSriLankanHolidays(...args),
  },
}), { virtual: true });
// Also mock with the relative path used by require in admin-center-holidays-controller
jest.mock("../services/holiday-data-provider", () => ({
  HolidayDataProvider: {
    getSriLankanHolidays: (...args: any[]) => mockGetSriLankanHolidays(...args),
  },
}));

const mockQuery = db.query as jest.Mock;
const mockLogAuditEvent = logAuditEvent as jest.Mock;

describe("AdminCenterHolidaysController", () => {
  const mockUser = {
    id: "user-1",
    owner_id: "owner-1",
    organization_id: "org-1",
    team_id: "team-1",
    name: "John Doe",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getOrganizationHolidaySettings", () => {
    it("returns default settings when no holiday settings exist for the organization", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const req = createMockRequest({ user: mockUser });
      const res = createMockResponse();

      await AdminCenterHolidaysController.getOrganizationHolidaySettings(req, res);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining("FROM organization_holiday_settings"),
        ["owner-1"]
      );
      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.body).toEqual({
        country_code: null,
        state_code: null,
        auto_sync_holidays: true,
      });
    });

    it("returns saved holiday settings when they exist", async () => {
      const savedSettings = {
        id: "setting-1",
        organization_id: "org-1",
        country_code: "US",
        state_code: "CA",
        auto_sync_holidays: true,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      };
      mockQuery.mockResolvedValueOnce({ rows: [savedSettings] });

      const req = createMockRequest({ user: mockUser });
      const res = createMockResponse();

      await AdminCenterHolidaysController.getOrganizationHolidaySettings(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.body).toEqual(savedSettings);
    });
  });

  describe("updateOrganizationHolidaySettings", () => {
    it("returns 404 when organization is not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // org query

      const req = createMockRequest({
        user: mockUser,
        body: { country_code: "US", state_code: "NY", auto_sync_holidays: true },
      });
      const res = createMockResponse();

      await AdminCenterHolidaysController.updateOrganizationHolidaySettings(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.done).toBe(false);
      expect(res.body.body).toBe("Organization not found");
    });

    it("inserts new settings when no existing settings exist", async () => {
      const updatedRow = {
        id: "setting-1",
        organization_id: "org-1",
        country_code: "US",
        state_code: "NY",
        auto_sync_holidays: true,
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: "org-1" }] }) // org query
        .mockResolvedValueOnce({ rows: [] }) // check existing settings -> none
        .mockResolvedValueOnce({ rows: [updatedRow] }); // insert query

      const req = createMockRequest({
        user: mockUser,
        body: { country_code: "US", state_code: "NY", auto_sync_holidays: true },
      });
      const res = createMockResponse();

      await AdminCenterHolidaysController.updateOrganizationHolidaySettings(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.body).toEqual(updatedRow);

      const [insertSql, insertParams] = mockQuery.mock.calls[2];
      expect(insertSql).toContain("INSERT INTO organization_holiday_settings");
      expect(insertParams).toEqual(["org-1", "US", "NY", true]);
      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-1",
          eventType: AUDIT_EVENT_TYPE.WORKSPACE_SETTING_CHANGED.id,
          description: "Workspace holiday country changed",
          oldValue: null,
          newValue: "US",
        })
      );
    });

    it("updates existing settings and cleans up auto-synced holidays on country change", async () => {
      const updatedRow = {
        id: "setting-1",
        organization_id: "org-1",
        country_code: "GB",
        state_code: null,
        auto_sync_holidays: true,
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: "org-1" }] }) // org query
        .mockResolvedValueOnce({ rows: [{ id: "setting-1", country_code: "US" }] }) // check existing -> previous country was US
        .mockResolvedValueOnce({ rows: [updatedRow] }) // update query
        .mockResolvedValueOnce({ rows: [] }); // delete cleanup query

      const req = createMockRequest({
        user: mockUser,
        body: { country_code: "GB", state_code: null, auto_sync_holidays: true },
      });
      const res = createMockResponse();

      await AdminCenterHolidaysController.updateOrganizationHolidaySettings(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);

      const [updateSql] = mockQuery.mock.calls[2];
      expect(updateSql).toContain("UPDATE organization_holiday_settings");

      // Verify cleanup query was executed for previous country
      const [cleanupSql, cleanupParams] = mockQuery.mock.calls[3];
      expect(cleanupSql).toContain("DELETE FROM organization_holidays");
      expect(cleanupSql).toContain("is_auto_synced = TRUE");
      expect(cleanupParams).toEqual(["org-1"]);

      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-1",
          oldValue: "US",
          newValue: "GB",
        })
      );
    });

    it("does not log audit event when country code is unchanged", async () => {
      const updatedRow = {
        id: "setting-1",
        organization_id: "org-1",
        country_code: "US",
        state_code: "CA",
        auto_sync_holidays: true,
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: "org-1" }] }) // org query
        .mockResolvedValueOnce({ rows: [{ id: "setting-1", country_code: "US" }] }) // same country
        .mockResolvedValueOnce({ rows: [updatedRow] }); // update query

      const req = createMockRequest({
        user: mockUser,
        body: { country_code: "US", state_code: "CA", auto_sync_holidays: true },
      });
      const res = createMockResponse();

      await AdminCenterHolidaysController.updateOrganizationHolidaySettings(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockLogAuditEvent).not.toHaveBeenCalled();
    });

    it("syncs Sri Lankan holidays when country_code is LK and auto_sync is enabled", async () => {
      mockGetSriLankanHolidays.mockResolvedValue([
        {
          name: "Sinhala and Tamil New Year",
          description: "New Year",
          date: "2026-04-14",
          is_recurring: true,
        },
      ]);

      const updatedRow = {
        id: "setting-1",
        organization_id: "org-1",
        country_code: "LK",
        state_code: null,
        auto_sync_holidays: true,
      };

      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: "org-1" }] }) // org query
        .mockResolvedValueOnce({ rows: [{ id: "setting-1", country_code: "LK" }] }) // existing
        .mockResolvedValueOnce({ rows: [updatedRow] }) // update query
        .mockResolvedValue({ rows: [] }); // insert into country_holidays

      const req = createMockRequest({
        user: mockUser,
        body: { country_code: "LK", state_code: null, auto_sync_holidays: true },
      });
      const res = createMockResponse();

      await AdminCenterHolidaysController.updateOrganizationHolidaySettings(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockGetSriLankanHolidays).toHaveBeenCalled();
      // Verifies country_holidays insertion occurred
      const countryHolidayCalls = mockQuery.mock.calls.filter(([sql]) =>
        sql.includes("INSERT INTO country_holidays")
      );
      expect(countryHolidayCalls.length).toBeGreaterThan(0);
    });
  });

  describe("getCountriesWithStates", () => {
    it("returns countries list with populated US states and Canadian provinces", async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { code: "US", name: "United States" },
          { code: "CA", name: "Canada" },
          { code: "GB", name: "United Kingdom" },
        ],
      });

      const req = createMockRequest({ user: mockUser });
      const res = createMockResponse();

      await AdminCenterHolidaysController.getCountriesWithStates(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);

      const countries = res.body.body;
      const us = countries.find((c: any) => c.code === "US");
      const ca = countries.find((c: any) => c.code === "CA");
      const gb = countries.find((c: any) => c.code === "GB");

      expect(us.states.length).toBeGreaterThan(50);
      expect(us.states).toContainEqual({ code: "CA", name: "California" });
      expect(ca.states.length).toBe(13);
      expect(ca.states).toContainEqual({ code: "ON", name: "Ontario" });
      expect(gb.states).toEqual([]);
    });
  });
});

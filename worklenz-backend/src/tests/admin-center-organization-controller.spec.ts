import AdminCenterOrganizationController from "../controllers/admin-center/admin-center-organization-controller";
import db from "../config/db";
import { createMockRequest, createMockResponse } from "./utils/express-mock";
import { uploadBase64, getOrganizationLogoKey, deleteObject, getRootDir } from "../shared/storage";
import { logAuditEvent, actorFromSessionUser } from "../services/audit-log.service";
import { AUDIT_EVENT_TYPE } from "../shared/audit-log-constants";

jest.mock("../config/db", () => ({
  query: jest.fn(),
}));

jest.mock("../shared/storage", () => ({
  uploadBase64: jest.fn(),
  getOrganizationLogoKey: jest.fn(),
  deleteObject: jest.fn(),
  getRootDir: jest.fn().mockReturnValue("test-env"),
}));

jest.mock("../services/audit-log.service", () => ({
  logAuditEvent: jest.fn(),
  actorFromSessionUser: jest.fn((user: any) => ({
    userId: user?.id,
    name: user?.name,
    email: user?.email,
  })),
}));

const mockQuery = db.query as jest.Mock;
const mockUploadBase64 = uploadBase64 as jest.Mock;
const mockGetOrganizationLogoKey = getOrganizationLogoKey as jest.Mock;
const mockDeleteObject = deleteObject as jest.Mock;
const mockLogAuditEvent = logAuditEvent as jest.Mock;

describe("AdminCenterOrganizationController", () => {
  const mockUser = {
    id: "user-1",
    owner_id: "owner-1",
    organization_id: "org-1",
    team_id: "team-1",
    name: "John Doe",
    email: "john@example.com",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getOrganizationDetails", () => {
    it("returns 200 with organization details for the owner", async () => {
      const orgData = {
        name: "Acme Corp",
        contact_number: "1234567890",
        contact_number_secondary: null,
        email: "owner@example.com",
        owner_name: "Owner User",
        calculation_method: "hourly",
        hours_per_day: 8,
        logo_url: "https://example.com/logo.png",
      };
      mockQuery.mockResolvedValueOnce({ rows: [orgData] });

      const req = createMockRequest({ user: mockUser });
      const res = createMockResponse();

      await AdminCenterOrganizationController.getOrganizationDetails(req, res);

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("FROM organizations"), ["owner-1"]);
      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.body).toEqual(orgData);
    });
  });

  describe("getAdminCenterSettings", () => {
    it("returns 200 with admin center settings", async () => {
      const settingsData = {
        name: "Acme Corp",
        contact_number: "1234567890",
        calculation_method: "hourly",
        hours_per_day: 8,
        logo_url: null,
      };
      mockQuery.mockResolvedValueOnce({ rows: [settingsData] });

      const req = createMockRequest({ user: mockUser });
      const res = createMockResponse();

      await AdminCenterOrganizationController.getAdminCenterSettings(req, res);

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("FROM organizations"), ["owner-1"]);
      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.body).toEqual(settingsData);
    });
  });

  describe("getOrganizationAdmins", () => {
    it("returns 200 with list of administrators and owners", async () => {
      const admins = [
        { name: "John Doe", email: "john@example.com", is_owner: true },
        { name: "Jane Admin", email: "jane@example.com", is_owner: false },
      ];
      mockQuery.mockResolvedValueOnce({ rows: admins });

      const req = createMockRequest({ user: mockUser });
      const res = createMockResponse();

      await AdminCenterOrganizationController.getOrganizationAdmins(req, res);

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("WHERE tm.team_id IN"), ["owner-1"]);
      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.body).toEqual(admins);
    });
  });

  describe("getOrganizationUsers", () => {
    it("returns 200 with paginated user list", async () => {
      const usersData = {
        total: 1,
        data: [{ email: "john@example.com", name: "John Doe" }],
      };
      mockQuery.mockResolvedValueOnce({ rows: [{ users: usersData }] });

      const req = createMockRequest({
        user: mockUser,
        query: { size: "10", index: "1" },
      });
      const res = createMockResponse();

      await AdminCenterOrganizationController.getOrganizationUsers(req, res);

      expect(mockQuery).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.body).toEqual(usersData);
    });

    it("applies search query parameters when search term is provided", async () => {
      const usersData = { total: 0, data: [] };
      mockQuery.mockResolvedValueOnce({ rows: [{ users: usersData }] });

      const req = createMockRequest({
        user: mockUser,
        query: { size: "10", index: "1", search: "Alice" },
      });
      const res = createMockResponse();

      await AdminCenterOrganizationController.getOrganizationUsers(req, res);

      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toContain("ILIKE");
      expect(params).toContain("%Alice%");
      expect(res.statusCode).toBe(200);
    });
  });

  describe("updateOrganizationName", () => {
    it("updates the organization name and writes an audit log when name changes", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ organization_name: "Old Org Name" }] })
        .mockResolvedValueOnce({ rows: [{ organization_name: "New Org Name" }] });

      const req = createMockRequest({
        user: mockUser,
        body: { name: "New Org Name" },
      });
      const res = createMockResponse();

      await AdminCenterOrganizationController.updateOrganizationName(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(mockLogAuditEvent).toHaveBeenCalledWith({
        organizationId: "org-1",
        teamId: "team-1",
        actor: expect.objectContaining({ userId: "user-1" }),
        eventType: AUDIT_EVENT_TYPE.WORKSPACE_RENAMED.id,
        description: 'Workspace renamed from "Old Org Name" to "New Org Name"',
        oldValue: "Old Org Name",
        newValue: "New Org Name",
      });
    });

    it("does not write an audit log if the organization name is unchanged", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ organization_name: "Same Name" }] })
        .mockResolvedValueOnce({ rows: [{ organization_name: "Same Name" }] });

      const req = createMockRequest({
        user: mockUser,
        body: { name: "Same Name" },
      });
      const res = createMockResponse();

      await AdminCenterOrganizationController.updateOrganizationName(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockLogAuditEvent).not.toHaveBeenCalled();
    });
  });

  describe("updateOwnerContactNumber", () => {
    it("updates contact number and writes an audit log when changed", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ contact_number: "0112345678" }] })
        .mockResolvedValueOnce({ rows: [{ contact_number: "0771234567" }] });

      const req = createMockRequest({
        user: mockUser,
        body: { contact_number: "0771234567" },
      });
      const res = createMockResponse();

      await AdminCenterOrganizationController.updateOwnerContactNumber(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(mockLogAuditEvent).toHaveBeenCalledWith({
        organizationId: "org-1",
        teamId: "team-1",
        actor: expect.objectContaining({ userId: "user-1" }),
        eventType: AUDIT_EVENT_TYPE.WORKSPACE_SETTING_CHANGED.id,
        description: "Workspace owner contact number updated",
        oldValue: "0112345678",
        newValue: "0771234567",
      });
    });

    it("does not write an audit log when contact number is unchanged", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ contact_number: "0771234567" }] })
        .mockResolvedValueOnce({ rows: [{ contact_number: "0771234567" }] });

      const req = createMockRequest({
        user: mockUser,
        body: { contact_number: "0771234567" },
      });
      const res = createMockResponse();

      await AdminCenterOrganizationController.updateOwnerContactNumber(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockLogAuditEvent).not.toHaveBeenCalled();
    });
  });

  describe("uploadOrganizationLogo", () => {
    const validBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    it("returns 400 when user has no owner_id", async () => {
      const req = createMockRequest({ user: { id: "user-1" }, body: { logoData: validBase64 } });
      const res = createMockResponse();

      await AdminCenterOrganizationController.uploadOrganizationLogo(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("User not found");
    });

    it("returns 404 when organization is not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const req = createMockRequest({ user: mockUser, body: { logoData: validBase64 } });
      const res = createMockResponse();

      await AdminCenterOrganizationController.uploadOrganizationLogo(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("Organization not found");
    });

    it("returns 400 when logoData is missing", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "org-1" }] });

      const req = createMockRequest({ user: mockUser, body: {} });
      const res = createMockResponse();

      await AdminCenterOrganizationController.uploadOrganizationLogo(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Logo data is required");
    });

    it("returns 400 for invalid image format prefix", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "org-1" }] });

      const req = createMockRequest({
        user: mockUser,
        body: { logoData: "not-a-valid-data-url" },
      });
      const res = createMockResponse();

      await AdminCenterOrganizationController.uploadOrganizationLogo(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("Invalid image format");
    });

    it("returns 400 for unsupported mime type (e.g. gif)", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "org-1" }] });

      const req = createMockRequest({
        user: mockUser,
        body: { logoData: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" },
      });
      const res = createMockResponse();

      await AdminCenterOrganizationController.uploadOrganizationLogo(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain("Only PNG, JPG, JPEG, and WEBP");
    });

    it("returns 400 if image exceeds 5MB size limit", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "org-1" }] });

      // Generate a string larger than 5MB
      const largeBase64 = "data:image/png;base64," + "A".repeat(7 * 1024 * 1024);

      const req = createMockRequest({ user: mockUser, body: { logoData: largeBase64 } });
      const res = createMockResponse();

      await AdminCenterOrganizationController.uploadOrganizationLogo(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain("less than 5MB");
    });

    it("deletes old logo and uploads new logo successfully", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: "org-1" }] }) // select org id
        .mockResolvedValueOnce({ rows: [{ logo_url: "https://s3.amazonaws.com/bucket/organization-logos/old-logo.png" }] }) // old logo
        .mockResolvedValueOnce({ rows: [{ logo_url: "https://s3.amazonaws.com/new-logo.png" }] }) // update org
        .mockResolvedValueOnce({ rows: [] }); // sync client_portal_settings

      mockGetOrganizationLogoKey.mockReturnValue("organization-logos/test-env/org-1.png");
      mockUploadBase64.mockResolvedValueOnce("https://s3.amazonaws.com/new-logo.png");

      const req = createMockRequest({ user: mockUser, body: { logoData: validBase64 } });
      const res = createMockResponse();

      await AdminCenterOrganizationController.uploadOrganizationLogo(req, res);

      expect(mockDeleteObject).toHaveBeenCalled();
      expect(mockUploadBase64).toHaveBeenCalledWith(validBase64, "organization-logos/test-env/org-1.png");
      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.body).toEqual({ logo_url: "https://s3.amazonaws.com/new-logo.png" });
    });

    it("returns 500 when storage upload returns null", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: "org-1" }] })
        .mockResolvedValueOnce({ rows: [{ logo_url: null }] });

      mockGetOrganizationLogoKey.mockReturnValue("organization-logos/test-env/org-1.png");
      mockUploadBase64.mockResolvedValueOnce(null);

      const req = createMockRequest({ user: mockUser, body: { logoData: validBase64 } });
      const res = createMockResponse();

      await AdminCenterOrganizationController.uploadOrganizationLogo(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toBe("Failed to upload logo");
    });
  });

  describe("deleteOrganizationLogo", () => {
    it("returns 400 when user has no owner_id", async () => {
      const req = createMockRequest({ user: { id: "user-1" } });
      const res = createMockResponse();

      await AdminCenterOrganizationController.deleteOrganizationLogo(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toBe("User not found");
    });

    it("returns 404 when organization is not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const req = createMockRequest({ user: mockUser });
      const res = createMockResponse();

      await AdminCenterOrganizationController.deleteOrganizationLogo(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("Organization not found");
    });

    it("returns 404 when organization has no logo to delete", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ id: "org-1", logo_url: null }] });

      const req = createMockRequest({ user: mockUser });
      const res = createMockResponse();

      await AdminCenterOrganizationController.deleteOrganizationLogo(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("No logo to delete");
    });

    it("deletes logo from S3 and updates database successfully", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ id: "org-1", logo_url: "https://s3.amazonaws.com/bucket/organization-logos/org-1.png" }] })
        .mockResolvedValueOnce({ rows: [{ logo_url: null }] })
        .mockResolvedValueOnce({ rows: [] });

      const req = createMockRequest({ user: mockUser });
      const res = createMockResponse();

      await AdminCenterOrganizationController.deleteOrganizationLogo(req, res);

      expect(mockDeleteObject).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.body).toEqual({ logo_url: null });
    });
  });

  describe("updateOrganizationCalculationMethod", () => {
    it("rejects invalid calculation method with 400", async () => {
      const req = createMockRequest({
        user: mockUser,
        body: { calculation_method: "invalid_method", hours_per_day: 8 },
      });
      const res = createMockResponse();

      await AdminCenterOrganizationController.updateOrganizationCalculationMethod(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.done).toBe(false);
      expect(res.body.message).toContain("Invalid calculation method");
    });

    it("returns 404 if organization row is not found", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] }) // previousCalcResult
        .mockResolvedValueOnce({ rows: [] }); // update result

      const req = createMockRequest({
        user: mockUser,
        body: { calculation_method: "hourly", hours_per_day: 8 },
      });
      const res = createMockResponse();

      await AdminCenterOrganizationController.updateOrganizationCalculationMethod(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toBe("Organization not found");
    });

    it("updates calculation method and writes audit log when changed", async () => {
      const prev = { calculation_method: "hourly", hours_per_day: 8 };
      const updated = {
        id: "org-1",
        organization_name: "Acme",
        calculation_method: "man_days",
        hours_per_day: 7,
      };
      mockQuery
        .mockResolvedValueOnce({ rows: [prev] })
        .mockResolvedValueOnce({ rows: [updated] });

      const req = createMockRequest({
        user: mockUser,
        body: { calculation_method: "man_days", hours_per_day: 7 },
      });
      const res = createMockResponse();

      await AdminCenterOrganizationController.updateOrganizationCalculationMethod(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(mockLogAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: "org-1",
          eventType: AUDIT_EVENT_TYPE.WORKSPACE_SETTING_CHANGED.id,
        })
      );
    });

    it("does not log audit event if calculation method and hours are unchanged", async () => {
      const existing = {
        id: "org-1",
        organization_name: "Acme",
        calculation_method: "hourly",
        hours_per_day: 8,
      };
      mockQuery
        .mockResolvedValueOnce({ rows: [existing] })
        .mockResolvedValueOnce({ rows: [existing] });

      const req = createMockRequest({
        user: mockUser,
        body: { calculation_method: "hourly", hours_per_day: 8 },
      });
      const res = createMockResponse();

      await AdminCenterOrganizationController.updateOrganizationCalculationMethod(req, res);

      expect(res.statusCode).toBe(200);
      expect(mockLogAuditEvent).not.toHaveBeenCalled();
    });
  });

  describe("getOrganizationProjects", () => {
    it("returns 200 with total count and paginated project list", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: 2 }] })
        .mockResolvedValueOnce({
          rows: [
            { id: "proj-1", name: "Alpha", team_name: "Core", member_count: 5 },
            { id: "proj-2", name: "Beta", team_name: "Core", member_count: 3 },
          ],
        });

      const req = createMockRequest({
        user: mockUser,
        query: { size: "10", index: "1" },
      });
      const res = createMockResponse();

      await AdminCenterOrganizationController.getOrganizationProjects(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.body).toEqual({
        total: 2,
        data: [
          { id: "proj-1", name: "Alpha", team_name: "Core", member_count: 5 },
          { id: "proj-2", name: "Beta", team_name: "Core", member_count: 3 },
        ],
      });
    });

    it("handles search queries for projects", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ total: 1 }] })
        .mockResolvedValueOnce({
          rows: [{ id: "proj-1", name: "Alpha", team_name: "Core", member_count: 5 }],
        });

      const req = createMockRequest({
        user: mockUser,
        query: { size: "10", index: "1", search: "Alpha" },
      });
      const res = createMockResponse();

      await AdminCenterOrganizationController.getOrganizationProjects(req, res);

      expect(mockQuery.mock.calls[0][1]).toContain("%Alpha%");
      expect(res.statusCode).toBe(200);
    });
  });
});

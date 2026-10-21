import AuditLogRetentionController from "../controllers/audit-log-retention-controller";
import db from "../config/db";
import { logAuditEvent } from "../services/audit-log.service";
import { auditLogOwnerValidator } from "../middlewares/validators/audit-log-access-validator";
import { createMockRequest, createMockResponse } from "./utils/express-mock";

jest.mock("../config/db", () => ({
  query: jest.fn(),
}));

jest.mock("../services/audit-log.service", () => ({
  ...jest.requireActual("../services/audit-log.service"),
  logAuditEvent: jest.fn(),
}));

const OWNER = { id: "user-1", name: "Olivia Owner", organization_id: "org-1", owner: true };
const ADMIN = { id: "user-2", name: "Adam Admin", organization_id: "org-1", is_admin: true };

const mockQuery = db.query as jest.Mock;

describe("AuditLogRetentionController.get", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns the organization's retention and policy bounds", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ audit_log_retention_months: 12 }] });
    const req = createMockRequest({ user: OWNER });
    const res = createMockResponse();

    await AuditLogRetentionController.get(req, res);

    expect(mockQuery.mock.calls[0][1]).toEqual(["org-1"]);
    expect(res.statusCode).toBe(200);
    expect(res.body.done).toBe(true);
    expect(res.body.body).toEqual({
      retention_months: 12,
      min_months: 3,
      max_months: 24,
      default_months: 12,
      pci_min_months: 12,
      options: [3, 6, 12, 24],
      can_edit: true,
    });
  });

  it("marks the setting read-only for an Admin", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ audit_log_retention_months: 6 }] });
    const req = createMockRequest({ user: ADMIN });
    const res = createMockResponse();

    await AuditLogRetentionController.get(req, res);

    expect(res.body.body.retention_months).toBe(6);
    expect(res.body.body.can_edit).toBe(false);
  });

  it("returns 404 when the organization row does not exist", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const req = createMockRequest({ user: OWNER });
    const res = createMockResponse();

    await AuditLogRetentionController.get(req, res);

    expect(res.statusCode).toBe(404);
  });

  it("fails without querying when the session has no organization", async () => {
    const req = createMockRequest({ user: { id: "user-1", owner: true } });
    const res = createMockResponse();

    await AuditLogRetentionController.get(req, res);

    expect(mockQuery).not.toHaveBeenCalled();
    expect(res.body.done).toBe(false);
  });
});

describe("AuditLogRetentionController.update", () => {
  beforeEach(() => jest.clearAllMocks());

  it("updates the retention and logs the change with old and new values", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ audit_log_retention_months: 12 }] })
      .mockResolvedValueOnce({ rows: [] });
    const req = createMockRequest({ user: OWNER, body: { retention_months: 24 } });
    const res = createMockResponse();

    await AuditLogRetentionController.update(req, res);

    const [updateSql, updateParams] = mockQuery.mock.calls[1];
    expect(updateSql).toMatch(/UPDATE organizations SET audit_log_retention_months = \$2/);
    expect(updateParams).toEqual(["org-1", 24]);
    expect(logAuditEvent).toHaveBeenCalledWith({
      organizationId: "org-1",
      actor: { userId: "user-1", name: "Olivia Owner" },
      eventType: "retention_window_changed",
      description: "Audit log retention changed from 12 to 24 months",
      oldValue: "12",
      newValue: "24",
    });
    expect(res.statusCode).toBe(200);
    expect(res.body.body.retention_months).toBe(24);
  });

  it("does not write or log when the value is unchanged", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ audit_log_retention_months: 12 }] });
    const req = createMockRequest({ user: OWNER, body: { retention_months: "12" } });
    const res = createMockResponse();

    await AuditLogRetentionController.update(req, res);

    expect(mockQuery).toHaveBeenCalledTimes(1);
    expect(logAuditEvent).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
  });

  it.each([[2], [25], [6.5], ["abc"], [null], [undefined]])(
    "rejects %p with 400 and never touches the database",
    async (value) => {
      const req = createMockRequest({ user: OWNER, body: { retention_months: value } });
      const res = createMockResponse();

      await AuditLogRetentionController.update(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body.done).toBe(false);
      expect(mockQuery).not.toHaveBeenCalled();
      expect(logAuditEvent).not.toHaveBeenCalled();
    }
  );

  it("returns 404 when the organization row does not exist", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    const req = createMockRequest({ user: OWNER, body: { retention_months: 6 } });
    const res = createMockResponse();

    await AuditLogRetentionController.update(req, res);

    expect(res.statusCode).toBe(404);
    expect(mockQuery).toHaveBeenCalledTimes(1);
  });
});

describe("auditLogOwnerValidator", () => {
  it("calls next() for the Owner", () => {
    const next = jest.fn();
    const res = createMockResponse();

    auditLogOwnerValidator(createMockRequest({ user: OWNER }), res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it.each([
    ["an Admin", ADMIN],
    ["a Team Lead", { id: "u3", role_name: "Team Lead" }],
    ["a Member", { id: "u4" }],
    ["no user", undefined],
  ])("responds 403 for %s", (_label, user) => {
    const next = jest.fn();
    const res = createMockResponse();

    auditLogOwnerValidator(createMockRequest({ user }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.done).toBe(false);
  });
});

jest.mock("../services/audit-log.service", () => ({
  __esModule: true,
  logAuditEvent: jest.fn(),
  actorFromSessionUser: jest.fn(() => ({ userId: "user-1", name: "Gayan Thakshila" })),
}));

import { logAuditEvent } from "../services/audit-log.service";
import { diffAuditSnapshots, logAuditFieldChanges, toAuditValue } from "../services/audit-log-changes.service";
import { AUDIT_EVENT_TYPE } from "../shared/audit-log-constants";
import { IPassportSession } from "../interfaces/passport-session";

const mockedLogAuditEvent = logAuditEvent as unknown as jest.Mock;

const FIELDS = [
  { key: "status", label: "Status" },
  { key: "budget", label: "Budget" },
  { key: "is_billable", label: "Billable" },
];

describe("audit-log-changes.service", () => {
  beforeEach(() => mockedLogAuditEvent.mockReset());

  describe("toAuditValue", () => {
    it("treats null, undefined and blank strings as no value", () => {
      expect(toAuditValue(null)).toBeNull();
      expect(toAuditValue(undefined)).toBeNull();
      expect(toAuditValue("   ")).toBeNull();
    });

    it("stringifies numbers and booleans and trims text", () => {
      expect(toAuditValue(1500)).toBe("1500");
      expect(toAuditValue(false)).toBe("false");
      expect(toAuditValue("  Completed ")).toBe("Completed");
    });

    it("serializes dates as ISO strings", () => {
      expect(toAuditValue(new Date("2026-10-06T00:00:00.000Z"))).toBe("2026-10-06T00:00:00.000Z");
    });
  });

  describe("diffAuditSnapshots", () => {
    it("returns one change per field whose value differs, in field order", () => {
      const changes = diffAuditSnapshots(
        { status: "In Progress", budget: 1000, is_billable: true },
        { status: "Completed", budget: 1000, is_billable: false },
        FIELDS
      );

      expect(changes).toEqual([
        { label: "Status", oldValue: "In Progress", newValue: "Completed" },
        { label: "Billable", oldValue: "true", newValue: "false" },
      ]);
    });

    it("ignores re-saved values that only differ by blank vs null", () => {
      expect(diffAuditSnapshots({ status: "" }, { status: null }, FIELDS)).toEqual([]);
    });

    it("reports a value being cleared", () => {
      expect(diffAuditSnapshots({ budget: 500 }, { budget: null }, FIELDS)).toEqual([
        { label: "Budget", oldValue: "500", newValue: null },
      ]);
    });
  });

  describe("logAuditFieldChanges", () => {
    const user = { id: "user-1", organization_id: "org-1", team_id: "team-1" } as IPassportSession;

    it("logs one entry per change with the subject in the description", () => {
      logAuditFieldChanges({
        user,
        eventType: AUDIT_EVENT_TYPE.PROJECT_SETTING_CHANGED.id,
        subject: 'Project "Apollo"',
        changes: [
          { label: "Status", oldValue: "In Progress", newValue: "Completed" },
          { label: "Budget", oldValue: "1000", newValue: "2000" },
        ],
      });

      expect(mockedLogAuditEvent).toHaveBeenCalledTimes(2);
      expect(mockedLogAuditEvent).toHaveBeenNthCalledWith(1, {
        organizationId: "org-1",
        teamId: "team-1",
        actor: { userId: "user-1", name: "Gayan Thakshila" },
        eventType: AUDIT_EVENT_TYPE.PROJECT_SETTING_CHANGED.id,
        description: 'Project "Apollo": Status changed',
        oldValue: "In Progress",
        newValue: "Completed",
      });
    });

    it("logs nothing without a workspace", () => {
      logAuditFieldChanges({
        user: { ...user, organization_id: undefined } as unknown as IPassportSession,
        eventType: AUDIT_EVENT_TYPE.PROJECT_SETTING_CHANGED.id,
        subject: 'Project "Apollo"',
        changes: [{ label: "Status", oldValue: "A", newValue: "B" }],
      });

      expect(mockedLogAuditEvent).not.toHaveBeenCalled();
    });
  });
});

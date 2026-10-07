jest.mock("../config/db", () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

jest.mock("../shared/utils", () => ({
  __esModule: true,
  log_error: jest.fn(),
}));

import db from "../config/db";
import { log_error } from "../shared/utils";
import {
  actorFromSessionUser,
  logAuditEvent,
} from "../services/audit-log.service";
import { AUDIT_EVENT_TYPE } from "../shared/audit-log-constants";

const mockedDb = db as unknown as { query: jest.Mock };
const mockedLogError = log_error as unknown as jest.Mock;

/**
 * logAuditEvent() is fire-and-forget: it schedules its work via queueMicrotask and the actual
 * write is itself async (awaits db.query). Flushing with a real setImmediate macrotask lets
 * both the queued microtask and any already-queued promise continuations drain before each
 * assertion, without needing fake timers.
 */
const flush = () => new Promise((resolve) => setImmediate(resolve));

describe("audit-log.service", () => {
  const baseParams = {
    organizationId: "org-1",
    teamId: "team-1",
    actor: { userId: "user-1", name: "Gayan Thakshila" },
    eventType: AUDIT_EVENT_TYPE.ROLE_CHANGED.id,
    oldValue: "Member",
    newValue: "Team Lead",
  };

  describe("logAuditEvent", () => {
    it("returns synchronously without performing any work on the caller's stack", () => {
      mockedDb.query.mockResolvedValue({ rows: [] });

      logAuditEvent(baseParams);

      // Nothing should have happened yet - the write is deferred to a later microtask.
      expect(mockedDb.query).not.toHaveBeenCalled();
    });

    it("writes an INSERT into audit_events with the derived category and all provided fields", async () => {
      mockedDb.query.mockResolvedValue({ rows: [] });

      logAuditEvent(baseParams);
      await flush();

      expect(mockedDb.query).toHaveBeenCalledTimes(1);
      const [sql, values] = mockedDb.query.mock.calls[0];

      expect(sql).toMatch(/INSERT INTO audit_events/);
      expect(values).toEqual([
        "org-1", // organization_id
        "team-1", // team_id
        "user-1", // actor_user_id
        "Gayan Thakshila", // actor_name
        "user", // category, derived from ROLE_CHANGED
        "role_changed", // event_type
        expect.any(String), // description - exact fallback value is covered by the next test
        "Member", // old_value
        "Team Lead", // new_value
      ]);
    });

    it("falls back to the event type's default label when no description is given", async () => {
      mockedDb.query.mockResolvedValue({ rows: [] });

      logAuditEvent(baseParams);
      await flush();

      const [, values] = mockedDb.query.mock.calls[0];
      expect(values[6]).toBe(AUDIT_EVENT_TYPE.ROLE_CHANGED.defaultLabel);
    });

    it("uses a custom description over the default label when one is provided", async () => {
      mockedDb.query.mockResolvedValue({ rows: [] });

      logAuditEvent({
        ...baseParams,
        description: "Ruwan Fernando: Member → Team Lead on KYC / AML Pipeline",
      });
      await flush();

      const [, values] = mockedDb.query.mock.calls[0];
      expect(values[6]).toBe(
        "Ruwan Fernando: Member → Team Lead on KYC / AML Pipeline"
      );
    });

    it("writes NULL for actor_user_id and team_id when they are omitted", async () => {
      mockedDb.query.mockResolvedValue({ rows: [] });

      logAuditEvent({
        organizationId: "org-1",
        actor: { userId: null, name: "System" },
        eventType: AUDIT_EVENT_TYPE.WORKSPACE_RENAMED.id,
      });
      await flush();

      const [, values] = mockedDb.query.mock.calls[0];
      expect(values[1]).toBeNull(); // team_id
      expect(values[2]).toBeNull(); // actor_user_id
    });

    it("never throws and logs via log_error when organizationId is missing", async () => {
      expect(() =>
        logAuditEvent({
          ...baseParams,
          organizationId: "" as unknown as string,
        })
      ).not.toThrow();

      await flush();

      expect(mockedDb.query).not.toHaveBeenCalled();
      expect(mockedLogError).toHaveBeenCalledTimes(1);
      expect(mockedLogError.mock.calls[0][0]).toBeInstanceOf(Error);
      expect(mockedLogError.mock.calls[0][1]).toMatchObject({
        scope: "logAuditEvent",
      });
    });

    it("never throws and logs via log_error when actor.name is missing", async () => {
      expect(() =>
        logAuditEvent({
          ...baseParams,
          actor: { userId: "user-1", name: "" },
        })
      ).not.toThrow();

      await flush();

      expect(mockedDb.query).not.toHaveBeenCalled();
      expect(mockedLogError).toHaveBeenCalledTimes(1);
    });

    it("never throws and logs via log_error for an unknown eventType", async () => {
      expect(() =>
        logAuditEvent({
          ...baseParams,
          eventType: "sso_configuration_changed" as any,
        })
      ).not.toThrow();

      await flush();

      expect(mockedDb.query).not.toHaveBeenCalled();
      expect(mockedLogError).toHaveBeenCalledTimes(1);
    });

    it("never throws and logs via log_error when the DB write itself fails", async () => {
      mockedDb.query.mockRejectedValue(new Error("connection reset"));

      expect(() => logAuditEvent(baseParams)).not.toThrow();

      await flush();
      await flush(); // one extra tick for the rejected promise's catch handler to run

      expect(mockedLogError).toHaveBeenCalledTimes(1);
      expect(mockedLogError.mock.calls[0][0]).toBeInstanceOf(Error);
      expect(mockedLogError.mock.calls[0][0].message).toBe("connection reset");
    });

    it("derives category independently per event type, across all 4 categories", async () => {
      mockedDb.query.mockResolvedValue({ rows: [] });

      const cases: Array<[string, string]> = [
        [AUDIT_EVENT_TYPE.LOGIN_FAILED.id, "access"],
        [AUDIT_EVENT_TYPE.MEMBER_REMOVED.id, "user"],
        [AUDIT_EVENT_TYPE.PROJECT_PRIVACY_CHANGED.id, "permission"],
        [AUDIT_EVENT_TYPE.PROJECT_ARCHIVED.id, "lifecycle"],
      ];

      for (const [eventType, expectedCategory] of cases) {
        mockedDb.query.mockClear();
        logAuditEvent({ ...baseParams, eventType: eventType as any, description: undefined });
        await flush();

        const [, values] = mockedDb.query.mock.calls[0];
        expect(values[4]).toBe(expectedCategory);
      }
    });
  });

  describe("actorFromSessionUser", () => {
    it("maps id and name from the session user", () => {
      const actor = actorFromSessionUser({ id: "user-1", name: "Chamika Perera" } as any);
      expect(actor).toEqual({ userId: "user-1", name: "Chamika Perera" });
    });

    it("falls back to email when name is blank", () => {
      const actor = actorFromSessionUser({ id: "user-2", name: "  ", email: "c@ifinity.ae" } as any);
      expect(actor).toEqual({ userId: "user-2", name: "c@ifinity.ae" });
    });

    it("falls back to 'Unknown user' when neither name nor email is available", () => {
      const actor = actorFromSessionUser({ id: "user-3" } as any);
      expect(actor).toEqual({ userId: "user-3", name: "Unknown user" });
    });

    it("maps a missing id to null", () => {
      const actor = actorFromSessionUser({ name: "No Id User" } as any);
      expect(actor.userId).toBeNull();
    });
  });
});

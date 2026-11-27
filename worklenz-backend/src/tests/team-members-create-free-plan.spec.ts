jest.mock("../config/db", () => ({
  __esModule: true,
  default: { query: jest.fn() },
}));

jest.mock("../shared/paddle-utils", () => ({
  __esModule: true,
  checkTeamSubscriptionStatus: jest.fn(),
  getFreePlanSettings: jest.fn(),
}));

jest.mock("../shared/team-seat-lock", () => ({
  __esModule: true,
  withTeamSeatLock: jest.fn(),
}));

jest.mock("../shared/deployment-mode", () => ({
  __esModule: true,
  isSelfHostedDeployment: jest.fn(() => false),
}));

jest.mock("../services/notifications/notifications.service", () => ({
  __esModule: true,
  NotificationsService: { sendTeamMembersInvitations: jest.fn() },
}));

jest.mock("../services/team-member-audit.service", () => ({
  __esModule: true,
  captureTeamMember: jest.fn(),
  logTeamEvent: jest.fn(),
  logTeamMemberChanges: jest.fn(),
  logTeamMemberEvent: jest.fn(),
}));

jest.mock("../services/audit-log.service", () => ({
  __esModule: true,
  actorFromSessionUser: jest.fn().mockReturnValue({}),
  logAuditEvent: jest.fn(),
  resolveOrganizationIdForUserId: jest.fn(),
}));

import db from "../config/db";
import TeamMembersController from "../controllers/team-members-controller";
import { checkTeamSubscriptionStatus, getFreePlanSettings } from "../shared/paddle-utils";
import { withTeamSeatLock } from "../shared/team-seat-lock";
import { createMockRequest, createMockResponse } from "./utils/express-mock";

const mockQuery = db.query as jest.Mock;
const mockCheckTeamSubscriptionStatus = checkTeamSubscriptionStatus as jest.Mock;
const mockGetFreePlanSettings = getFreePlanSettings as jest.Mock;
const mockWithTeamSeatLock = withTeamSeatLock as jest.Mock;

const freeSubscription = (count: number) => ({
  subscription_type: "FREE",
  subscription_status: "free",
  current_count: String(count),
  team_member_limit_override: false,
});

const makeRequest = () => createMockRequest({
  user: {
    id: "owner-user",
    owner_id: "owner-user",
    owner: true,
    team_id: "team-1",
    team_name: "Team",
  },
  body: { emails: ["guest-only@example.com"] },
});

describe("TeamMembersController.create free-plan seat limit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetFreePlanSettings.mockResolvedValue({ team_member_limit: "5" });
    mockWithTeamSeatLock.mockImplementation(async (_teamId, callback) => callback());
    mockQuery.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (text.includes("LOWER(email) = LOWER")) return { rows: [{ exists: false }] };
      if (text.includes("create_team_member")) return { rows: [{ new_members: [{ email: "guest-only@example.com" }] }] };
      return { rows: [{ exists: false }] };
    });
  });

  it("counts a guest-only email as a new seat and rejects the invitation at the limit", async () => {
    mockCheckTeamSubscriptionStatus.mockResolvedValue(freeSubscription(5));
    const res = createMockResponse();

    await TeamMembersController.create(makeRequest(), res);

    expect(mockWithTeamSeatLock).toHaveBeenCalledWith("team-1", expect.any(Function));
    expect(res.body.done).toBe(false);
    expect(res.body.body).toEqual(expect.objectContaining({
      error_code: "SEAT_LIMIT_EXCEEDED",
      current_members: 5,
      plan_seat_limit: 5,
    }));
    expect(mockQuery.mock.calls.some(([sql]) => String(sql).includes("create_team_member"))).toBe(false);
    expect(mockQuery.mock.calls.some(([sql]) => String(sql).includes("project_access_levels") && String(sql).includes("GUEST"))).toBe(true);
  });

  it("re-reads the member count inside the team seat lock", async () => {
    const events: string[] = [];
    mockCheckTeamSubscriptionStatus
      .mockImplementationOnce(async () => {
        events.push("initial-count");
        return freeSubscription(3);
      })
      .mockImplementationOnce(async () => {
        events.push("refresh-count");
        return freeSubscription(5);
      });
    mockGetFreePlanSettings.mockImplementation(async () => {
      events.push("read-limit");
      return { team_member_limit: "5" };
    });
    mockWithTeamSeatLock.mockImplementation(async (_teamId, callback) => {
      events.push("lock-acquired");
      try {
        return await callback();
      } finally {
        events.push("lock-released");
      }
    });
    const res = createMockResponse();

    await TeamMembersController.create(makeRequest(), res);

    expect(mockCheckTeamSubscriptionStatus).toHaveBeenCalledTimes(2);
    expect(events).toEqual(["initial-count", "lock-acquired", "refresh-count", "read-limit", "lock-released"]);
    expect(res.body.done).toBe(false);
    expect(res.body.body).toEqual(expect.objectContaining({ current_members: 5 }));
    expect(mockQuery.mock.calls.some(([sql]) => String(sql).includes("create_team_member"))).toBe(false);
  });

  it("creates the invitation while holding the team seat lock", async () => {
    const events: string[] = [];
    mockCheckTeamSubscriptionStatus.mockImplementation(async () => {
      events.push("read-count");
      return freeSubscription(3);
    });
    mockGetFreePlanSettings.mockImplementation(async () => {
      events.push("read-limit");
      return { team_member_limit: "5" };
    });
    mockWithTeamSeatLock.mockImplementation(async (_teamId, callback) => {
      events.push("lock-acquired");
      try {
        return await callback();
      } finally {
        events.push("lock-released");
      }
    });
    mockQuery.mockImplementation(async (sql: string) => {
      const text = String(sql);
      if (text.includes("create_team_member")) {
        events.push("insert-invitation");
        return { rows: [{ new_members: [{ email: "guest-only@example.com" }] }] };
      }
      return { rows: [{ exists: false }] };
    });
    const res = createMockResponse();

    await TeamMembersController.create(makeRequest(), res);

    expect(res.body.done).toBe(true);
    expect(events).toEqual(["read-count", "lock-acquired", "read-count", "read-limit", "insert-invitation", "lock-released"]);
  });

  it("keeps ordinary paid-plan invitation behavior unchanged", async () => {
    mockCheckTeamSubscriptionStatus.mockResolvedValue({
      subscription_type: "PADDLE",
      subscription_status: "active",
      current_count: "1",
      team_member_limit_override: false,
      is_credit: false,
      is_custom: false,
      effective_user_limit: 5,
      quantity: 5,
    });
    const res = createMockResponse();

    await TeamMembersController.create(makeRequest(), res);

    expect(mockWithTeamSeatLock).not.toHaveBeenCalled();
    expect(res.body.done).toBe(true);
    expect(mockQuery.mock.calls.some(([sql]) => String(sql).includes("create_team_member"))).toBe(true);
  });
});

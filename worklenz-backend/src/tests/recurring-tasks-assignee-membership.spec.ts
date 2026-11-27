import moment from "moment-timezone";

const mockClientQuery = jest.fn();
const mockClientRelease = jest.fn();

jest.mock("../config/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
    pool: { connect: jest.fn(async () => ({ query: mockClientQuery, release: mockClientRelease })) },
  },
}));

jest.mock("../shared/utils", () => ({ log_error: jest.fn() }));

import { createSingleRecurringTask } from "../cron_jobs/recurring-tasks";

const ACTIVE_MEMBER = "11111111-1111-1111-1111-111111111111";
const REMOVED_MEMBER = "22222222-2222-2222-2222-222222222222";
const PROJECT_ID = "33333333-3333-3333-3333-333333333333";

const template = {
  name: "Weekly sync",
  description: null,
  priority_id: null,
  project_id: PROJECT_ID,
  reporter_id: "44444444-4444-4444-4444-444444444444",
  status_id: null,
  duration_days: null,
  schedule_id: "55555555-5555-5555-5555-555555555555",
  assignees: [
    { team_member_id: ACTIVE_MEMBER },
    { team_member_id: REMOVED_MEMBER },
  ],
  labels: [],
};

const callsMatching = (pattern: RegExp) =>
  mockClientQuery.mock.calls.filter(([sql]) => pattern.test(String(sql)));

beforeEach(() => {
  mockClientQuery.mockReset();
  mockClientRelease.mockReset();

  mockClientQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
    const text = String(sql);
    if (text.includes("create_quick_task")) {
      return { rows: [{ task: { id: "66666666-6666-6666-6666-666666666666" } }], rowCount: 1 };
    }
    if (text.includes("FROM project_members")) {
      // Only ACTIVE_MEMBER still belongs to the project
      const isMember = params?.[0] === ACTIVE_MEMBER;
      return { rows: isMember ? [{ "?column?": 1 }] : [], rowCount: isMember ? 1 : 0 };
    }
    return { rows: [], rowCount: 0 };
  });
});

describe("createSingleRecurringTask - assignee membership", () => {
  it("assigns members still in the project", async () => {
    await createSingleRecurringTask(template as never, moment("2026-11-25"));

    const assignCalls = callsMatching(/create_bulk_task_assignees/);
    expect(assignCalls).toHaveLength(1);
    expect(assignCalls[0][1][0]).toBe(ACTIVE_MEMBER);
  });

  it("skips assignees who were removed from the project so they are not re-added", async () => {
    await createSingleRecurringTask(template as never, moment("2026-11-25"));

    const assignCalls = callsMatching(/create_bulk_task_assignees/);
    expect(assignCalls.some(([, params]) => params[0] === REMOVED_MEMBER)).toBe(false);
  });
  it("locks the membership row for the assignment transaction", async () => {
    await createSingleRecurringTask(template as never, moment("2026-11-25"));

    const membershipCalls = callsMatching(/FROM project_members/);
    expect(membershipCalls.length).toBeGreaterThan(0);
    expect(membershipCalls.every(([sql]) => String(sql).includes("FOR SHARE"))).toBe(true);
  });

});

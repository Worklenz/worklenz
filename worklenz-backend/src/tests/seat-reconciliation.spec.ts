jest.mock("../config/db", () => ({ __esModule: true, default: { pool: { connect: jest.fn() }, query: jest.fn() } }));
jest.mock("../shared/paddle-utils", () => ({ getActiveTeamMemberCount: jest.fn() }));

import { findSeatDrift } from "../cron_jobs/seat-reconciliation-job";

describe("findSeatDrift", () => {
  it("reports teams using more seats than they pay for", () => {
    expect(findSeatDrift([{ ownerId: "a", quantity: 5, members: 7 }])).toEqual([{ ownerId: "a", quantity: 5, members: 7 }]);
  });

  it("ignores teams with spare seats, exact seats, or no subscription quantity", () => {
    expect(
      findSeatDrift([
        { ownerId: "a", quantity: 10, members: 4 },
        { ownerId: "b", quantity: 5, members: 5 },
        { ownerId: "c", quantity: 0, members: 3 },
      ])
    ).toEqual([]);
  });
});

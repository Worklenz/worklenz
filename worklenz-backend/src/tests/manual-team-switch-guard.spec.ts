jest.mock("../redis/client", () => ({
  redisClient: {
    isOpen: false,
    get: jest.fn(),
    setEx: jest.fn(),
    del: jest.fn(),
  },
}));

import { redisClient } from "../redis/client";
import {
  clearAutoTeamSwitchSuppressions,
  isAutoTeamSwitchSuppressed,
  suppressAutoTeamSwitch,
} from "../shared/manual-team-switch-guard";

describe("manual-team-switch-guard", () => {
  beforeEach(async () => {
    await clearAutoTeamSwitchSuppressions();
  });

  afterEach(async () => {
    await clearAutoTeamSwitchSuppressions();
  });

  it("uses the renewed local deadline when Redis still holds an expired one", async () => {
    await suppressAutoTeamSwitch("user-1", 60_000);
    const redis = redisClient as unknown as { isOpen: boolean; get: jest.Mock; del: jest.Mock };
    redis.isOpen = true;
    redis.get.mockResolvedValue(String(Date.now() - 1));
    redis.del.mockResolvedValue(1);
    expect(await isAutoTeamSwitchSuppressed("user-1")).toBe(true);
    redis.isOpen = false;
  });

  it("suppresses auto team switch until cleared", async () => {
    expect(await isAutoTeamSwitchSuppressed("user-1")).toBe(false);

    await suppressAutoTeamSwitch("user-1", 60_000);
    expect(await isAutoTeamSwitchSuppressed("user-1")).toBe(true);
    expect(await isAutoTeamSwitchSuppressed("user-2")).toBe(false);

    await clearAutoTeamSwitchSuppressions();
    expect(await isAutoTeamSwitchSuppressed("user-1")).toBe(false);
  });
});

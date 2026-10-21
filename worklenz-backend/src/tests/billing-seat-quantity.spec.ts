jest.mock("../config/db", () => ({ query: jest.fn() }));
jest.mock("../shared/email", () => ({ sendEmail: jest.fn() }));
jest.mock("../shared/utils", () => ({ log_error: jest.fn() }));
jest.mock("../shared/paddle-utils", () => ({
  getCurrentSubscriptionRef: jest.fn(),
  getActiveTeamMemberCount: jest.fn(),
}));
jest.mock("../shared/paddle-requests", () => ({ updateUsers: jest.fn() }));

import BillingController from "../controllers/billing-controller";
import {
  getCurrentSubscriptionRef,
  getActiveTeamMemberCount,
} from "../shared/paddle-utils";
import { updateUsers } from "../shared/paddle-requests";
import { createMockRequest, createMockResponse } from "./utils/express-mock";

describe("billing seat quantities", () => {
  beforeEach(() => {
    jest.mocked(getCurrentSubscriptionRef).mockResolvedValue("sub_test");
    jest.mocked(getActiveTeamMemberCount).mockResolvedValue({ user_count: 5 });
    jest
      .mocked(updateUsers)
      .mockResolvedValue({ body: { subscription_id: "sub_test" } });
  });

  it.each(["10", 10.5])("sends an integer for %s", async (seatCount) => {
    await BillingController.addMoreSeats(
      createMockRequest({ body: { seatCount } }),
      createMockResponse(),
    );
    expect(updateUsers).toHaveBeenCalledWith("sub_test", 10);
  });

  it.each([4.9, "invalid", Infinity, Number.MAX_SAFE_INTEGER + 1])(
    "does not send invalid or insufficient seats: %s",
    async (seatCount) => {
      const res = createMockResponse();
      await BillingController.addMoreSeats(
        createMockRequest({ body: { seatCount } }),
        res,
      );
      expect(res.body.done).toBe(false);
      expect(updateUsers).not.toHaveBeenCalled();
    },
  );
});
